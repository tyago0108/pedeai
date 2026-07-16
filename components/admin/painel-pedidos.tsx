"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Pedido = { id: string; cliente_nome: string; cliente_telefone: string | null; tipo_entrega: string; status: string; pagamento: string; total: number; created_at: string };
type Produto = { id: string; nome: string; preco: number };
type ItemManual = Produto & { quantidade: number };

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const rotulos: Record<string, string> = { recebido: "Recebido", preparando: "Preparando", saiu_para_entrega: "Saiu para entrega", entregue: "Entregue", cancelado: "Cancelado" };

export function PainelPedidos() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mostrarBalcao, setMostrarBalcao] = useState(false);
  const [cliente, setCliente] = useState("Cliente balcão");
  const [telefone, setTelefone] = useState("");
  const [pagamento, setPagamento] = useState("Dinheiro");
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [itens, setItens] = useState<ItemManual[]>([]);
  const [salvando, setSalvando] = useState(false);

  const totalManual = useMemo(() => itens.reduce((total, item) => total + item.preco * item.quantidade, 0), [itens]);
  const pedidosAbertos = pedidos.filter((pedido) => !["entregue", "cancelado"].includes(pedido.status)).length;

  async function carregar(mostrarCarregando = true) {
    if (mostrarCarregando) setCarregando(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/restaurante/login"); return; }

    const { data: perfil, error: perfilError } = await supabase.from("perfis").select("empresa_id").single();
    if (perfilError || !perfil) {
      setErro("Este usuário não está vinculado a um restaurante.");
      setCarregando(false);
      return;
    }

    setEmpresaId(perfil.empresa_id);
    const [pedidosResposta, produtosResposta] = await Promise.all([
      supabase.from("pedidos").select("id, cliente_nome, cliente_telefone, tipo_entrega, status, pagamento, total, created_at").eq("empresa_id", perfil.empresa_id).order("created_at", { ascending: false }),
      supabase.from("produtos").select("id, nome, preco").eq("empresa_id", perfil.empresa_id).eq("disponivel", true).order("nome"),
    ]);

    if (pedidosResposta.error) setErro("Não foi possível carregar os pedidos.");
    else setPedidos((pedidosResposta.data ?? []).map((pedido) => ({ ...pedido, total: Number(pedido.total) })));
    setProdutos((produtosResposta.data ?? []).map((produto) => ({ ...produto, preco: Number(produto.preco) })));
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    const atualizacao = window.setInterval(() => carregar(false), 15000);
    const canal = supabase.channel("pedidos-restaurante").on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => carregar(false)).subscribe();
    return () => { window.clearInterval(atualizacao); supabase.removeChannel(canal); };
  }, []);

  async function atualizarStatus(id: string, status: string) {
    const { error } = await supabase.from("pedidos").update({ status }).eq("id", id);
    if (error) setErro("Não foi possível atualizar o pedido.");
    else setPedidos((atual) => atual.map((pedido) => pedido.id === id ? { ...pedido, status } : pedido));
  }

  function adicionarItem() {
    const produto = produtos.find((item) => item.id === produtoSelecionado);
    if (!produto) return;
    setItens((atual) => {
      const existente = atual.find((item) => item.id === produto.id);
      return existente ? atual.map((item) => item.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item) : [...atual, { ...produto, quantidade: 1 }];
    });
    setProdutoSelecionado("");
  }

  async function criarPedidoBalcao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!empresaId || !itens.length) return setErro("Adicione pelo menos um item ao pedido de balcão.");
    setSalvando(true); setErro("");
    const { data: pedido, error: pedidoError } = await supabase.from("pedidos").insert({ empresa_id: empresaId, cliente_nome: cliente || "Cliente balcão", cliente_telefone: telefone || null, tipo_entrega: "local", status: "recebido", pagamento, total: totalManual }).select("id").single();
    if (pedidoError || !pedido) { setSalvando(false); return setErro("Não foi possível registrar o pedido de balcão."); }
    const { error: itensError } = await supabase.from("itens_pedido").insert(itens.map((item) => ({ pedido_id: pedido.id, produto_id: item.id, nome_produto: item.nome, quantidade: item.quantidade, preco_unitario: item.preco })));
    setSalvando(false);
    if (itensError) return setErro("Pedido criado, mas houve erro ao salvar os itens.");
    setItens([]); setCliente("Cliente balcão"); setTelefone(""); setMostrarBalcao(false); carregar(false);
  }

  async function sair() { await supabase.auth.signOut(); router.replace("/"); }

  if (carregando) return <main className="grid min-h-screen place-items-center bg-stone-50 text-stone-700">Carregando central de pedidos...</main>;
  return <main className="min-h-screen bg-stone-50 pb-24 text-stone-900">
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-orange-500">PedeAI · Restaurante</p><h1 className="text-xl font-bold">Pedidos</h1></div><button onClick={() => setMostrarBalcao(true)} className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-white">+ Balcão</button></div></header>
    <section className="mx-auto max-w-5xl px-4 py-5">
      <div className="grid grid-cols-2 gap-3"><article className="rounded-2xl bg-stone-900 p-4 text-white"><p className="text-xs text-stone-300">Em andamento</p><p className="mt-1 text-3xl font-bold">{pedidosAbertos}</p></article><article className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-stone-500">Hoje</p><p className="mt-1 text-3xl font-bold">{pedidos.length}</p></article></div>
      <div className="mt-5 flex items-center justify-between"><h2 className="text-lg font-bold">Fila de pedidos</h2><button onClick={() => carregar(false)} className="text-sm font-bold text-orange-600">Atualizar</button></div>
      {erro && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      <div className="mt-3 grid gap-3 md:grid-cols-2">{pedidos.length === 0 ? <p className="rounded-2xl bg-white p-5 text-sm text-stone-500 shadow-sm">Nenhum pedido ainda. Use “Balcão” para registrar uma venda manual ou compartilhe seu cardápio.</p> : pedidos.map((pedido) => <article key={pedido.id} className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{pedido.cliente_nome}</p><p className="text-xs text-stone-500">{new Date(pedido.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {pedido.tipo_entrega === "local" ? "Balcão" : "Entrega"} · {pedido.pagamento}</p></div><p className="font-bold text-orange-600">{moeda.format(pedido.total)}</p></div><select value={pedido.status} onChange={(event) => atualizarStatus(pedido.id, event.target.value)} className="mt-4 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-semibold"><option value="recebido">Recebido</option><option value="preparando">Preparando</option><option value="saiu_para_entrega">Saiu para entrega</option><option value="entregue">Entregue</option><option value="cancelado">Cancelado</option></select></article>)}</div>
    </section>
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white"><div className="mx-auto grid max-w-5xl grid-cols-4"><Link href="/" className="p-3 text-center text-xs font-semibold text-stone-600">Início</Link><Link href="/restaurante" className="p-3 text-center text-xs font-semibold text-stone-600">Painel</Link><Link href="/restaurante/cardapio" className="p-3 text-center text-xs font-semibold text-stone-600">Cardápio</Link><button onClick={sair} className="p-3 text-center text-xs font-semibold text-red-600">Sair</button></div></nav>
    {mostrarBalcao && <div className="fixed inset-0 z-30 overflow-y-auto bg-stone-950/50 p-4"><form onSubmit={criarPedidoBalcao} className="mx-auto my-5 max-w-lg rounded-3xl bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Novo pedido de balcão</h2><button type="button" onClick={() => setMostrarBalcao(false)} className="text-sm font-bold text-stone-500">Fechar</button></div><div className="mt-4 space-y-3"><input value={cliente} onChange={(event) => setCliente(event.target.value)} placeholder="Nome do cliente" className="campo"/><input value={telefone} onChange={(event) => setTelefone(event.target.value)} placeholder="Telefone (opcional)" className="campo"/><select value={pagamento} onChange={(event) => setPagamento(event.target.value)} className="campo"><option>Dinheiro</option><option>Cartão</option><option>Pix</option></select><div className="flex gap-2"><select value={produtoSelecionado} onChange={(event) => setProdutoSelecionado(event.target.value)} className="campo"><option value="">Escolha um produto</option>{produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.nome} · {moeda.format(produto.preco)}</option>)}</select><button type="button" onClick={adicionarItem} className="rounded-xl bg-stone-900 px-4 font-bold text-white">Adicionar</button></div></div><div className="mt-4 space-y-2">{itens.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-xl bg-stone-50 p-3 text-sm"><span className="flex-1 font-medium">{item.quantidade}x {item.nome}</span><button type="button" onClick={() => setItens((atual) => atual.map((atualItem) => atualItem.id === item.id ? { ...atualItem, quantidade: atualItem.quantidade - 1 } : atualItem).filter((atualItem) => atualItem.quantidade > 0))} className="rounded-lg px-2 py-1 text-orange-600">−</button><span>{moeda.format(item.preco * item.quantidade)}</span></div>)}</div><div className="mt-5 flex items-center justify-between border-t pt-4"><strong>Total: {moeda.format(totalManual)}</strong><button disabled={salvando || !itens.length} className="rounded-xl bg-orange-500 px-4 py-3 font-bold text-white disabled:opacity-50">{salvando ? "Salvando..." : "Salvar pedido"}</button></div></form></div>}
  </main>;
}
