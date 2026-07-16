import { LojaPublica } from "@/components/pedido/loja-publica";

export const dynamic = "force-dynamic";

export default async function CardapioCurtoPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  return <LojaPublica slug={slug} />;
}
