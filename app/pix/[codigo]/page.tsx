import { redirect } from "next/navigation";

// Compatibilidade para links antigos: o Pix agora fica na tela de acompanhamento.
export default async function PixLegado({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  redirect(`/pedido/${codigo}`);
}
