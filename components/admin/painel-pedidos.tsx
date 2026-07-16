"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Pedido = { id: string; numero_pedido: number; cliente_nome: string; cliente_telefone: string | null; tipo_atendimento: string; status: string; status_atualizado_em: string; pagamento: string; pago: boolean; total: number; created_at: string; endereco_entrega: string | null; observacao: string | null; taxa_entrega: number; taxa_pagamento: number; troco_para: number | null };
type Produto = { id: string; nome: string; preco: number };
type Item = { id: string; nome_produto: string; quantidade: number; preco_unitario: number };
type Empresa = { nome: string; whatsapp: string | null; endereco: string | null; notificacoes_ativas: boolean; notificacao_sonora: boolean };

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const etapas = ["recebido", "preparando", "saiu_para_entrega", "finalizado"];
const rotulos: Record<string, string> = { recebido: "Novo", preparando: "Em produção", saiu_para_entrega: "Em rota", finalizado: "Finalizado" };
const numero = (valor: number) => `#${String(valor).padStart(5, "0")}`;

function tempoDecorrido(data: string, agora: number) {
  const minutos = Math.max(0, Math.floor((agora - new Date(data).getTime()) / 60000));
  const horas = Math.floor(minutos / 60);
  return horas ? `${horas}h ${minutos % 60}min` : `${minutos}min`;
}

function BarraStatus({ status }: { status: string }) {
  const atual = etapas.indexOf(status);
  return <div className="mt-3 flex items-center gap-1" aria-label={`Status: ${rotulos[status] ?? status}`}>{etapas.slice(0, 3).map((etapa, indice) => <span key={etapa} className={`h-1.5 flex-1 rounded-full ${atual >= indice ? "bg-orange-500" : "bg-stone-200"}`} />)}</div>;
}

function tocarSom(contexto: AudioContext | null) {
  if (!contexto || contexto.state !== "running") return;
  const oscilador = contexto.createOscillator();
  const ganho = contexto.createGain();
  oscilador.frequency.value = 880;
  ganho.gain.setValueAtTime(0.0001, contexto.currentTime);
  ganho.gain.exponentialRampToValueAtTime(0.12, contexto.currentTime + 0.03);
  ganho.gain.exponentialRampToValueAtTime(0.0001, contexto.currentTime + 0.32);
  oscilador.connect(ganho).connect(contexto.destination);
  oscilador.start();
  oscilador.stop(contexto.currentTime + 0.34);
}

function escaparHtml(valor: string) {
  return valor.replace(/[&<>'"]/g, (caractere) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[caractere] ?? caractere);
}

export function PainelPedidos() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [detalhe, setDetalhe] = useState<{ pedido: Pedido; itens: Item[] } | null>(null);
  const [balcao, setBalcao] = useState(false);
  const [edicao, setEdicao] = useState<Pedido | null>(null);
  const [erro, setErro] = useState("");
  const [novos, setNovos] = useState<string[]>([]);
  const [alerta, setAlerta] = useState<Pedido | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const conhecidos = useRef(new Set<string>());
  const primeiraCarga = useRef(true);
  const configuracao = useRef({ ativas: true, som: true });
  const contextoSom = useRef<AudioContext | null>(null);

  useEffect(() => {
    const contador = window.setInterval(() => setAgora(Date.now()), 30000);
    return () => window.clearInterval(contador);
  }, []);

  useEffect(() => {
    function ativarSom() {
      try {
        const janela = window as typeof window & { webkitAudioContext?: typeof AudioContext };
        const Contexto = janela.AudioContext ?? janela.webkitAudioContext;
        if (!Contexto) return;
        if (!contextoSom.current) contextoSom.current = new Contexto();
        void contextoSom.current.resume();
      } catch { /* O alerta visual continua ativo. */ }
    }
    window.addEventListener("pointerdown", ativarSom);
    window.addEventListener("keydown", ativarSom);
    return () => {
      window.removeEventListener("pointerdown", ativarSom);
      window.removeEventListener("keydown", ativarSom);
      if (contextoSom.current) void contextoSom.current.close();
    };
  }, []);

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/restaurante/login"); return; }
    const { data: perfil } = await supabase.from("perfis").select("empresa_id").single();
    if (!perfil) return setErro("Este usuário não está vinculado a um restaurante.");
    setEmpresaId(perfil.empresa_id);
    const [lista, catalogo, negocio] = await Promise.all([
      supabase.from("pedidos").select("id,numero_pedido,cliente_nome,cliente_telefone,tipo_atendimento,status,status_atualizado_em,pagamento,pago,total,created_at,endereco_entrega,observacao,taxa_entrega,taxa_pagamento,troco_para").eq("empresa_id", perfil.empresa_id).in("status", etapas.slice(0, 3)).order("created_at", { ascending: false }).limit(100),
      supabase.from("produtos").select("id,nome,preco").eq("empresa_id", perfil.empresa_id).eq("disponivel", true).order("nome"),
      supabase.from("empresas").select("nome,whatsapp,endereco,notificacoes_ativas,notificacao_sonora").eq("id", perfil.empresa_id).maybeSingle(),
    ]);
    if (lista.error) return setErro("Não foi possível atualizar os pedidos.");
    const ativos: Pedido[] = (lista.data ?? []).map((pedido) => ({ ...pedido, numero_pedido: Number(pedido.numero_pedido), total: Number(pedido.total), taxa_entrega: Number(pedido.taxa_entrega ?? 0), taxa_pagamento: Number(pedido.taxa_pagamento ?? 0), troco_para: pedido.troco_para ? Number(pedido.troco_para) : null }));
    setPedidos(ativos);
    setProdutos((catalogo.data ?? []).map((produto) => ({ ...produto, preco: Number(produto.preco) })));
    if (negocio.data) {
      const dados = negocio.data as Empresa;
      setEmpresa(dados);
      configuracao.current = { ativas: dados.notificacoes_ativas ?? true, som: dados.notificacao_sonora ?? true };
    }
    const recebidos = primeiraCarga.current ? [] : ativos.filter((pedido) => pedido.status === "recebido" && !conhecidos.current.has(pedido.id));
    conhecidos.current = new Set(ativos.map((pedido) => pedido.id));
    primeiraCarga.current = false;
    if (recebidos.length && configuracao.current.ativas) {
      setNovos((anteriores) => Array.from(new Set([...recebidos.map((pedido) => pedido.id), ...anteriores])).slice(0, 20));
      setAlerta(recebidos[0]);
      if (configuracao.current.som) tocarSom(contextoSom.current);
    }
  }, [router]);

  useEffect(() => {
    void carregar();
    const intervalo = window.setInterval(() => { void carregar(); }, 12000);
    return () => window.clearInterval(intervalo);
  }, [carregar]);

  useEffect(() => {
    if (!alerta) return;
    const tempo = window.setTimeout(() => setAlerta(null), 12000);
    return () => window.clearTimeout(tempo);
  }, [alerta]);

  async function verPedido(pedido: Pedido) {
    const { data, error } = await supabase.from("itens_pedido").select("id,nome_produto,quantidade,preco_unitario").eq("pedido_id", pedido.id);
    if (error) return setErro("Não foi possível carregar os itens.");
    setDetalhe({ pedido, itens: (data ?? []).map((item) => ({ ...item, preco_unitario: Number(item.preco_unitario) })) });
    setNovos((itens) => itens.filter((id) => id !== pedido.id));
  }

  async function alterarStatus(id: string, status: string) {
    const { error } = await supabase.from("pedidos").update({ status, status_atualizado_em: new Date().toISOString() }).eq("id", id);
    if (error) return setErro("Não foi possível atualizar o status.");
    setDetalhe(null);
    void carregar();
  }

  async function alternarPago() {
    if (!detalhe) return;
    const pago = !detalhe.pedido.pago;
    const { error } = await supabase.from("pedidos").update({ pago, pago_em: pago ? new Date().toISOString() : null }).eq("id", detalhe.pedido.id);
    if (error) return setErro("Não foi possível confirmar o pagamento.");
    const pedido = { ...detalhe.pedido, pago };
    setDetalhe({ ...detalhe, pedido });
    setPedidos((lista) => lista.map((item) => item.id === pedido.id ? pedido : item));
  }

  async function imprimir(pedido: Pedido, itens?: Item[]) {
    const itensDoPedido = itens ?? (await supabase.from("itens_pedido").select("id,nome_produto,quantidade,preco_unitario").eq("pedido_id", pedido.id)).data?.map((item) => ({ ...item, preco_unitario: Number(item.preco_unitario) })) ?? [];
    const subtotal = itensDoPedido.reduce((soma, item) => soma + item.quantidade * item.preco_unitario, 0);
    const linhas = itensDoPedido.map((item) => `<tr><td>${item.quantidade}x ${escaparHtml(item.nome_produto)}</td><td>${moeda.format(item.quantidade * item.preco_unitario)}</td></tr>`).join("");
    const janela = window.open("", "_blank", "width=420,height=760");
    if (!janela) return setErro("Permita a abertura de pop-ups para imprimir.");
    const tipo = pedido.tipo_atendimento === "entrega" ? "Delivery" : pedido.tipo_atendimento === "retirada" ? "Para retirar" : "No local";
    janela.document.write(`<!doctype html><html><head><title>Pedido ${numero(pedido.numero_pedido)}</title><style>@page{size:72mm auto;margin:0}body{font:12px monospace;width:72mm;margin:0;padding:4mm;box-sizing:border-box}.c{text-align:center}.l{border-top:1px dashed #111;margin:8px 0}p,h1,h2{margin:3px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}td:last-child{text-align:right;white-space:nowrap}.t{font-weight:bold;font-size:14px}</style></head><body><div class="c"><h1>**** PEDIDO ${numero(pedido.numero_pedido)} ****</h1><p>${tipo}</p><h2>${escaparHtml(empresa?.nome ?? "Restaurante")}</h2></div><p>Data do pedido: ${new Date(pedido.created_at).toLocaleString("pt-BR")}</p><p>Cliente: ${escaparHtml(pedido.cliente_nome)}</p><p>Telefone: ${escaparHtml(pedido.cliente_telefone ?? "Não informado")}</p>${pedido.endereco_entrega ? `<p>Entrega: ${escaparHtml(pedido.endereco_entrega)}</p>` : ""}<div class="l"></div><div class="c"><b>ITENS DO PEDIDO</b></div><table>${linhas}</table>${pedido.observacao ? `<p>Obs.: ${escaparHtml(pedido.observacao)}</p>` : ""}<div class="l"></div><div class="c"><b>TOTAL</b></div><table><tr><td>Subtotal dos itens</td><td>${moeda.format(subtotal)}</td></tr>${pedido.taxa_entrega ? `<tr><td>Taxa de entrega</td><td>${moeda.format(pedido.taxa_entrega)}</td></tr>` : ""}${pedido.taxa_pagamento ? `<tr><td>Taxa de pagamento</td><td>${moeda.format(pedido.taxa_pagamento)}</td></tr>` : ""}<tr class="t"><td>VALOR TOTAL</td><td>${moeda.format(pedido.total)}</td></tr></table><div class="l"></div><div class="c"><b>FORMA DE PAGAMENTO</b></div><p>${escaparHtml(pedido.pagamento)} · ${pedido.pago ? "PAGO ANTECIPADO" : "PAGAR NA ENTREGA / BALCÃO"}</p>${pedido.troco_para ? `<p>Troco para: ${moeda.format(pedido.troco_para)}</p>` : ""}<div class="l"></div><p>Comprovante não fiscal</p><p>Impresso pelo PedeAI</p><script>window.print()<\/script></body></html>`);
    janela.document.close();
  }

  async function salvarBalcao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dados = new FormData(event.currentTarget);
    const produto = produtos.find((item) => item.id === dados.get("produto"));
    const quantidade = Number(dados.get("qtd"));
    if (!produto || quantidade < 1) return setErro("Escolha produto e quantidade válida.");
    const { data: pedido, error } = await supabase.from("pedidos").insert({ empresa_id: empresaId, cliente_nome: String(dados.get("cliente")), cliente_telefone: String(dados.get("telefone")) || null, tipo_atendimento: String(dados.get("atendimento")), status: "recebido", pagamento: String(dados.get("pagamento")), total: produto.preco * quantidade, endereco_entrega: String(dados.get("atendimento")) === "entrega" ? String(dados.get("endereco")) : null }).select("id").single();
    if (error || !pedido) return setErro("Não foi possível criar o pedido de balcão.");
    const { error: erroItens } = await supabase.from("itens_pedido").insert({ pedido_id: pedido.id, produto_id: produto.id, nome_produto: produto.nome, quantidade, preco_unitario: produto.preco });
    if (erroItens) return setErro("Pedido criado, mas não foi possível incluir o item.");
    setBalcao(false);
    void carregar();
  }

  async function salvarEdicao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edicao) return;
    const { error } = await supabase.from("pedidos").update({ cliente_nome: edicao.cliente_nome, cliente_telefone: edicao.cliente_telefone, tipo_atendimento: edicao.tipo_atendimento, pagamento: edicao.pagamento, endereco_entrega: edicao.tipo_atendimento === "entrega" ? edicao.endereco_entrega : null }).eq("id", edicao.id).eq("status", "recebido");
    if (error) return setErro("Pedidos em produção não podem ser editados.");
    setEdicao(null);
    setDetalhe(null);
    void carregar();
  }

  async function excluir() {
    if (!detalhe || !window.confirm("Excluir este pedido definitivamente?")) return;
    const { error } = await supabase.from("pedidos").delete().eq("id", detalhe.pedido.id);
    if (error) return setErro("Não foi possível excluir o pedido.");
    setDetalhe(null);
    void carregar();
  }

  const pedidosNovos = novos.map((id) => pedidos.find((pedido) => pedido.id === id)).filter((pedido): pedido is Pedido => Boolean(pedido));

  return <main className="min-h-screen bg-stone-100 pb-24 text-stone-900"><header className="border-b bg-white p-4"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-orange-500">PEDEAI · OPERAÇÃO</p><h1 className="text-xl font-bold">Pedidos em andamento</h1></div><div className="flex gap-2"><Link href="/restaurante/historico" className="rounded-xl border bg-white px-3 py-2 text-sm font-bold">Histórico</Link><button onClick={() => setBalcao(true)} className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-white">+ Balcão</button><button onClick={() => { if (pedidosNovos[0]) void verPedido(pedidosNovos[0]); }} className={`rounded-xl border px-3 py-2 text-sm font-bold ${novos.length ? "animate-pulse border-orange-500 bg-orange-50 text-orange-800" : "bg-white"}`}>Novos {novos.length ? `(${novos.length})` : ""}</button></div></div></header><section className="mx-auto max-w-5xl p-4">{erro && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}{pedidosNovos.length > 0 && <div className="mb-3 flex justify-between rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900"><span><strong>{pedidosNovos.length} pedido(s) novo(s)</strong> aguardando atendimento.</span><button onClick={() => setNovos([])} className="font-bold underline">Limpar aviso</button></div>}{pedidos.length === 0 ? <p className="rounded-2xl bg-white p-6 text-center text-sm text-stone-500 shadow-sm">Nenhum pedido em andamento.</p> : <div className="overflow-hidden rounded-2xl bg-white shadow-sm">{pedidos.map((pedido) => <article key={pedido.id} onClick={() => void verPedido(pedido)} className={`cursor-pointer border-b border-stone-100 p-4 transition hover:bg-stone-50 ${novos.includes(pedido.id) ? "animate-pulse bg-orange-50" : ""}`}><div className="flex justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><strong className="text-orange-700">{numero(pedido.numero_pedido)}</strong><strong className="truncate">{pedido.cliente_nome}</strong>{pedido.pago && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">PAGO</span>}</div><p className="mt-1 text-xs text-stone-500">{new Date(pedido.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {rotulos[pedido.status]} há {tempoDecorrido(pedido.status_atualizado_em, agora)}</p></div><strong className="whitespace-nowrap text-orange-700">{moeda.format(pedido.total)}</strong></div><BarraStatus status={pedido.status} /></article>)}</div>}</section>{alerta && <aside className="fixed right-4 top-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-2xl border-2 border-orange-400 bg-white p-4 shadow-xl"><button onClick={() => setAlerta(null)} className="float-right text-xl text-stone-500">×</button><p className="text-xs font-bold text-orange-600">NOVO PEDIDO {numero(alerta.numero_pedido)}</p><p className="mt-1 font-bold">{alerta.cliente_nome} · {moeda.format(alerta.total)}</p><button onClick={() => { setAlerta(null); void verPedido(alerta); }} className="mt-3 w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white">Ver pedido</button></aside>}{detalhe && <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"><section className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"><div className="flex justify-between"><div><p className="text-xs font-bold text-orange-600">PEDIDO {numero(detalhe.pedido.numero_pedido)}</p><h2 className="text-xl font-bold">{detalhe.pedido.cliente_nome}</h2></div><button onClick={() => setDetalhe(null)} className="text-xl text-stone-500">×</button></div><p className="mt-2 text-sm text-stone-500">Feito às {new Date(detalhe.pedido.created_at).toLocaleString("pt-BR")} · etapa atual há {tempoDecorrido(detalhe.pedido.status_atualizado_em, agora)}</p><BarraStatus status={detalhe.pedido.status} /><div className="mt-4 rounded-2xl bg-stone-50 p-3 text-sm"><p><b>WhatsApp:</b> {detalhe.pedido.cliente_telefone || "Não informado"}</p><p className="mt-1"><b>Atendimento:</b> {detalhe.pedido.tipo_atendimento}</p>{detalhe.pedido.endereco_entrega && <p className="mt-1"><b>Endereço:</b> {detalhe.pedido.endereco_entrega}</p>}<p className="mt-1"><b>Pagamento:</b> {detalhe.pedido.pagamento}</p>{detalhe.pedido.observacao && <p className="mt-1"><b>Obs.:</b> {detalhe.pedido.observacao}</p>}</div><button onClick={() => void alternarPago()} className={`mt-4 w-full rounded-xl py-3 text-sm font-bold ${detalhe.pedido.pago ? "bg-green-600 text-white" : "border-2 border-green-600 text-green-700"}`}>{detalhe.pedido.pago ? "✓ PAGO ANTECIPADO" : "Marcar como PAGO ANTECIPADO"}</button>{!detalhe.pedido.pago && <p className="mt-2 text-center text-xs text-stone-500">Sem confirmação: pagamento na entrega ou balcão.</p>}<h3 className="mt-5 font-bold">Itens</h3>{detalhe.itens.map((item) => <div key={item.id} className="mt-2 flex justify-between rounded-xl border p-3 text-sm"><span>{item.quantidade}x {item.nome_produto}</span><b>{moeda.format(item.preco_unitario * item.quantidade)}</b></div>)}<div className="mt-4 flex justify-between border-t pt-4 text-lg font-bold"><span>Total</span><span>{moeda.format(detalhe.pedido.total)}</span></div><div className="mt-4 grid grid-cols-2 gap-2">{detalhe.pedido.status === "recebido" && <button onClick={() => setEdicao({ ...detalhe.pedido })} className="rounded-xl border py-3 text-sm font-bold">Editar</button>}<button onClick={() => void imprimir(detalhe.pedido, detalhe.itens)} className="rounded-xl bg-stone-900 py-3 text-sm font-bold text-white">Imprimir</button>{detalhe.pedido.status === "recebido" && <button onClick={() => void alterarStatus(detalhe.pedido.id, "preparando")} className="rounded-xl bg-orange-500 py-3 text-sm font-bold text-white">Iniciar produção</button>}<button onClick={() => void excluir()} className="rounded-xl py-3 text-sm font-bold text-red-600">Excluir</button></div><label className="mt-4 block text-sm font-bold">Status<select value={detalhe.pedido.status} onChange={(event) => void alterarStatus(detalhe.pedido.id, event.target.value)} className="campo mt-2"><option value="recebido">Novo</option><option value="preparando">Em produção</option><option value="saiu_para_entrega">Em rota de entrega</option><option value="finalizado">Finalizado e mover ao histórico</option><option value="cancelado">Cancelar e mover ao histórico</option></select></label></section></div>}{balcao && <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"><form onSubmit={salvarBalcao} className="w-full max-w-md rounded-3xl bg-white p-5"><div className="flex justify-between"><h2 className="text-xl font-bold">Pedido de balcão</h2><button type="button" onClick={() => setBalcao(false)} className="text-xl">×</button></div><input name="cliente" required placeholder="Nome do cliente" className="campo mt-4" /><input name="telefone" placeholder="WhatsApp" className="campo mt-2" /><select name="atendimento" className="campo mt-2"><option value="local">Consumir no restaurante</option><option value="retirada">Retirada</option><option value="entrega">Entrega</option></select><textarea name="endereco" placeholder="Endereço de entrega (se necessário)" className="campo mt-2" /><select name="pagamento" className="campo mt-2"><option>Dinheiro</option><option>Cartão</option><option>Pix</option></select><select name="produto" required className="campo mt-2"><option value="">Produto</option>{produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.nome} · {moeda.format(produto.preco)}</option>)}</select><input name="qtd" type="number" defaultValue="1" min="1" className="campo mt-2" /><button className="mt-4 w-full rounded-xl bg-orange-500 py-3 font-bold text-white">Criar pedido</button></form></div>}{edicao && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><form onSubmit={salvarEdicao} className="w-full max-w-md rounded-3xl bg-white p-5"><div className="flex justify-between"><h2 className="text-xl font-bold">Editar {numero(edicao.numero_pedido)}</h2><button type="button" onClick={() => setEdicao(null)} className="text-xl">×</button></div><input value={edicao.cliente_nome} onChange={(event) => setEdicao({ ...edicao, cliente_nome: event.target.value })} className="campo mt-4" /><input value={edicao.cliente_telefone ?? ""} onChange={(event) => setEdicao({ ...edicao, cliente_telefone: event.target.value })} className="campo mt-2" /><select value={edicao.tipo_atendimento} onChange={(event) => setEdicao({ ...edicao, tipo_atendimento: event.target.value })} className="campo mt-2"><option value="local">No restaurante</option><option value="retirada">Retirada</option><option value="entrega">Entrega</option></select><textarea value={edicao.endereco_entrega ?? ""} onChange={(event) => setEdicao({ ...edicao, endereco_entrega: event.target.value })} className="campo mt-2" /><select value={edicao.pagamento} onChange={(event) => setEdicao({ ...edicao, pagamento: event.target.value })} className="campo mt-2"><option>Dinheiro</option><option>Cartão</option><option>Pix</option></select><button className="mt-4 w-full rounded-xl bg-orange-500 py-3 font-bold text-white">Salvar alterações</button></form></div>}<nav className="fixed inset-x-0 bottom-0 grid grid-cols-3 border-t bg-white sm:grid-cols-6"><Link href="/restaurante" className="p-3 text-center text-xs">Painel</Link><Link href="/restaurante/pedidos" className="p-3 text-center text-xs font-bold text-orange-600">Pedidos</Link><Link href="/restaurante/historico" className="p-3 text-center text-xs">Histórico</Link><Link href="/restaurante/financeiro" className="p-3 text-center text-xs">Financeiro</Link><Link href="/restaurante/cardapio" className="p-3 text-center text-xs">Cardápio</Link><Link href="/restaurante/configuracoes" className="p-3 text-center text-xs">Ajustes</Link></nav></main>;
}
