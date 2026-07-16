"use client";

import { FormEvent, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Produto = { id: string; nome: string; preco: number };
type Item = { produtoId: string; quantidade: number };
type Resultado = { numeroPedido: number; codigoAcesso: string; codigoFoiAtualizado: boolean };

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = (valor: number) => `#${String(valor).padStart(5, "0")}`;

export function FormularioPedidoBalcao({ produtos, aoFechar, aoCriar }: { produtos: Produto[]; aoFechar: () => void; aoCriar: () => void }) {
  const [itens, setItens] = useState<Item[]>([]);
  const [busca, setBusca] = useState("");
  const [atendimento, setAtendimento] = useState<"local" | "retirada" | "entrega">("local");
  const [pagamento, setPagamento] = useState("Dinheiro");
  const [trocoPara, setTrocoPara] = useState("");
  const [gerarNovoCodigo, setGerarNovoCodigo] = useState(true);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const produtosVisiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return produtos.filter((produto) => !termo || produto.nome.toLocaleLowerCase("pt-BR").includes(termo));
  }, [busca, produtos]);

  const quantidadeItens = useMemo(() => itens.reduce((soma, item) => soma + item.quantidade, 0), [itens]);
  const total = useMemo(() => itens.reduce((soma, item) => {
    const produto = produtos.find((atual) => atual.id === item.produtoId);
    return soma + (produto?.preco ?? 0) * item.quantidade;
  }, 0), [itens, produtos]);

  function quantidadeDoProduto(produtoId: string) {
    return itens.find((item) => item.produtoId === produtoId)?.quantidade ?? 0;
  }

  function adicionar(produtoId: string) {
    setItens((atuais) => {
      const existe = atuais.find((item) => item.produtoId === produtoId);
      return existe ? atuais.map((item) => item.produtoId === produtoId ? { ...item, quantidade: item.quantidade + 1 } : item) : [...atuais, { produtoId, quantidade: 1 }];
    });
  }

  function definirQuantidade(produtoId: string, novaQuantidade: number) {
    const quantidade = Math.min(50, Math.max(0, Number.isFinite(novaQuantidade) ? Math.floor(novaQuantidade) : 0));
    setItens((atuais) => atuais.flatMap((item) => {
      if (item.produtoId !== produtoId) return [item];
      return quantidade > 0 ? [{ ...item, quantidade }] : [];
    }));
  }

  function alterarQuantidade(produtoId: string, delta: number) {
    definirQuantidade(produtoId, quantidadeDoProduto(produtoId) + delta);
  }

  function novoPedido() {
    setItens([]);
    setBusca("");
    setAtendimento("local");
    setPagamento("Dinheiro");
    setTrocoPara("");
    setGerarNovoCodigo(true);
    setErro("");
    setResultado(null);
  }

  async function copiarCodigo() {
    if (!resultado) return;
    try { await navigator.clipboard.writeText(resultado.codigoAcesso); } catch { /* O código permanece visível. */ }
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    if (!itens.length) return setErro("Inclua pelo menos um item na comanda.");
    const dados = new FormData(event.currentTarget);
    const endereco = {
      endereco: String(dados.get("endereco") ?? ""), numero: String(dados.get("numero") ?? ""),
      bairro: String(dados.get("bairro") ?? ""), cidade: String(dados.get("cidade") ?? ""),
      estado: String(dados.get("estado") ?? ""), complemento: String(dados.get("complemento") ?? ""),
      referencia: String(dados.get("referencia") ?? ""),
    };
    setEnviando(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setEnviando(false); return setErro("Sua sessão expirou. Entre novamente no painel."); }
    const resposta = await fetch("/api/pedidos/balcao", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        nome: dados.get("cliente"), telefone: dados.get("telefone"), tipoAtendimento: atendimento,
        pagamento, trocoPara: pagamento === "Dinheiro" && trocoPara ? Number(trocoPara.replace(",", ".")) : null,
        gerarNovoCodigo, observacao: dados.get("observacao"), endereco, itens,
      }),
    });
    const conteudo = await resposta.json();
    setEnviando(false);
    if (!resposta.ok) return setErro(conteudo.error ?? "Não foi possível incluir o pedido.");
    setResultado(conteudo as Resultado);
    aoCriar();
  }

  if (resultado) return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><p className="text-xs font-bold text-green-700">PEDIDO INCLUÍDO</p><h2 className="mt-1 text-2xl font-bold">Pedido {numero(resultado.numeroPedido)}</h2><p className="mt-2 text-sm text-stone-600">A comanda já entrou na lista de pedidos em andamento.</p><div className="mt-5 rounded-2xl border-2 border-orange-200 bg-orange-50 p-4 text-center"><p className="text-xs font-bold uppercase tracking-wide text-orange-700">Código de acesso do cliente</p><strong className="mt-2 block text-3xl tracking-[0.25em] text-stone-900">{resultado.codigoAcesso}</strong><p className="mt-3 text-xs text-stone-600">O cliente usa WhatsApp + este código para consultar os pedidos.</p><button type="button" onClick={() => void copiarCodigo()} className="mt-4 rounded-xl bg-stone-900 px-4 py-2 text-sm font-bold text-white">Copiar código</button></div><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={novoPedido} className="rounded-xl border py-3 text-sm font-bold">Nova comanda</button><button type="button" onClick={aoFechar} className="rounded-xl bg-orange-500 py-3 text-sm font-bold text-white">Ver pedidos</button></div></section></div>;

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-0 sm:p-4"><form onSubmit={salvar} className="mx-auto min-h-full w-full max-w-6xl bg-stone-100 shadow-2xl sm:min-h-0 sm:rounded-3xl"><header className="flex items-center justify-between gap-3 bg-stone-950 px-5 py-4 text-white sm:rounded-t-3xl"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">PedeAI · PDV</p><h2 className="mt-1 text-xl font-bold">Pedido de balcão</h2></div><div className="flex items-center gap-3"><span className="hidden rounded-xl bg-white/10 px-3 py-2 text-sm font-bold sm:block">{quantidadeItens} itens na comanda</span><button type="button" onClick={aoFechar} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xl" aria-label="Fechar">×</button></div></header><div className="p-4 sm:p-5">{erro && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{erro}</p>}<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]"><section className="space-y-5"><section className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-600">Cliente</p><h3 className="mt-1 font-bold">Dados para a comanda</h3></div><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">Obrigatório: WhatsApp</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><input name="cliente" required placeholder="Nome do cliente" className="campo" /><input name="telefone" required inputMode="tel" placeholder="WhatsApp com DDD" className="campo" /></div><label className="mt-3 flex items-start gap-3 rounded-xl bg-orange-50 p-3 text-sm"><input type="checkbox" checked={gerarNovoCodigo} onChange={(event) => setGerarNovoCodigo(event.target.checked)} className="mt-1 h-4 w-4 accent-orange-500" /><span><strong>Gerar código de acesso</strong><br /><span className="text-xs text-stone-600">Se este WhatsApp já tiver cadastro, o código anterior será substituído.</span></span></label></section><section className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-orange-600">Comanda</p><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => setAtendimento("local")} className={`rounded-xl px-3 py-2 text-sm font-bold ${atendimento === "local" ? "bg-stone-900 text-white" : "bg-stone-100"}`}>No local</button><button type="button" onClick={() => setAtendimento("retirada")} className={`rounded-xl px-3 py-2 text-sm font-bold ${atendimento === "retirada" ? "bg-stone-900 text-white" : "bg-stone-100"}`}>Retirada</button><button type="button" onClick={() => setAtendimento("entrega")} className={`rounded-xl px-3 py-2 text-sm font-bold ${atendimento === "entrega" ? "bg-stone-900 text-white" : "bg-stone-100"}`}>Entrega</button></div><div className="grid grid-cols-3 gap-2">{["Pix", "Cartão", "Dinheiro"].map((opcao) => <button key={opcao} type="button" onClick={() => setPagamento(opcao)} className={`rounded-xl px-3 py-2 text-sm font-bold ${pagamento === opcao ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-800"}`}>{opcao}</button>)}</div></div>{pagamento === "Dinheiro" && <input value={trocoPara} onChange={(event) => setTrocoPara(event.target.value)} inputMode="decimal" placeholder="Troco para quanto? Ex.: 50,00" className="campo mt-4" />}{atendimento === "entrega" && <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4"><input name="endereco" required placeholder="Endereço" className="campo col-span-2" /><input name="numero" required placeholder="Número" className="campo" /><input name="bairro" required placeholder="Bairro" className="campo" /><input name="cidade" required placeholder="Cidade" className="campo" /><input name="estado" required placeholder="UF" maxLength={2} className="campo" /><input name="complemento" placeholder="Complemento (opcional)" className="campo col-span-2" /><input name="referencia" placeholder="Ponto de referência (opcional)" className="campo col-span-2" /></div>}<textarea name="observacao" placeholder="Observação do pedido (opcional)" className="campo mt-4" rows={2} /></section><section className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-600">Catálogo</p><h3 className="mt-1 font-bold">Clique para adicionar à comanda</h3></div><div className="w-full sm:w-64"><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar produto" className="campo" /></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{produtosVisiveis.length ? produtosVisiveis.map((produto) => { const quantidade = quantidadeDoProduto(produto.id); return <button key={produto.id} type="button" onClick={() => adicionar(produto.id)} className={`rounded-2xl border p-3 text-left transition ${quantidade ? "border-orange-400 bg-orange-50" : "border-stone-200 hover:border-orange-300 hover:bg-stone-50"}`}><div className="flex items-start justify-between gap-2"><strong className="min-w-0 flex-1 truncate text-sm">{produto.nome}</strong><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-stone-900 text-lg font-bold text-white">+</span></div><div className="mt-3 flex items-end justify-between"><span className="text-sm font-bold text-orange-700">{moeda.format(produto.preco)}</span>{quantidade > 0 && <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">{quantidade} na comanda</span>}</div></button>; }) : <p className="rounded-xl border border-dashed p-4 text-sm text-stone-500 sm:col-span-2 xl:col-span-3">Nenhum produto encontrado.</p>}</div></section></section><aside className="h-fit rounded-2xl bg-stone-950 p-4 text-white shadow-xl lg:sticky lg:top-4"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-300">Comanda atual</p><h3 className="mt-1 text-lg font-bold">Itens selecionados</h3></div><span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold">{quantidadeItens} itens</span></div>{itens.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-white/25 p-5 text-center text-sm text-stone-300"><p className="text-2xl">🧾</p><p className="mt-2">Selecione um produto no catálogo. Ele aparecerá aqui automaticamente.</p></div> : <div className="mt-4 space-y-2">{itens.map((item) => { const produto = produtos.find((atual) => atual.id === item.produtoId); if (!produto) return null; return <article key={item.produtoId} className="rounded-2xl bg-white p-3 text-stone-900"><div className="flex gap-2"><div className="min-w-0 flex-1"><h4 className="truncate text-sm font-bold">{produto.nome}</h4><p className="mt-1 text-xs text-stone-500">{moeda.format(produto.preco)} cada</p></div><button type="button" onClick={() => definirQuantidade(item.produtoId, 0)} className="text-xs font-bold text-red-600">Excluir</button></div><div className="mt-3 flex items-center justify-between"><strong className="text-sm text-orange-700">{moeda.format(produto.preco * item.quantidade)}</strong><div className="flex items-center gap-2"><button type="button" onClick={() => alterarQuantidade(item.produtoId, -1)} className="grid h-8 w-8 place-items-center rounded-lg bg-stone-100 text-lg font-bold">−</button><input aria-label={`Quantidade de ${produto.nome}`} value={item.quantidade} onChange={(event) => definirQuantidade(item.produtoId, Number(event.target.value))} inputMode="numeric" className="h-8 w-10 rounded-lg border text-center text-sm font-bold" /><button type="button" onClick={() => alterarQuantidade(item.produtoId, 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-stone-900 text-lg font-bold text-white">+</button></div></div></article>; })}</div>}<div className="mt-5 border-t border-white/15 pt-4"><div className="flex items-end justify-between"><span className="text-sm font-semibold text-stone-300">Total da comanda</span><strong className="text-2xl text-orange-300">{moeda.format(total)}</strong></div><button disabled={enviando || !itens.length} className="mt-4 w-full rounded-xl bg-orange-500 py-4 text-sm font-bold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40">{enviando ? "Incluindo pedido..." : "Incluir pedido na lista"}</button><button type="button" onClick={aoFechar} className="mt-2 w-full rounded-xl py-3 text-sm font-bold text-stone-300">Cancelar</button></div></aside></div></div></form></div>;
}
