import { notFound } from "next/navigation";
import { Cardapio } from "@/components/pedido/cardapio";
import { supabase } from "@/lib/supabase/client";
import type { Loja, Produto } from "@/types/pedeai";
import { verificarFuncionamento } from "@/lib/operacao";
import { RestauranteIndisponivel } from "@/components/pedido/indisponivel";

export async function LojaPublica({ slug }: { slug: string }) {
  const { data: loja } = await supabase.from("empresas").select("id, nome, slug, whatsapp, logo_url, ativo, bloqueada, modo_operacao, agenda_funcionamento, mensagem_pausa").eq("slug", slug).single();
  if (!loja) notFound();

  const { data: produtos } = await supabase.from("produtos").select("id, nome, descricao, preco, disponivel, imagem_url, categorias(nome)").eq("empresa_id", loja.id).eq("disponivel", true).order("created_at");
  const cardapio: Produto[] = (produtos ?? []).map((produto) => {
    const relacaoCategoria = produto.categorias as { nome?: string } | { nome?: string }[] | null;
    const categoria = Array.isArray(relacaoCategoria) ? relacaoCategoria[0]?.nome : relacaoCategoria?.nome;
    return { ...produto, preco: Number(produto.preco), categoria: categoria ?? null };
  });

  const funcionamento = verificarFuncionamento(loja);
  if (!funcionamento.aberto) return <RestauranteIndisponivel nome={loja.nome} slug={loja.slug} mensagem={funcionamento.mensagem} />;
  return <Cardapio loja={loja as Loja} produtos={cardapio} funcionamento={funcionamento} />;
}
