import { requirePlatformAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin(request);
    const { data, error } = await admin.from("empresas").select("id,nome,slug,whatsapp,endereco,horario_funcionamento,logo_url,taxa_entrega,taxa_cartao,tempo_entrega_minutos,bloqueada,ativo,pendente_aprovacao,created_at,perfis(nome)").order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao carregar restaurantes." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin(request);
    const body = await request.json();
    const nome = String(body.nome ?? "").trim();
    const slug = String(body.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const email = String(body.email ?? "").trim().toLowerCase();
    const senha = String(body.senha ?? "");
    if (!nome || !slug || !email || senha.length < 6) return Response.json({ error: "Preencha nome, link, e-mail e uma senha com ao menos 6 caracteres." }, { status: 400 });
    const { data: empresa, error: empresaError } = await admin.from("empresas").insert({ nome, slug }).select("id").single();
    if (empresaError || !empresa) throw empresaError ?? new Error("Não foi possível criar o restaurante.");
    const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (authError || !authData.user) { await admin.from("empresas").delete().eq("id", empresa.id); throw authError ?? new Error("Não foi possível criar o administrador."); }
    const { error: perfilError } = await admin.from("perfis").insert({ id: authData.user.id, empresa_id: empresa.id, nome: `Administrador ${nome}`, papel: "dono" });
    if (perfilError) throw perfilError;
    return Response.json({ id: empresa.id, slug }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao criar restaurante." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin(request);
    const body = await request.json();
    const empresaId = String(body.empresaId ?? "");
    if (!empresaId) return Response.json({ error: "Restaurante não informado." }, { status: 400 });
    if (body.acao === "bloquear") {
      const { error } = await admin.from("empresas").update({ bloqueada: Boolean(body.bloqueada), ativo: !Boolean(body.bloqueada) }).eq("id", empresaId);
      if (error) throw error;
    } else if (body.acao === "aprovar") {
      const { error } = await admin.from("empresas").update({ ativo: true, bloqueada: false, pendente_aprovacao: false }).eq("id", empresaId);
      if (error) throw error;
    } else if (body.acao === "senha") {
      const { data: perfil, error: perfilError } = await admin.from("perfis").select("id").eq("empresa_id", empresaId).eq("papel", "dono").single();
      if (perfilError || !perfil) throw perfilError ?? new Error("Administrador não encontrado.");
      const { error } = await admin.auth.admin.updateUserById(perfil.id, { password: String(body.senha ?? "") });
      if (error) throw error;
    } else if (body.acao === "editar") {
      const dados = {
        nome: String(body.nome ?? "").trim(),
        slug: String(body.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        whatsapp: String(body.whatsapp ?? "").trim() || null,
        endereco: String(body.endereco ?? "").trim() || null,
        horario_funcionamento: String(body.horario ?? "").trim() || null,
      };
      if (!dados.nome || !dados.slug) return Response.json({ error: "Nome e link do restaurante são obrigatórios." }, { status: 400 });
      const { error } = await admin.from("empresas").update(dados).eq("id", empresaId);
      if (error) throw error;
    } else if (body.acao === "mensagem") {
      const { error } = await admin.from("mensagens_plataforma").insert({ empresa_id: empresaId, titulo: String(body.titulo ?? "Comunicado"), conteudo: String(body.conteudo ?? "") });
      if (error) throw error;
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro na atualização." }, { status: 400 });
  }
}
