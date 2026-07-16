import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { slug, telefone, codigo } = await request.json();
  const telefoneLimpo = String(telefone ?? "").replace(/\D/g, "");
  const codigoLimpo = String(codigo ?? "").trim().toUpperCase();
  if (typeof slug !== "string" || telefoneLimpo.length < 10 || !/^[A-Z0-9]{6}$/.test(codigoLimpo)) return Response.json({ error: "Informe WhatsApp e seu código de acesso." }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data: empresa } = await admin.from("empresas").select("id").eq("slug", slug).maybeSingle();
  if (!empresa) return Response.json({ error: "Restaurante não encontrado." }, { status: 404 });
  const { data: cliente } = await admin.from("clientes_publicos").select("id").eq("empresa_id", empresa.id).eq("telefone", telefoneLimpo).eq("codigo_acesso", codigoLimpo).maybeSingle();
  if (!cliente) return Response.json({ error: "WhatsApp ou código não conferem." }, { status: 403 });
  const { data, error } = await admin.from("pedidos").select("codigo_acompanhamento, status, total, created_at").eq("empresa_id", empresa.id).eq("cliente_publico_id", cliente.id).order("created_at", { ascending: false }).limit(20);
  if (error) return Response.json({ error: "Não foi possível consultar os pedidos." }, { status: 500 });
  return Response.json((data ?? []).map((pedido) => ({ ...pedido, total: Number(pedido.total) })));
}
