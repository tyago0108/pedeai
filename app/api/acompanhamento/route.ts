import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const codigo = new URL(request.url).searchParams.get("codigo");
  if (!codigo) return Response.json({ error: "Código inválido." }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data: pedido, error } = await admin.from("pedidos").select("id, cliente_nome, status, total, created_at, tipo_atendimento, codigo_retirada, empresas(nome, tempo_entrega_minutos)").eq("codigo_acompanhamento", codigo).maybeSingle();
  if (error || !pedido) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
  return Response.json({ ...pedido, total: Number(pedido.total) });
}
