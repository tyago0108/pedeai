import { requirePlatformAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin(request);
    const url = new URL(request.url);
    const busca = url.searchParams.get("busca")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";
    const empresaId = url.searchParams.get("empresaId")?.trim() ?? "";
    const dataInicial = url.searchParams.get("de")?.trim() ?? "";
    const dataFinal = url.searchParams.get("ate")?.trim() ?? "";
    let consulta = admin.from("pedidos")
      .select("id,numero_pedido,cliente_nome,cliente_telefone,status,pagamento,pago,total,created_at,tipo_atendimento,empresas(nome,slug)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status) consulta = consulta.eq("status", status);
    if (empresaId) consulta = consulta.eq("empresa_id", empresaId);
    if (dataInicial) consulta = consulta.gte("created_at", `${dataInicial}T00:00:00.000Z`);
    if (dataFinal) consulta = consulta.lte("created_at", `${dataFinal}T23:59:59.999Z`);
    if (busca) {
      const numero = Number(busca.replace(/\D/g, ""));
      const termo = busca.replace(/[(),]/g, " ").trim();
      consulta = Number.isFinite(numero) && numero > 0
        ? consulta.or(`numero_pedido.eq.${numero},cliente_nome.ilike.%${termo}%,cliente_telefone.ilike.%${termo}%`)
        : consulta.or(`cliente_nome.ilike.%${termo}%,cliente_telefone.ilike.%${termo}%`);
    }
    const { data, error } = await consulta;
    if (error) throw error;
    return Response.json((data ?? []).map((pedido) => ({ ...pedido, total: Number(pedido.total) })));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível consultar os pedidos." }, { status: 403 });
  }
}
