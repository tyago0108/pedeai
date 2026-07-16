import { getSupabaseAdmin } from "@/lib/supabase/server";

function telefoneLimpo(valor: unknown) { return String(valor ?? "").replace(/\D/g, ""); }

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const slug = String(body.slug ?? "").trim();
    const acao = String(body.acao ?? "entrar");
    const telefone = telefoneLimpo(body.telefone);
    const codigo = String(body.codigo ?? "").trim().toUpperCase();
    if (!slug || telefone.length < 10) return Response.json({ error: "Informe seu WhatsApp." }, { status: 400 });
    const admin = getSupabaseAdmin();
    const { data: empresa } = await admin.from("empresas").select("id").eq("slug", slug).eq("ativo", true).maybeSingle();
    if (!empresa) return Response.json({ error: "Restaurante não encontrado." }, { status: 404 });
    if (!/^[A-Z0-9]{6}$/.test(codigo)) return Response.json({ error: "Informe o código de 6 caracteres." }, { status: 400 });
    const { data: cliente } = await admin.from("clientes_publicos").select("id,nome").eq("empresa_id", empresa.id).eq("telefone", telefone).eq("codigo_acesso", codigo).maybeSingle();
    if (!cliente) return Response.json({ error: "WhatsApp ou código não conferem para este restaurante." }, { status: 403 });
    if (acao === "alterar-codigo") {
      const novoCodigo = String(body.novoCodigo ?? "").trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(novoCodigo)) return Response.json({ error: "O novo código precisa ter 6 letras ou números." }, { status: 400 });
      const { error } = await admin.from("clientes_publicos").update({ codigo_acesso: novoCodigo, updated_at: new Date().toISOString() }).eq("id", cliente.id);
      if (error) return Response.json({ error: "Este código já está em uso. Escolha outro." }, { status: 409 });
      return Response.json({ ok: true });
    }
    const { data: enderecos, error } = await admin.from("enderecos_publicos").select("*").eq("cliente_publico_id", cliente.id).order("principal", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ cliente, enderecos: enderecos ?? [] });
  } catch { return Response.json({ error: "Não foi possível acessar seus dados." }, { status: 500 }); }
}
