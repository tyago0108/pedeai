import { notFound } from "next/navigation";
import { Cardapio } from "@/components/pedido/cardapio";
import { supabase } from "@/lib/supabase/client";
import type { Loja, Produto } from "@/types/pedeai";

export async function LojaPublica({ slug }: { slug: string }) {
  const { data: loja } = await supabase.from("empresas").select("id, nome, slug, whatsapp, logo_url").eq("slug", slug).single();
  if (!loja) notFound();

  const { data: produtos } = await supabase.from("produtos").select("id, nome, descricao, preco, disponivel, imagem_url, categorias(nome)").eq("empresa_id", loja.id).eq("disponivel", true).order("created_at");
  const cardapio: Produto[] = (produtos ?? []).map((produto) => {
    const relacaoCategoria = produto.categorias as { nome?: string } | { nome?: string }[] | null;
    const categoria = Array.isArray(relacaoCategoria) ? relacaoCategoria[0]?.nome : relacaoCategoria?.nome;
    return { ...produto, preco: Number(produto.preco), categoria: categoria ?? null };
  });

  return <Cardapio loja={loja as Loja} produtos={cardapio} />;
}
