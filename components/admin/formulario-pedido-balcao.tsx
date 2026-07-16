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

  const total = useMemo(() => itens.reduce((soma, item) => {
    const produto = produtos.find((atual) => atual.id === item.produtoId);
    return soma + (produto?.preco ?? 0) * item.quantidade;
  }, 0), [itens, produtos]);

  function adicionar(produtoId: string) {
    setItens((atuais) => {
      const existe = atuais.find((item) => item.produtoId === produtoId);
      return existe ? atuais.map((item) => item.produtoId === produtoId ? { ...item, quantidade: item.quantidade + 1 } : item) : [...atuais, { produtoId, quantidade: 1 }];
    });
  }

  function alterarQuantidade(produtoId: string, delta: number) {
    setItens((atuais) => atuais.flatMap((item) => {
      if (item.produtoId !== produtoId) return [item];
      return item.quantidade + delta > 0 ? [{ ...item, quantidade: item.quantidade + delta }] : [];
    }));
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
    try { await navigator.clipboard.writeText(resultado.codigoAcesso); } catch { /* O código segue visível para cópia manual. */ }
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    if (!itens.length) return setErro("Inclua pelo menos um item no pedido.");
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

  if (resultado) return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><p className="text-xs font-bold text-green-700">PEDIDO INCLUÍDO</p><h2 className="mt-1 text-2xl font-bold">Pedido {numero(resultado.numeroPedido)}</h2><p className="mt-2 text-sm text-stone-600">O pedido já está na lista de pedidos em andamento.</p><div className="mt-5 rounded-2xl border-2 border-orange-200 bg-orange-50 p-4 text-center"><p className="text-xs font-bold uppercase tracking-wide text-orange-700">Código de acesso do cliente</p><strong className="mt-2 block text-3xl tracking-[0.25em] text-stone-900">{resultado.codigoAcesso}</strong><p className="mt-3 text-xs text-stone-600">Informe este código ao cliente. Ele usará WhatsApp + código para ver seus pedidos.</p><button type="button" onClick={() => void copiarCodigo()} className="mt-4 rounded-xl bg-stone-900 px-4 py-2 text-sm font-bold text-white">Copiar código</button></div><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={novoPedido} className="rounded-xl border py-3 text-sm font-bold">Novo pedido</button><button type="button" onClick={aoFechar} className="rounded-xl bg-orange-500 py-3 text-sm font-bold text-white">Ver pedidos</button></div></section></div>;

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-3 sm:grid sm:place-items-center sm:p-4"><form onSubmit={salvar} className="mx-auto my-3 w-full max-w-5xl rounded-3xl bg-white p-5 shadow-2xl sm:my-0"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-orange-600">PEDIDO MANUAL</p><h2 className="text-2xl font-bold">Incluir pedido de balcão</h2><p className="mt-1 text-sm text-stone-500">Preencha os dados, monte os itens e inclua o pedido na lista.</p></div><button type="button" onClick={aoFechar} className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 text-xl text-stone-600" aria-label="Fechar">×</button></div>{erro && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}<div className="mt-5 grid gap-5 lg:grid-cols-[.95fr_1.05fr]"><section className="space-y-5"><div className="rounded-2xl border p-4"><h3 className="font-bold">1. Cliente</h3><div className="mt-3 grid gap-2 sm:grid-cols-2"><input name="cliente" required placeholder="Nome completo do cliente" className="campo sm:col-span-2" /><input name="telefone" required inputMode="tel" placeholder="WhatsApp com DDD" className="campo sm:col-span-2" /></div><label className="mt-3 flex items-start gap-3 rounded-xl bg-orange-50 p-3 text-sm"><input type="checkbox" checked={gerarNovoCodigo} onChange={(event) => setGerarNovoCodigo(event.target.checked)} className="mt-1 h-4 w-4 accent-orange-500" /><span><strong>Gerar código de acesso</strong><br /><span className="text-xs text-stone-600">Para cliente já cadastrado, um novo código substituirá o anterior.</span></span></label></div><div className="rounded-2xl border p-4"><h3 className="font-bold">2. Atendimento</h3><div className="mt-3 grid grid-cols-3 gap-2">{([['local', 'No local'], ['retirada', 'Retirada'], ['entrega', 'Entrega']] as const).map(([valor, rotulo]) => <button key={valor} type="button" onClick={() => setAtendimento(valor)} className={`rounded-xl p-3 text-sm font-bold ${atendimento === valor ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"}`}>{rotulo}</button>)}</div>{atendimento === "entrega" && <div className="mt-4 grid grid-cols-2 gap-2"><input name="endereco" required placeholder="Endereço" className="campo col-span-2" /><input name="numero" required placeholder="Número" className="campo" /><input name="bairro" required placeholder="Bairro" className="campo" /><input name="cidade" required placeholder="Cidade" className="campo" /><input name="estado" required placeholder="UF" maxLength={2} className="campo" /><input name="complemento" placeholder="Complemento (opcional)" className="campo col-span-2" /><input name="referencia" placeholder="Ponto de referência (opcional)" className="campo col-span-2" /></div>}</div><div className="rounded-2xl border p-4"><h3 className="font-bold">3. Pagamento</h3><div className="mt-3 grid grid-cols-3 gap-2">{["Pix", "Cartão", "Dinheiro"].map((opcao) => <button key={opcao} type="button" onClick={() => setPagamento(opcao)} className={`rounded-xl p-3 text-sm font-bold ${pagamento === opcao ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"}`}>{opcao}</button>)}</div>{pagamento === "Dinheiro" && <input value={trocoPara} onChange={(event) => setTrocoPara(event.target.value)} inputMode="decimal" placeholder="Troco para quanto? Ex.: 50,00" className="campo mt-3" />}<textarea name="observacao" placeholder="Observação do pedido (opcional)" className="campo mt-3" rows={2} /></div></section><section className="rounded-2xl bg-stone-50 p-4"><div className="flex items-center justify-between"><div><h3 className="font-bold">4. Itens do pedido</h3><p className="mt-1 text-xs text-stone-500">Clique em um produto para adicioná-lo.</p></div><span className="rounded-full bg-white px-2 py-1 text-xs font-bold">{itens.reduce((soma, item) => soma + item.quantidade, 0)} itens</span></div><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar produto" className="campo mt-4" /><div className="mt-3 grid max-h-60 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{produtosVisiveis.map((produto) => <button key={produto.id} type="button" onClick={() => adicionar(produto.id)} className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-3 text-left hover:border-orange-400 hover:bg-orange-50"><span className="min-w-0"><strong className="block truncate text-sm">{produto.nome}</strong><span className="text-xs text-orange-700">{moeda.format(produto.preco)}</span></span><span className="ml-3 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stone-900 font-bold text-white">+</span></button>)}</div><div className="mt-4 border-t border-stone-200 pt-4"><h4 className="font-bold">Pedido atual</h4>{itens.length === 0 ? <p className="mt-3 rounded-xl border border-dashed bg-white p-4 text-sm text-stone-500">Nenhum item incluído ainda.</p> : <div className="mt-3 space-y-2">{itens.map((item) => { const produto = produtos.find((atual) => atual.id === item.produtoId); if (!produto) return null; return <div key={item.produtoId} className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{produto.nome}</p><p className="text-xs text-orange-700">{moeda.format(produto.preco * item.quantidade)}</p></div><button type="button" onClick={() => alterarQuantidade(item.produtoId, -1)} className="grid h-8 w-8 place-items-center rounded-full bg-stone-100 font-bold">−</button><strong className="w-5 text-center">{item.quantidade}</strong><button type="button" onClick={() => alterarQuantidade(item.produtoId, 1)} className="grid h-8 w-8 place-items-center rounded-full bg-stone-900 font-bold text-white">+</button><button type="button" onClick={() => alterarQuantidade(item.produtoId, -item.quantidade)} className="ml-1 text-xs font-bold text-red-600">Excluir</button></div>; })}</div>}<div className="mt-4 flex justify-between border-t pt-4 text-xl font-bold"><span>Total</span><span className="text-orange-700">{moeda.format(total)}</span></div></div></section></div><div className="mt-5 flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={aoFechar} className="rounded-xl border px-5 py-3 text-sm font-bold">Cancelar</button><button disabled={enviando || !itens.length} className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{enviando ? "Incluindo pedido..." : `Incluir pedido na lista · ${moeda.format(total)}`}</button></div></form></div>;
}
