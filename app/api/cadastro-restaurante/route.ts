import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nome = String(body.nome ?? "").trim();
    const slug = String(body.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const email = String(body.email ?? "").trim().toLowerCase();
    const senha = String(body.senha ?? "");
    if (!nome || !slug || !email || senha.length < 6) return Response.json({ error: "Preencha todos os campos e use uma senha com pelo menos 6 caracteres." }, { status: 400 });
    const admin = getSupabaseAdmin();
    const { data: empresa, error: empresaError } = await admin.from("empresas").insert({ nome, slug, ativo: false, pendente_aprovacao: true }).select("id").single();
    if (empresaError || !empresa) throw empresaError ?? new Error("Não foi possível criar o restaurante.");
    const { data: usuario, error: userError } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (userError || !usuario.user) { await admin.from("empresas").delete().eq("id", empresa.id); throw userError ?? new Error("Não foi possível criar o usuário."); }
    const { error: perfilError } = await admin.from("perfis").insert({ id: usuario.user.id, empresa_id: empresa.id, nome: `Administrador ${nome}`, papel: "dono" });
    if (perfilError) throw perfilError;
    const { data: planoTeste } = await admin.from("planos_plataforma").select("id,valor_mensal").eq("nome", "Teste").maybeSingle();
    const { error: assinaturaErro } = await admin.from("assinaturas_restaurante").insert({ empresa_id: empresa.id, plano_id: planoTeste?.id ?? null, status: "teste", valor_mensal: planoTeste?.valor_mensal ?? 0 });
    if (assinaturaErro) throw assinaturaErro;
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível concluir o cadastro." }, { status: 400 });
  }
}
