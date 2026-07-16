import { HistoricoPedidos } from "@/components/pedido/historico-pedidos";
export default async function MeusPedidosPage({ params }: PageProps<"/[slug]/meus-pedidos">) { const { slug } = await params; return <HistoricoPedidos slug={slug} />; }
