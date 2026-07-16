import { getSupabaseAdmin } from "@/lib/supabase/server";

const novoCodigo = () => crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();

export async function PATCH(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ error: "Sessão não encontrada." }, { status: 401 });
    const admin = getSupabaseAdmin();
    const { data: sessao, error: sessaoErro } = await admin.auth.getUser(token);
    if (sessaoErro || !sessao.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });
    const { data: perfil } = await admin.from("perfis").select("empresa_id").eq("id", sessao.user.id).maybeSingle();
    if (!perfil) return Response.json({ error: "Acesso de restaurante não encontrado." }, { status: 403 });
    const telefone = String((await request.json()).telefone ?? "").replace(/\D/g, "");
    if (telefone.length < 10) return Response.json({ error: "Informe o WhatsApp do cliente." }, { status: 400 });
    const { data: cliente } = await admin.from("clientes_publicos").select("id,nome").eq("empresa_id", perfil.empresa_id).eq("telefone", telefone).maybeSingle();
    if (!cliente) return Response.json({ error: "Nenhum cliente público encontrado para este WhatsApp." }, { status: 404 });
    const codigo = novoCodigo();
    const { error } = await admin.from("clientes_publicos").update({ codigo_acesso: codigo, updated_at: new Date().toISOString() }).eq("id", cliente.id);
    if (error) throw error;
    return Response.json({ nome: cliente.nome, codigo });
  } catch { return Response.json({ error: "Não foi possível redefinir o acesso." }, { status: 500 }); }
}
