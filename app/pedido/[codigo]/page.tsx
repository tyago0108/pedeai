import { AcompanharPedido } from "@/components/pedido/acompanhar-pedido";

export default async function PedidoPage({ params }: PageProps<"/pedido/[codigo]">) { const { codigo } = await params; return <AcompanharPedido codigo={codigo} />; }
