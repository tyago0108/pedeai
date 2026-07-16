"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Pedido = { id: string; cliente_nome: string; cliente_telefone: string | null; tipo_entrega: string; status: string; pagamento: string; total: number; created_at: string; codigo_retirada?: string; endereco_entrega?: string | null };
type Produto = { id: string; nome: string; preco: number };
type ItemManual = Produto & { quantidade: number };

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const etapas = ["recebido", "preparando", "saiu_para_entrega", "entregue"];
const rotulos: Record<string, string> = { recebido: "Novo pedido", preparando: "Em produção", saiu_para_entrega: "Saiu para entrega", entregue: "Entregue", cancelado: "Cancelado" };

function dentroDoPeriodo(data: string, inicio: Date) { return new Date(data).getTime() >= inicio.getTime(); }
function tempoDecorrido(data: string, agora: number) {
  const minutos = Math.max(0, Math.floor((agora - new Date(data).getTime()) / 60000));
  return minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)}h ${minutos % 60}min`;
}

export function PainelPedidos() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mostrarBalcao, setMostrarBalcao] = useState(false);
  const [pedidoParaAdicionar, setPedidoParaAdicionar] = useState<string | null>(null);
  const [cliente, setCliente] = useState("Cliente balcão");
  const [telefone, setTelefone] = useState("");
  const [pagamento, setPagamento] = useState("Dinheiro");
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [itens, setItens] = useState<ItemManual[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [agora, setAgora] = useState(Date.now());

  const totalManual = useMemo(() => itens.reduce((total, item) => total + item.preco * item.quantidade, 0), [itens]);
  const validos = pedidos.filter((pedido) => pedido.status !== "cancelado");
  const inicioHoje = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const inicioSemana = useMemo(() => { const d = new Date(inicioHoje); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }, [inicioHoje]);
  const inicioMes = useMemo(() => new Date(inicioHoje.getFullYear(), inicioHoje.getMonth(), 1), [inicioHoje]);
  const inicioAno = useMemo(() => new Date(inicioHoje.getFullYear(), 0, 1), [inicioHoje]);
  const faturamento = (inicio: Date) => validos.filter((pedido) => dentroDoPeriodo(pedido.created_at, inicio)).reduce((soma, pedido) => soma + pedido.total, 0);
  const pedidosAbertos = pedidos.filter((pedido) => !["entregue", "cancelado"].includes(pedido.status)).length;

  async function carregar(mostrarCarregando = true) {
    if (mostrarCarregando) setCarregando(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/restaurante/login"); return; }
    const { data: perfil, error: perfilError } = await supabase.from("perfis").select("empresa_id").single();
    if (perfilError || !perfil) { setErro("Este usuário não está vinculado a um restaurante."); setCarregando(false); return; }
    setEmpresaId(perfil.empresa_id);
    const [pedidosResposta, produtosResposta] = await Promise.all([
      supabase.from("pedidos").select("id, cliente_nome, cliente_telefone, tipo_entrega, status, pagamento, total, created_at, codigo_retirada, endereco_entrega").eq("empresa_id", perfil.empresa_id).order("created_at", { ascending: false }),
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
    const relogio = window.setInterval(() => setAgora(Date.now()), 30000);
    const canal = supabase.channel("pedidos-restaurante").on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => carregar(false)).subscribe();
    return () => { window.clearInterval(atualizacao); window.clearInterval(relogio); supabase.removeChannel(canal); };
  }, []);

  async function atualizarStatus(id: string, status: string) {
    const { error } = await supabase.from("pedidos").update({ status }).eq("id", id);
    if (error) setErro("Não foi possível atualizar o pedido.");
    else setPedidos((atual) => atual.map((pedido) => pedido.id === id ? { ...pedido, status } : pedido));
  }
  function adicionarItem() {
    const produto = produtos.find((item) => item.id === produtoSelecionado);
    if (!produto) return;
    setItens((atual) => { const existente = atual.find((item) => item.id === produto.id); return existente ? atual.map((item) => item.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item) : [...atual, { ...produto, quantidade: 1 }]; });
    setProdutoSelecionado("");
  }
  function removerItem(id: string) { setItens((atual) => atual.map((item) => item.id === id ? { ...item, quantidade: item.quantidade - 1 } : item).filter((item) => item.quantidade > 0)); }
  function limparItens() { setItens([]); setProdutoSelecionado(""); }

  async function salvarItensNoPedido(pedidoId: string) {
    if (!itens.length) return setErro("Adicione pelo menos um item.");
    setSalvando(true); setErro("");
    const pedido = pedidos.find((item) => item.id === pedidoId);
    const { error: itensError } = await supabase.from("itens_pedido").insert(itens.map((item) => ({ pedido_id: pedidoId, produto_id: item.id, nome_produto: item.nome, quantidade: item.quantidade, preco_unitario: item.preco })));
    if (!itensError && pedido) await supabase.from("pedidos").update({ total: pedido.total + totalManual }).eq("id", pedidoId);
    setSalvando(false);
    if (itensError) return setErro("Não foi possível incluir os itens. Execute a atualização SQL 008 antes de tentar novamente.");
    limparItens(); setPedidoParaAdicionar(null); carregar(false);
  }
  async function criarPedidoBalcao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!empresaId || !itens.length) return setErro("Adicione pelo menos um item ao pedido de balcão.");
    setSalvando(true); setErro("");
    const { data: pedido, error: pedidoError } = await supabase.from("pedidos").insert({ empresa_id: empresaId, cliente_nome: cliente || "Cliente balcão", cliente_telefone: telefone || null, tipo_entrega: "local", status: "recebido", pagamento, total: totalManual }).select("id").single();
    if (pedidoError || !pedido) { setSalvando(false); return setErro("Não foi possível registrar o pedido de balcão."); }
    const { error: itensError } = await supabase.from("itens_pedido").insert(itens.map((item) => ({ pedido_id: pedido.id, produto_id: item.id, nome_produto: item.nome, quantidade: item.quantidade, preco_unitario: item.preco })));
    setSalvando(false); if (itensError) return setErro("Pedido criado, mas houve erro ao salvar os itens.");
    limparItens(); setCliente("Cliente balcão"); setTelefone(""); setMostrarBalcao(false); carregar(false);
  }
  function imprimir(pedido: Pedido) {
    const janela = window.open("", "_blank", "width=420,height=650");
    if (!janela) return;
    janela.document.write(`<html><head><title>Pedido</title><style>body{font-family:Arial;padding:20px}h1{font-size:22px}p{margin:8px 0}.code{font-size:22px;font-weight:bold;letter-spacing:3px}</style></head><body><h1>Pedido PedeAI</h1><p><b>Cliente:</b> ${pedido.cliente_nome}</p><p><b>Atendimento:</b> ${pedido.tipo_entrega === "local" ? "Balcão/retirada" : "Entrega"}</p>${pedido.endereco_entrega ? `<p><b>Endereço:</b> ${pedido.endereco_entrega}</p>` : ""}<p><b>Pagamento:</b> ${pedido.pagamento}</p><p><b>Status:</b> ${rotulos[pedido.status]}</p><p><b>Total:</b> ${moeda.format(pedido.total)}</p>${pedido.codigo_retirada ? `<p class="code">${pedido.codigo_retirada}</p>` : ""}<p>${new Date(pedido.created_at).toLocaleString("pt-BR")}</p><script>window.onload=()=>window.print()<\/script></body></html>`);
    janela.document.close();
  }
  async function sair() { await supabase.auth.signOut(); router.replace("/entrar"); }

  if (carregando) return <main className="grid min-h-screen place-items-center bg-stone-50 text-stone-700">Carregando central de pedidos...</main>;
  const resumo = [["Em andamento", String(pedidosAbertos), "bg-stone-900 text-white"], ["Hoje", moeda.format(faturamento(inicioHoje)), "bg-white"], ["Semana", moeda.format(faturamento(inicioSemana)), "bg-white"], ["Mês", moeda.format(faturamento(inicioMes)), "bg-white"], ["Ano", moeda.format(faturamento(inicioAno)), "bg-white"]];
  return <main className="min-h-screen bg-stone-50 pb-24 text-stone-900"><header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-orange-500">PedeAI · Operação</p><h1 className="text-xl font-bold">Central de pedidos</h1></div><button onClick={() => { limparItens(); setMostrarBalcao(true); }} className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-white">+ Pedido balcão</button></div></header><section className="mx-auto max-w-7xl px-4 py-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{resumo.map(([titulo, valor, estilo]) => <article key={titulo} className={`rounded-2xl p-4 shadow-sm ${estilo}`}><p className="text-xs opacity-70">{titulo}</p><p className="mt-1 text-xl font-bold">{valor}</p></article>)}</div><div className="mt-5 flex items-center justify-between"><div><h2 className="text-lg font-bold">Mosaico ao vivo</h2><p className="text-xs text-stone-500">Cronômetros atualizados a cada 30 segundos.</p></div><button onClick={() => carregar(false)} className="text-sm font-bold text-orange-600">Atualizar</button></div>{erro && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}<div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{pedidos.length === 0 ? <p className="rounded-2xl bg-white p-5 text-sm text-stone-500 shadow-sm">Nenhum pedido ainda. Registre uma venda de balcão ou compartilhe seu cardápio.</p> : pedidos.map((pedido) => <article key={pedido.id} className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{pedido.cliente_nome}</p><p className="text-xs text-stone-500">{pedido.tipo_entrega === "local" ? "Balcão/retirada" : "Entrega"} · {pedido.pagamento}</p></div><p className="text-right font-bold text-orange-600">{moeda.format(pedido.total)}<span className="mt-1 block text-xs font-medium text-stone-500">há {tempoDecorrido(pedido.created_at, agora)}</span></p></div>{pedido.endereco_entrega && <p className="mt-3 rounded-xl bg-stone-50 p-2 text-xs text-stone-700"><strong>Entregar em:</strong> {pedido.endereco_entrega}</p>}<div className="mt-3 flex gap-1">{etapas.map((etapa) => <span key={etapa} className={`h-1.5 flex-1 rounded-full ${etapas.indexOf(etapa) <= etapas.indexOf(pedido.status) ? "bg-orange-500" : "bg-stone-200"}`} />)}</div><p className="mt-2 text-xs font-bold text-stone-600">{rotulos[pedido.status] ?? pedido.status}</p>{pedido.codigo_retirada && <p className="mt-3 rounded-xl bg-orange-50 p-2 text-center text-xs font-bold text-orange-800">Código de entrega: <span className="ml-1 tracking-widest">{pedido.codigo_retirada}</span></p>}<div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => { limparItens(); setPedidoParaAdicionar(pedido.id); }} disabled={["entregue", "cancelado"].includes(pedido.status)} className="rounded-xl border border-stone-200 px-2 py-2 text-xs font-bold disabled:opacity-40">+ Itens</button><button onClick={() => imprimir(pedido)} className="rounded-xl border border-stone-200 px-2 py-2 text-xs font-bold">Imprimir</button></div><select value={pedido.status} onChange={(event) => atualizarStatus(pedido.id, event.target.value)} className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-semibold"><option value="recebido">Recebido</option><option value="preparando">Em produção</option><option value="saiu_para_entrega">Saiu para entrega</option><option value="entregue">Entregue</option><option value="cancelado">Cancelado</option></select></article>)}</div></section><nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white md:sticky md:top-0 md:bottom-auto md:border-b"><div className="mx-auto grid max-w-5xl grid-cols-4 md:flex md:justify-end"><Link href="/restaurante" className="p-3 text-center text-xs font-semibold text-stone-600 md:px-5">Painel</Link><Link href="/restaurante/pedidos" className="p-3 text-center text-xs font-semibold text-stone-600 md:px-5">Pedidos</Link><Link href="/restaurante/cardapio" className="p-3 text-center text-xs font-semibold text-stone-600 md:px-5">Cardápio</Link><button onClick={sair} className="p-3 text-center text-xs font-semibold text-red-600 md:px-5">Sair</button></div></nav>{(mostrarBalcao || pedidoParaAdicionar) && <div className="fixed inset-0 z-30 overflow-y-auto bg-stone-950/50 p-4"><form onSubmit={(event) => pedidoParaAdicionar ? (event.preventDefault(), salvarItensNoPedido(pedidoParaAdicionar)) : criarPedidoBalcao(event)} className="mx-auto my-5 max-w-lg rounded-3xl bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">{pedidoParaAdicionar ? "Adicionar itens ao pedido" : "Novo pedido de balcão"}</h2><button type="button" onClick={() => { setMostrarBalcao(false); setPedidoParaAdicionar(null); limparItens(); }} className="text-sm font-bold text-stone-500">Fechar</button></div>{!pedidoParaAdicionar && <div className="mt-4 space-y-3"><input value={cliente} onChange={(event) => setCliente(event.target.value)} placeholder="Nome do cliente" className="campo"/><input value={telefone} onChange={(event) => setTelefone(event.target.value)} placeholder="Telefone (opcional)" className="campo"/><select value={pagamento} onChange={(event) => setPagamento(event.target.value)} className="campo"><option>Dinheiro</option><option>Cartão</option><option>Pix</option></select></div>}<div className="mt-4 flex gap-2"><select value={produtoSelecionado} onChange={(event) => setProdutoSelecionado(event.target.value)} className="campo"><option value="">Escolha um produto</option>{produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.nome} · {moeda.format(produto.preco)}</option>)}</select><button type="button" onClick={adicionarItem} className="rounded-xl bg-stone-900 px-4 font-bold text-white">Adicionar</button></div><div className="mt-4 space-y-2">{itens.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-xl bg-stone-50 p-3 text-sm"><span className="flex-1 font-medium">{item.quantidade}x {item.nome}</span><button type="button" onClick={() => removerItem(item.id)} className="rounded-lg px-2 py-1 text-orange-600">−</button><span>{moeda.format(item.preco * item.quantidade)}</span></div>)}</div><div className="mt-5 flex items-center justify-between border-t pt-4"><strong>Total: {moeda.format(totalManual)}</strong><button disabled={salvando || !itens.length} className="rounded-xl bg-orange-500 px-4 py-3 font-bold text-white disabled:opacity-50">{salvando ? "Salvando..." : pedidoParaAdicionar ? "Incluir itens" : "Salvar pedido"}</button></div></form></div>}</main>;
}
