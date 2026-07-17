import { requirePlatformAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin(request);
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    const hoje = agora.toISOString().slice(0, 10);
    const [empresas, pedidos] = await Promise.all([
      admin.from("empresas").select("id,ativo,bloqueada,pendente_aprovacao,modo_operacao"),
      admin.from("pedidos").select("id,total").gte("created_at", inicioHoje),
    ]);
    if (empresas.error || pedidos.error) throw empresas.error ?? pedidos.error;
    // Financeiro e suporte são recursos incrementais. Eles não podem impedir
    // a exibição dos restaurantes e dos pedidos existentes.
    const [pagamentos, assinaturas, chamados] = await Promise.all([
      admin.from("pagamentos_plataforma").select("valor").eq("status", "confirmado").gte("pago_em", inicioMes),
      admin.from("assinaturas_restaurante").select("empresa_id,status,vencimento_em,bloqueio_automatico"),
      admin.from("chamados_suporte").select("id", { count: "exact", head: true }).in("status", ["aberto", "em_atendimento"]),
    ]);
    const lista = empresas.data ?? [];
    const vencidas = (assinaturas.data ?? []).filter((assinatura) => Boolean(assinatura.vencimento_em) && assinatura.vencimento_em! < hoje && ["ativo", "teste", "inadimplente"].includes(assinatura.status));
    return Response.json({
      restaurantes: {
        ativos: lista.filter((empresa) => empresa.ativo && !empresa.bloqueada).length,
        pausados: lista.filter((empresa) => empresa.modo_operacao === "pausado" && !empresa.bloqueada).length,
        bloqueados: lista.filter((empresa) => empresa.bloqueada).length,
        aguardandoAprovacao: lista.filter((empresa) => empresa.pendente_aprovacao).length,
      },
      pedidosHoje: (pedidos.data ?? []).length,
      volumePedidosHoje: (pedidos.data ?? []).reduce((soma, pedido) => soma + Number(pedido.total), 0),
      faturamentoPlataformaMes: (pagamentos.data ?? []).reduce((soma, pagamento) => soma + Number(pagamento.valor), 0),
      alertas: { assinaturasVencidas: vencidas.length, bloqueioAutomaticoPendente: vencidas.filter((assinatura) => assinatura.bloqueio_automatico).length, chamadosAbertos: chamados.count ?? 0 },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível carregar o resumo." }, { status: 403 });
  }
}
