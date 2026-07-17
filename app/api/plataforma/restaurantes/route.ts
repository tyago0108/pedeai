import { registrarAuditoria, textoSeguro } from "@/lib/plataforma";
import { requirePlatformAdmin } from "@/lib/supabase/server";

const normalizarSlug = (valor: unknown) => textoSeguro(valor, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function administradorDaEmpresa(admin: Awaited<ReturnType<typeof requirePlatformAdmin>>["admin"], empresaId: string) {
  const { data, error } = await admin.from("perfis").select("id,nome,papel").eq("empresa_id", empresaId).eq("papel", "dono").maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin(request);
    // Empresas e perfis são a base do painel. Não faça essa consulta depender
    // das tabelas financeiras, pois instalações anteriores ainda podem não ter
    // executado a migração de operação da plataforma.
    const { data, error } = await admin.from("empresas").select("id,nome,slug,whatsapp,endereco,horario_funcionamento,logo_url,taxa_entrega,taxa_cartao,tempo_entrega_minutos,bloqueada,ativo,pendente_aprovacao,modo_operacao,created_at,perfis(id,nome,papel)").order("created_at", { ascending: false });
    if (error) throw error;
    const { data: assinaturas, error: assinaturasErro } = await admin.from("assinaturas_restaurante").select("id,empresa_id,status,valor_mensal,vencimento_em,bloqueio_automatico,planos_plataforma(nome)");
    if (assinaturasErro && assinaturasErro.code !== "42P01") throw assinaturasErro;
    const assinaturaPorEmpresa = new Map((assinaturas ?? []).map((assinatura) => [assinatura.empresa_id, assinatura]));
    const empresas = await Promise.all((data ?? []).map(async (empresa) => {
      const perfis = Array.isArray(empresa.perfis) ? empresa.perfis : [];
      const dono = perfis.find((perfil) => perfil.papel === "dono") ?? perfis[0];
      const usuario = dono ? await admin.auth.admin.getUserById(dono.id) : { data: { user: null } };
      return {
        ...empresa,
        administrador: dono ? { id: dono.id, nome: dono.nome, email: usuario.data.user?.email ?? null, ultimoAcesso: usuario.data.user?.last_sign_in_at ?? null } : null,
        assinatura: assinaturaPorEmpresa.get(empresa.id) ?? null,
      };
    }));
    return Response.json(empresas);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao carregar restaurantes." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const { admin, user } = await requirePlatformAdmin(request);
    const body = await request.json();
    const nome = textoSeguro(body.nome, 160);
    const slug = normalizarSlug(body.slug);
    const email = textoSeguro(body.email, 320).toLowerCase();
    const senha = String(body.senha ?? "");
    if (!nome || !slug || !email || senha.length < 8) return Response.json({ error: "Preencha nome, link, e-mail e uma senha com ao menos 8 caracteres." }, { status: 400 });
    const { data: empresa, error: empresaError } = await admin.from("empresas").insert({ nome, slug }).select("id").single();
    if (empresaError || !empresa) throw empresaError ?? new Error("Não foi possível criar o restaurante.");
    const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (authError || !authData.user) { await admin.from("empresas").delete().eq("id", empresa.id); throw authError ?? new Error("Não foi possível criar o administrador."); }
    const { error: perfilError } = await admin.from("perfis").insert({ id: authData.user.id, empresa_id: empresa.id, nome: `Administrador ${nome}`, papel: "dono" });
    if (perfilError) throw perfilError;
    const { data: planoTeste, error: planoErro } = await admin.from("planos_plataforma").select("id,valor_mensal").eq("nome", "Teste").maybeSingle();
    if (planoErro && planoErro.code !== "42P01") throw planoErro;
    const { error: assinaturaErro } = await admin.from("assinaturas_restaurante").insert({ empresa_id: empresa.id, plano_id: planoTeste?.id ?? null, status: "teste", valor_mensal: planoTeste?.valor_mensal ?? 0 });
    if (assinaturaErro && assinaturaErro.code !== "42P01") throw assinaturaErro;
    await registrarAuditoria(admin, { administradorId: user.id, empresaId: empresa.id, acao: "criou", recurso: "restaurante", detalhes: { nome, slug, email } });
    return Response.json({ id: empresa.id, slug }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao criar restaurante." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin, user } = await requirePlatformAdmin(request);
    const body = await request.json();
    const empresaId = textoSeguro(body.empresaId, 100);
    const acao = textoSeguro(body.acao, 80);
    if (!empresaId || !acao) return Response.json({ error: "Restaurante e ação são obrigatórios." }, { status: 400 });
    if (acao === "bloquear") {
      const bloqueada = Boolean(body.bloqueada);
      const { error } = await admin.from("empresas").update({ bloqueada, ativo: !bloqueada }).eq("id", empresaId);
      if (error) throw error;
      await registrarAuditoria(admin, { administradorId: user.id, empresaId, acao: bloqueada ? "bloqueou" : "desbloqueou", recurso: "restaurante" });
    } else if (acao === "aprovar") {
      const { error } = await admin.from("empresas").update({ ativo: true, bloqueada: false, pendente_aprovacao: false }).eq("id", empresaId);
      if (error) throw error;
      await registrarAuditoria(admin, { administradorId: user.id, empresaId, acao: "aprovou", recurso: "restaurante" });
    } else if (acao === "senha") {
      const senha = String(body.senha ?? "");
      if (senha.length < 8) return Response.json({ error: "A nova senha precisa ter ao menos 8 caracteres." }, { status: 400 });
      const perfil = await administradorDaEmpresa(admin, empresaId);
      if (!perfil) return Response.json({ error: "Administrador não encontrado." }, { status: 404 });
      const { error } = await admin.auth.admin.updateUserById(perfil.id, { password: senha });
      if (error) throw error;
      await registrarAuditoria(admin, { administradorId: user.id, empresaId, acao: "redefiniu", recurso: "senha_administrador" });
    } else if (acao === "email") {
      const email = textoSeguro(body.email, 320).toLowerCase();
      if (!email.includes("@")) return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
      const perfil = await administradorDaEmpresa(admin, empresaId);
      if (!perfil) return Response.json({ error: "Administrador não encontrado." }, { status: 404 });
      const { error } = await admin.auth.admin.updateUserById(perfil.id, { email, email_confirm: true });
      if (error) throw error;
      await registrarAuditoria(admin, { administradorId: user.id, empresaId, acao: "alterou", recurso: "email_administrador", detalhes: { email } });
    } else if (acao === "editar") {
      const dados = { nome: textoSeguro(body.nome, 160), slug: normalizarSlug(body.slug), whatsapp: textoSeguro(body.whatsapp, 40) || null, endereco: textoSeguro(body.endereco, 500) || null, horario_funcionamento: textoSeguro(body.horario, 500) || null, logo_url: textoSeguro(body.logoUrl, 1000) || null };
      if (!dados.nome || !dados.slug) return Response.json({ error: "Nome e link do restaurante são obrigatórios." }, { status: 400 });
      const { error } = await admin.from("empresas").update(dados).eq("id", empresaId);
      if (error) throw error;
      await registrarAuditoria(admin, { administradorId: user.id, empresaId, acao: "editou", recurso: "restaurante", detalhes: { nome: dados.nome, slug: dados.slug } });
    } else {
      return Response.json({ error: "Ação não reconhecida." }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro na atualização." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { admin, user } = await requirePlatformAdmin(request);
    const empresaId = new URL(request.url).searchParams.get("empresaId")?.trim() ?? "";
    if (!empresaId) return Response.json({ error: "Restaurante não informado." }, { status: 400 });
    const { data: empresa, error: empresaErro } = await admin.from("empresas").select("nome").eq("id", empresaId).single();
    if (empresaErro || !empresa) throw empresaErro ?? new Error("Restaurante não encontrado.");
    await registrarAuditoria(admin, { administradorId: user.id, empresaId, acao: "excluiu", recurso: "restaurante", detalhes: { nome: empresa.nome } });
    const { error } = await admin.from("empresas").delete().eq("id", empresaId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível excluir o restaurante." }, { status: 400 });
  }
}
