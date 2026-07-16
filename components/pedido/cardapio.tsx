"use client";

import { FormEvent, useMemo, useState } from "react";
import type { ItemCarrinho, Loja, Produto } from "@/types/pedeai";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function Cardapio({ loja, produtos }: { loja: Loja; produtos: Produto[] }) {
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pagamento, setPagamento] = useState("Pix");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const total = useMemo(() => carrinho.reduce((soma, item) => soma + item.preco * item.quantidade, 0), [carrinho]);

  function adicionar(produto: Produto) {
    setCarrinho((atual) => {
      const encontrado = atual.find((item) => item.id === produto.id);
      if (encontrado) return atual.map((item) => item.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item);
      return [...atual, { ...produto, quantidade: 1 }];
    });
  }

  function alterarQuantidade(id: string, delta: number) {
    setCarrinho((atual) => atual.flatMap((item) => {
      if (item.id !== id) return [item];
      const quantidade = item.quantidade + delta;
      return quantidade > 0 ? [{ ...item, quantidade }] : [];
    }));
  }

  async function finalizar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");
    setEnviando(true);
    const resposta = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresaId: loja.id, nome, telefone, pagamento, observacao,
        itens: carrinho.map((item) => ({ produtoId: item.id, quantidade: item.quantidade })),
      }),
    });
    const resultado = await resposta.json();
    setEnviando(false);
    if (!resposta.ok) return setMensagem(resultado.error ?? "Não foi possível enviar o pedido.");
    setMensagem("Pedido enviado! A lanchonete vai confirmar pelo WhatsApp.");
    setCarrinho([]);
  }

  return <main className="mx-auto min-h-screen max-w-2xl bg-stone-50 px-4 py-8 text-stone-900">
    <header className="mb-8 rounded-3xl bg-orange-500 p-6 text-white shadow-sm"><p className="text-sm font-semibold uppercase tracking-widest text-orange-100">PedeAI</p><h1 className="mt-1 text-3xl font-bold">{loja.nome}</h1><p className="mt-2 text-orange-50">Faça seu pedido sem sair do WhatsApp.</p></header>
    <section><h2 className="mb-4 text-xl font-bold">Cardápio</h2><div className="space-y-3">{produtos.map((produto) => <article key={produto.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-2xl">🍔</div><div className="min-w-0 flex-1"><h3 className="font-bold">{produto.nome}</h3>{produto.descricao && <p className="mt-1 text-sm text-stone-500">{produto.descricao}</p>}<p className="mt-2 font-semibold text-orange-600">{moeda.format(produto.preco)}</p></div><button onClick={() => adicionar(produto)} className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-bold text-white">Adicionar</button></article>)}</div></section>
    <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Seu pedido</h2>{carrinho.length === 0 ? <p className="mt-3 text-stone-500">Escolha os itens do cardápio.</p> : <form onSubmit={finalizar} className="mt-4 space-y-4">{carrinho.map((item) => <div key={item.id} className="flex items-center justify-between border-b border-stone-100 pb-3"><div><p className="font-semibold">{item.nome}</p><p className="text-sm text-stone-500">{moeda.format(item.preco)} cada</p></div><div className="flex items-center gap-3"><button type="button" onClick={() => alterarQuantidade(item.id, -1)} className="h-8 w-8 rounded-full bg-stone-100 font-bold">−</button><span className="font-bold">{item.quantidade}</span><button type="button" onClick={() => alterarQuantidade(item.id, 1)} className="h-8 w-8 rounded-full bg-stone-100 font-bold">+</button></div></div>)}<div className="flex justify-between text-lg font-bold"><span>Total</span><span>{moeda.format(total)}</span></div><input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="w-full rounded-xl border border-stone-200 px-4 py-3" /><input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Seu WhatsApp (opcional)" className="w-full rounded-xl border border-stone-200 px-4 py-3" /><select value={pagamento} onChange={(e) => setPagamento(e.target.value)} className="w-full rounded-xl border border-stone-200 px-4 py-3"><option>Pix</option><option>Dinheiro</option><option>Cartão</option></select><textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Observação do pedido (opcional)" className="w-full rounded-xl border border-stone-200 px-4 py-3" rows={3} />{mensagem && <p role="status" className="rounded-xl bg-orange-50 p-3 text-sm font-medium text-orange-800">{mensagem}</p>}<button disabled={enviando} className="w-full rounded-xl bg-orange-500 px-4 py-3 font-bold text-white disabled:opacity-60">{enviando ? "Enviando..." : "Enviar pedido"}</button></form>}</section>
  </main>;
}
