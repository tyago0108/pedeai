import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { slug, telefone } = await request.json();
  if (typeof slug !== "string" || typeof telefone !== "string" || telefone.trim().length < 8) return Response.json({ error: "Informe seu WhatsApp." }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data: empresa } = await admin.from("empresas").select("id").eq("slug", slug).maybeSingle();
  if (!empresa) return Response.json({ error: "Restaurante não encontrado." }, { status: 404 });
  const { data, error } = await admin.from("pedidos").select("codigo_acompanhamento, status, total, created_at").eq("empresa_id", empresa.id).eq("cliente_telefone", telefone.trim()).order("created_at", { ascending: false }).limit(20);
  if (error) return Response.json({ error: "Não foi possível consultar os pedidos." }, { status: 500 });
  return Response.json((data ?? []).map((pedido) => ({ ...pedido, total: Number(pedido.total) })));
}
