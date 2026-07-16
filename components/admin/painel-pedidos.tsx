"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Pedido = { id: string; cliente_nome: string; cliente_telefone: string | null; tipo_atendimento: string; status: string; pagamento: string; total: number; created_at: string; endereco_entrega: string | null };
type Produto = { id: string; nome: string; preco: number };
type ItemPedido = { id: string; nome_produto: string; quantidade: number; preco_unitario: number };
type Empresa = { nome: string; whatsapp: string | null; endereco: string | null; notificacoes_ativas: boolean; notificacao_sonora: boolean };

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function escaparHtml(valor: string) {
  return valor.replace(/[&<>'"]/g, (caractere) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[caractere] ?? caractere);
}

function tocarAlerta(contexto: AudioContext | null) {
  if (!contexto || contexto.state !== "running") return;
  try {
    const oscilador = contexto.createOscillator();
    const ganho = contexto.createGain();
    oscilador.type = "sine";
    oscilador.frequency.setValueAtTime(880, contexto.currentTime);
    ganho.gain.setValueAtTime(0.0001, contexto.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.12, contexto.currentTime + 0.03);
    ganho.gain.exponentialRampToValueAtTime(0.0001, contexto.currentTime + 0.32);
    oscilador.connect(ganho).connect(contexto.destination);
    oscilador.start();
    oscilador.stop(contexto.currentTime + 0.34);
  } catch {
    // Alguns navegadores exigem uma interação prévia antes de tocar som.
  }
}

export function PainelPedidos() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [modo, setModo] = useState<"mosaico" | "lista">("mosaico");
  const [erro, setErro] = useState("");
  const [balcao, setBalcao] = useState(false);
  const [edicao, setEdicao] = useState<Pedido | null>(null);
  const [detalhe, setDetalhe] = useState<{ pedido: Pedido; itens: ItemPedido[] } | null>(null);
  const [notificacoes, setNotificacoes] = useState<string[]>([]);
  const [alerta, setAlerta] = useState<Pedido | null>(null);
  const conhecidos = useRef<Set<string>>(new Set());
  const primeiraCarga = useRef(true);
  const configuracao = useRef({ ativas: true, som: true });
  const contextoSom = useRef<AudioContext | null>(null);

  useEffect(() => {
    function ativarSom() {
      try {
        const janela = window as typeof window & { webkitAudioContext?: typeof AudioContext };
        const Contexto = janela.AudioContext ?? janela.webkitAudioContext;
        if (!Contexto) return;
        if (!contextoSom.current) contextoSom.current = new Contexto();
        void contextoSom.current.resume();
      } catch {
        // O alerta visual continua disponível mesmo sem áudio.
      }
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
    if (!perfil) { setErro("Este usuário não está vinculado a um restaurante."); return; }
    setEmpresaId(perfil.empresa_id);

    const [resultadoPedidos, resultadoProdutos, resultadoEmpresa] = await Promise.all([
      supabase.from("pedidos").select("id,cliente_nome,cliente_telefone,tipo_atendimento,status,pagamento,total,created_at,endereco_entrega").eq("empresa_id", perfil.empresa_id).order("created_at", { ascending: false }).limit(100),
      supabase.from("produtos").select("id,nome,preco").eq("empresa_id", perfil.empresa_id).eq("disponivel", true).order("nome"),
      supabase.from("empresas").select("nome,whatsapp,endereco,notificacoes_ativas,notificacao_sonora").eq("id", perfil.empresa_id).maybeSingle(),
    ]);
    if (resultadoPedidos.error) { setErro("Não foi possível atualizar os pedidos."); return; }

    const lista: Pedido[] = (resultadoPedidos.data ?? []).map((pedido) => ({ ...pedido, total: Number(pedido.total) }));
    setPedidos(lista);
    setProdutos((resultadoProdutos.data ?? []).map((produto) => ({ ...produto, preco: Number(produto.preco) })));
    if (resultadoEmpresa.data) {
      const dados = resultadoEmpresa.data as Empresa;
      setEmpresa(dados);
      configuracao.current = { ativas: dados.notificacoes_ativas ?? true, som: dados.notificacao_sonora ?? true };
    }

    const novos = primeiraCarga.current ? [] : lista.filter((pedido) => pedido.status === "recebido" && !conhecidos.current.has(pedido.id));
    conhecidos.current = new Set(lista.slice(0, 100).map((pedido) => pedido.id));
    primeiraCarga.current = false;
    if (novos.length && configuracao.current.ativas) {
      setNotificacoes((atuais) => Array.from(new Set([...novos.map((pedido) => pedido.id), ...atuais])).slice(0, 20));
      setAlerta(novos[0]);
      if (configuracao.current.som) tocarAlerta(contextoSom.current);
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

  async function atualizarStatus(id: string, status: string) {
    const { error } = await supabase.from("pedidos").update({ status }).eq("id", id);
    if (error) return setErro("Não foi possível atualizar o pedido.");
    void carregar();
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir este pedido definitivamente?")) return;
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) return setErro("Não foi possível excluir o pedido.");
    setNotificacoes((atuais) => atuais.filter((pedidoId) => pedidoId !== id));
    void carregar();
  }

  async function abrirDetalhe(pedido: Pedido) {
    const { data, error } = await supabase.from("itens_pedido").select("id,nome_produto,quantidade,preco_unitario").eq("pedido_id", pedido.id);
    if (error) return setErro("Não foi possível carregar os itens do pedido.");
    setDetalhe({ pedido, itens: (data ?? []).map((item) => ({ ...item, preco_unitario: Number(item.preco_unitario) })) });
    setNotificacoes((atuais) => atuais.filter((pedidoId) => pedidoId !== pedido.id));
  }

  async function imprimir(pedido: Pedido) {
    const { data } = await supabase.from("itens_pedido").select("nome_produto,quantidade,preco_unitario").eq("pedido_id", pedido.id);
    const itens = (data ?? []).map((item) => `<tr><td>${item.quantidade}x ${escaparHtml(item.nome_produto)}</td><td style="text-align:right">${moeda.format(Number(item.preco_unitario) * item.quantidade)}</td></tr>`).join("");
    const janela = window.open("", "_blank", "width=420,height=640");
    if (!janela) return setErro("Permita a abertura de pop-ups para imprimir o pedido.");
    janela.document.write(`<!doctype html><html><head><title>Pedido PedeAI</title><style>body{font:12px Arial;width:72mm;margin:0;padding:6mm}h1{font-size:17px;margin:0 0 4px}p{margin:4px 0}table{width:100%;border-collapse:collapse;margin:10px 0}td{padding:3px 0;border-bottom:1px dashed #bbb}.total{font-size:15px;font-weight:bold}</style></head><body><h1>${escaparHtml(empresa?.nome ?? "Restaurante")}</h1><p>${escaparHtml(empresa?.whatsapp ?? "")}</p><p>${escaparHtml(empresa?.endereco ?? "")}</p><hr><p><b>PedeAI · Pedido</b></p><p><b>Cliente:</b> ${escaparHtml(pedido.cliente_nome)}</p><p><b>WhatsApp:</b> ${escaparHtml(pedido.cliente_telefone ?? "Não informado")}</p><p><b>Atendimento:</b> ${escaparHtml(pedido.tipo_atendimento)}</p>${pedido.endereco_entrega ? `<p><b>Entrega:</b> ${escaparHtml(pedido.endereco_entrega)}</p>` : ""}<p><b>Pagamento:</b> ${escaparHtml(pedido.pagamento)}</p><table>${itens}</table><p class="total">Total: ${moeda.format(pedido.total)}</p><p>Comprovante não fiscal · ${new Date(pedido.created_at).toLocaleString("pt-BR")}</p><script>window.print()<\/script></body></html>`);
    janela.document.close();
  }

  async function salvarEdicao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edicao) return;
    const { error } = await supabase.from("pedidos").update({ cliente_nome: edicao.cliente_nome, cliente_telefone: edicao.cliente_telefone, tipo_atendimento: edicao.tipo_atendimento, pagamento: edicao.pagamento, endereco_entrega: edicao.tipo_atendimento === "entrega" ? edicao.endereco_entrega : null }).eq("id", edicao.id).eq("status", "recebido");
    if (error) return setErro("Pedido não pode mais ser editado.");
    setEdicao(null);
    void carregar();
  }

  async function salvarBalcao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dados = new FormData(event.currentTarget);
    const produto = produtos.find((item) => item.id === dados.get("produto"));
    const atendimento = String(dados.get("atendimento"));
    const quantidade = Number(dados.get("qtd"));
    if (!produto || !Number.isInteger(quantidade) || quantidade < 1) return setErro("Escolha um produto e quantidade válida.");
    const { data: pedido, error } = await supabase.from("pedidos").insert({ empresa_id: empresaId, cliente_nome: String(dados.get("cliente")), cliente_telefone: String(dados.get("telefone")) || null, tipo_atendimento: atendimento, status: "recebido", pagamento: String(dados.get("pagamento")), total: produto.preco * quantidade, endereco_entrega: atendimento === "entrega" ? String(dados.get("endereco")) : null }).select("id").single();
    if (error || !pedido) return setErro("Não foi possível criar o pedido de balcão.");
    const { error: itensErro } = await supabase.from("itens_pedido").insert({ pedido_id: pedido.id, produto_id: produto.id, nome_produto: produto.nome, quantidade, preco_unitario: produto.preco });
    if (itensErro) return setErro("Pedido criado, mas não foi possível incluir o item.");
    setBalcao(false);
    void carregar();
  }

  const pedidosNovos = notificacoes.map((id) => pedidos.find((pedido) => pedido.id === id)).filter((pedido): pedido is Pedido => Boolean(pedido));

  return (
    <main className="min-h-screen bg-stone-100 pb-24 text-stone-900">
      <header className="border-b bg-white p-4"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-orange-500">PEDEAI · OPERAÇÃO</p><h1 className="text-xl font-bold">Pedidos</h1></div><div className="flex flex-wrap gap-2"><button onClick={() => setBalcao(true)} className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-white">+ Balcão</button><button onClick={() => setModo((atual) => atual === "mosaico" ? "lista" : "mosaico")} className="rounded-xl border bg-white px-3 py-2 text-sm font-bold">{modo === "mosaico" ? "Lista" : "Mosaico"}</button><button onClick={() => { if (pedidosNovos[0]) void abrirDetalhe(pedidosNovos[0]); }} className={`rounded-xl border px-3 py-2 text-sm font-bold ${notificacoes.length ? "animate-pulse border-orange-500 bg-orange-50 text-orange-800" : "bg-white"}`}>Novos {notificacoes.length ? `(${notificacoes.length})` : ""}</button></div></div></header>

      <section className="mx-auto max-w-6xl p-4">
        {erro && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        {pedidosNovos.length > 0 && <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900"><span><strong>{pedidosNovos.length} pedido(s) novo(s)</strong> aguardando atendimento.</span><button onClick={() => setNotificacoes([])} className="font-bold underline">Limpar aviso</button></div>}
        <div className={modo === "mosaico" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>{pedidos.map((pedido) => <article key={pedido.id} className={`rounded-2xl bg-white p-4 shadow-sm ${notificacoes.includes(pedido.id) ? "animate-pulse ring-2 ring-orange-400" : ""}`}><div className="flex items-start justify-between gap-3"><div><b>{pedido.cliente_nome}</b><p className="mt-1 text-xs text-stone-500">{pedido.cliente_telefone || "Sem WhatsApp"} · {pedido.pagamento}</p></div><b className="whitespace-nowrap text-orange-700">{moeda.format(pedido.total)}</b></div>{pedido.endereco_entrega && <p className="mt-3 line-clamp-2 text-xs text-stone-600">{pedido.endereco_entrega}</p>}<div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => void abrirDetalhe(pedido)} className="rounded-lg border p-2 text-xs font-bold">Visualizar</button><button onClick={() => void imprimir(pedido)} className="rounded-lg border p-2 text-xs font-bold">Imprimir</button>{pedido.status === "recebido" && <button onClick={() => setEdicao({ ...pedido })} className="rounded-lg border p-2 text-xs font-bold">Editar</button>}<button onClick={() => void excluir(pedido.id)} className="rounded-lg p-2 text-xs font-bold text-red-600">Excluir</button></div><select value={pedido.status} onChange={(event) => void atualizarStatus(pedido.id, event.target.value)} className="mt-3 w-full rounded-lg border p-2 text-sm"><option value="recebido">Novo</option><option value="preparando">Em produção</option><option value="saiu_para_entrega">Saiu</option><option value="entregue">Entregue</option><option value="cancelado">Cancelado</option></select></article>)}</div>
      </section>

      {alerta && <aside role="alert" className="fixed right-4 top-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-2xl border-2 border-orange-400 bg-white p-4 shadow-xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-orange-600">NOVO PEDIDO</p><p className="mt-1 font-bold">{alerta.cliente_nome} · {moeda.format(alerta.total)}</p><p className="mt-1 text-xs text-stone-500">{alerta.pagamento} · {alerta.tipo_atendimento}</p></div><button onClick={() => setAlerta(null)} className="text-xl leading-none text-stone-500" aria-label="Fechar aviso">×</button></div><button onClick={() => { setAlerta(null); void abrirDetalhe(alerta); }} className="mt-3 w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white">Ver pedido</button></aside>}

      {detalhe && <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"><section role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold text-orange-600">PEDIDO</p><h2 className="text-xl font-bold">{detalhe.pedido.cliente_nome}</h2></div><button onClick={() => setDetalhe(null)} className="text-xl text-stone-500" aria-label="Fechar">×</button></div><div className="mt-4 rounded-2xl bg-stone-50 p-3 text-sm"><p><strong>WhatsApp:</strong> {detalhe.pedido.cliente_telefone || "Não informado"}</p><p className="mt-1"><strong>Atendimento:</strong> {detalhe.pedido.tipo_atendimento}</p>{detalhe.pedido.endereco_entrega && <p className="mt-1"><strong>Endereço:</strong> {detalhe.pedido.endereco_entrega}</p>}<p className="mt-1"><strong>Pagamento:</strong> {detalhe.pedido.pagamento}</p></div><h3 className="mt-5 font-bold">Itens</h3><div className="mt-2 space-y-2">{detalhe.itens.map((item) => <div key={item.id} className="flex justify-between rounded-xl border p-3 text-sm"><span>{item.quantidade}x {item.nome_produto}</span><strong>{moeda.format(item.preco_unitario * item.quantidade)}</strong></div>)}</div><div className="mt-4 flex justify-between border-t pt-4 text-lg font-bold"><span>Total</span><span>{moeda.format(detalhe.pedido.total)}</span></div><button onClick={() => void imprimir(detalhe.pedido)} className="mt-4 w-full rounded-xl bg-stone-900 py-3 font-bold text-white">Imprimir pedido</button></section></div>}

      {balcao && <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"><form onSubmit={salvarBalcao} className="w-full max-w-md rounded-3xl bg-white p-5"><div className="flex justify-between"><h2 className="text-xl font-bold">Pedido de balcão</h2><button type="button" onClick={() => setBalcao(false)} className="text-xl text-stone-500">×</button></div><input name="cliente" required placeholder="Nome do cliente" className="campo mt-4" /><input name="telefone" placeholder="WhatsApp" className="campo mt-2" /><select name="atendimento" className="campo mt-2"><option value="local">Consumir no restaurante</option><option value="retirada">Retirada</option><option value="entrega">Entrega</option></select><textarea name="endereco" placeholder="Endereço de entrega (se necessário)" className="campo mt-2" /><select name="pagamento" className="campo mt-2"><option>Dinheiro</option><option>Cartão</option><option>Pix</option></select><select name="produto" required className="campo mt-2"><option value="">Produto</option>{produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.nome} · {moeda.format(produto.preco)}</option>)}</select><input name="qtd" type="number" defaultValue="1" min="1" className="campo mt-2" /><button className="mt-4 w-full rounded-xl bg-orange-500 py-3 font-bold text-white">Criar pedido</button></form></div>}

      {edicao && <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"><form onSubmit={salvarEdicao} className="w-full max-w-md rounded-3xl bg-white p-5"><div className="flex justify-between"><h2 className="text-xl font-bold">Editar pedido</h2><button type="button" onClick={() => setEdicao(null)} className="text-xl text-stone-500">×</button></div><input value={edicao.cliente_nome} onChange={(event) => setEdicao({ ...edicao, cliente_nome: event.target.value })} className="campo mt-4" /><input value={edicao.cliente_telefone ?? ""} onChange={(event) => setEdicao({ ...edicao, cliente_telefone: event.target.value })} className="campo mt-2" /><select value={edicao.tipo_atendimento} onChange={(event) => setEdicao({ ...edicao, tipo_atendimento: event.target.value })} className="campo mt-2"><option value="local">No restaurante</option><option value="retirada">Retirada</option><option value="entrega">Entrega</option></select><textarea value={edicao.endereco_entrega ?? ""} onChange={(event) => setEdicao({ ...edicao, endereco_entrega: event.target.value })} className="campo mt-2" /><select value={edicao.pagamento} onChange={(event) => setEdicao({ ...edicao, pagamento: event.target.value })} className="campo mt-2"><option>Dinheiro</option><option>Cartão</option><option>Pix</option></select><button className="mt-4 w-full rounded-xl bg-orange-500 py-3 font-bold text-white">Salvar alterações</button></form></div>}

      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-5 border-t bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.04)]"><Link href="/restaurante" className="p-3 text-center text-xs">Painel</Link><Link href="/restaurante/pedidos" className="p-3 text-center text-xs font-bold text-orange-600">Pedidos</Link><Link href="/restaurante/financeiro" className="p-3 text-center text-xs">Financeiro</Link><Link href="/restaurante/cardapio" className="p-3 text-center text-xs">Cardápio</Link><Link href="/restaurante/configuracoes" className="p-3 text-center text-xs">Ajustes</Link></nav>
    </main>
  );
}
