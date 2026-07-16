"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AcompanharPedido } from "@/components/pedido/acompanhar-pedido";
import type { ItemCarrinho, Loja, Produto } from "@/types/pedeai";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type Etapa = "menu" | "carrinho" | "checkout" | "confirmado";
type Endereco = { id?: string; endereco: string; numero: string; bairro: string; cidade: string; estado: string; complemento?: string | null; referencia?: string | null };
type Resumo = { acompanhamento: string; senhaGerada?: string };
const enderecoVazio: Endereco = { endereco: "", numero: "", bairro: "", cidade: "", estado: "" };

function EtapasCheckout({ etapa }: { etapa: Etapa }) {
  const indice = etapa === "menu" ? 0 : etapa === "carrinho" ? 1 : 2;
  const itens = ["Cardápio", "Carrinho", "Confirmar"];
  return <div className="mx-auto -mt-4 flex max-w-2xl rounded-2xl bg-white p-2 shadow-sm">
    {itens.map((item, posicao) => <div key={item} className="flex flex-1 items-center gap-2 px-2 py-1.5 text-xs font-bold sm:text-sm"><span className={`grid h-6 w-6 place-items-center rounded-full ${posicao <= indice ? "bg-orange-500 text-white" : "bg-stone-100 text-stone-400"}`}>{posicao + 1}</span><span className={posicao === indice ? "text-stone-900" : "hidden text-stone-400 sm:block"}>{item}</span></div>)}
  </div>;
}

export function Cardapio({ loja, produtos, funcionamento }: { loja: Loja; produtos: Produto[]; funcionamento: { aberto: boolean; mensagem: string } }) {
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [etapa, setEtapa] = useState<Etapa>("menu");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [clienteLogado, setClienteLogado] = useState(false);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [endereco, setEndereco] = useState<Endereco>(enderecoVazio);
  const [atendimento, setAtendimento] = useState<"entrega" | "retirada">("entrega");
  const [pagamento, setPagamento] = useState("Pix");
  const [trocoPara, setTrocoPara] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todos");
  const [resumo, setResumo] = useState<Resumo | null>(null);

  const total = useMemo(() => carrinho.reduce((soma, item) => soma + item.preco * item.quantidade, 0), [carrinho]);
  const quantidadeTotal = useMemo(() => carrinho.reduce((soma, item) => soma + item.quantidade, 0), [carrinho]);
  const categorias = useMemo(() => Array.from(new Set(produtos.map((produto) => produto.categoria || "Outros"))), [produtos]);
  const visiveis = categoriaAtiva === "Todos" ? produtos : produtos.filter((produto) => (produto.categoria || "Outros") === categoriaAtiva);

  useEffect(() => {
    let ativo = true;
    async function restaurar() {
      const resposta = await fetch(`/api/cliente-publico?slug=${encodeURIComponent(loja.slug)}`);
      if (!resposta.ok) return;
      const dados = await resposta.json();
      if (!ativo) return;
      setNome(dados.cliente.nome);
      setTelefone(dados.telefone ?? "");
      setEnderecos(dados.enderecos ?? []);
      if (dados.enderecos?.[0]) setEndereco(dados.enderecos[0]);
      setClienteLogado(true);
    }
    void restaurar();
    return () => { ativo = false; };
  }, [loja.slug]);

  function adicionar(produto: Produto) {
    if (!funcionamento.aberto) return setMensagem(funcionamento.mensagem);
    setCarrinho((atual) => {
      const existe = atual.find((item) => item.id === produto.id);
      return existe ? atual.map((item) => item.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item) : [...atual, { ...produto, quantidade: 1 }];
    });
  }

  function alterarQuantidade(id: string, delta: number) {
    setCarrinho((atual) => atual.flatMap((item) => item.id !== id ? [item] : item.quantidade + delta > 0 ? [{ ...item, quantidade: item.quantidade + delta }] : []));
  }

  function alterarEndereco(campo: keyof Endereco, valor: string) {
    setEndereco((atual) => ({ ...atual, [campo]: valor }));
  }

  async function entrar() {
    setMensagem("");
    const resposta = await fetch("/api/cliente-publico", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: loja.slug, telefone, codigo: senha }) });
    const dados = await resposta.json();
    if (!resposta.ok) return setMensagem(dados.error ?? "Não foi possível entrar.");
    setNome(dados.cliente.nome);
    setTelefone(dados.telefone ?? telefone);
    setEnderecos(dados.enderecos ?? []);
    if (dados.enderecos?.[0]) setEndereco(dados.enderecos[0]);
    setSenha("");
    setClienteLogado(true);
  }

  async function finalizar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");
    if (!carrinho.length) return setMensagem("Adicione pelo menos um item ao pedido.");
    if (atendimento === "entrega" && [endereco.endereco, endereco.numero, endereco.bairro, endereco.cidade, endereco.estado].some((campo) => !campo.trim())) return setMensagem("Preencha endereço, número, bairro, cidade e estado.");
    setEnviando(true);
    const resposta = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresaId: loja.id, nome, telefone, codigoCliente: senha, pagamento, observacao,
        tipoAtendimento: atendimento, endereco,
        trocoPara: pagamento === "Dinheiro" && trocoPara ? Number(trocoPara.replace(",", ".")) : null,
        itens: carrinho.map((item) => ({ produtoId: item.id, quantidade: item.quantidade })),
      }),
    });
    const dados = await resposta.json();
    setEnviando(false);
    if (!resposta.ok) return setMensagem(dados.error ?? "Não foi possível enviar o pedido.");
    setResumo({ acompanhamento: dados.acompanhamento, senhaGerada: dados.senhaCliente ?? undefined });
    setCarrinho([]);
    setSenha("");
    setClienteLogado(true);
    setEtapa("confirmado");
  }

  if (etapa === "confirmado" && resumo) return <AcompanharPedido codigo={resumo.acompanhamento} senhaGerada={resumo.senhaGerada} aoVoltar={() => { setResumo(null); setEtapa("menu"); }} />;

  return <main className="min-h-screen bg-stone-50 pb-28 text-stone-900">
    <header className="bg-orange-500 px-5 pb-8 pt-6 text-white">
      <div className="mx-auto max-w-2xl"><div className="flex items-start justify-between gap-3"><div className="flex gap-3">{loja.logo_url && <img src={loja.logo_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />}<div><p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-100">PedeAI</p><h1 className="mt-2 text-3xl font-bold">{loja.nome}</h1><p className="mt-2 text-sm text-orange-50">{funcionamento.aberto ? "Estamos recebendo pedidos." : funcionamento.mensagem}</p></div></div><a href={`/${loja.slug}/meus-pedidos`} className="rounded-xl bg-white/20 px-3 py-2 text-xs font-bold">Meus pedidos</a></div></div>
    </header>

    <section className="mx-auto max-w-2xl px-4">
      <EtapasCheckout etapa={etapa} />
      {!funcionamento.aberto && <p className="mt-3 rounded-2xl bg-stone-900 p-4 text-sm font-semibold text-white shadow-lg">Indisponível agora · {funcionamento.mensagem}</p>}
      {etapa === "menu" && <><div className="mt-4 flex gap-2 overflow-x-auto pb-2">{["Todos", ...categorias].map((categoria) => <button key={categoria} onClick={() => setCategoriaAtiva(categoria)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold shadow-sm ${categoriaAtiva === categoria ? "bg-stone-900 text-white" : "bg-white text-stone-600"}`}>{categoria}</button>)}</div><section className="space-y-3 pt-2">{visiveis.map((produto) => <article key={produto.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm"><div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-orange-100 text-3xl">{produto.imagem_url ? <img src={produto.imagem_url} alt={produto.nome} className="h-full w-full object-cover" /> : "🍔"}</div><div className="flex min-w-0 flex-1 flex-col"><h2 className="font-bold">{produto.nome}</h2>{produto.descricao && <p className="mt-1 text-sm leading-5 text-stone-500">{produto.descricao}</p>}<div className="mt-auto flex items-end justify-between gap-2"><strong className="text-orange-600">{moeda.format(produto.preco)}</strong><button disabled={!funcionamento.aberto} onClick={() => adicionar(produto)} className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Adicionar</button></div></div></article>)}</section></>}

      {etapa === "carrinho" && <section className="pt-6"><button onClick={() => setEtapa("menu")} className="text-sm font-bold text-orange-600">← Continuar comprando</button><div className="mt-3 flex items-end justify-between"><div><h2 className="text-2xl font-bold">Seu carrinho</h2><p className="mt-1 text-sm text-stone-500">Confira itens e quantidades antes de finalizar.</p></div><span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">{quantidadeTotal} itens</span></div><div className="mt-4 space-y-3">{carrinho.map((item) => <article key={item.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"><div className="flex-1"><p className="font-bold">{item.nome}</p><p className="text-sm text-stone-500">{moeda.format(item.preco)} cada</p><strong className="mt-1 block text-sm text-orange-600">{moeda.format(item.preco * item.quantidade)}</strong></div><button type="button" onClick={() => alterarQuantidade(item.id, -1)} className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 font-bold">−</button><strong className="w-5 text-center">{item.quantidade}</strong><button type="button" onClick={() => alterarQuantidade(item.id, 1)} className="grid h-9 w-9 place-items-center rounded-full bg-stone-900 font-bold text-white">+</button></article>)}</div><div className="mt-5 flex justify-between rounded-2xl bg-stone-900 p-4 text-lg font-bold text-white"><span>Total do pedido</span><span>{moeda.format(total)}</span></div><button disabled={!funcionamento.aberto || !carrinho.length} onClick={() => setEtapa("checkout")} className="mt-4 w-full rounded-xl bg-orange-500 py-4 font-bold text-white disabled:opacity-40">Ir para confirmação</button></section>}

      {etapa === "checkout" && <form onSubmit={finalizar} className="space-y-4 pt-6"><button type="button" onClick={() => setEtapa("carrinho")} className="text-sm font-bold text-orange-600">← Voltar ao carrinho</button><div><h2 className="text-2xl font-bold">Confirme seu pedido</h2><p className="mt-1 text-sm text-stone-500">Revise os dados; você poderá acompanhar o preparo após concluir.</p></div><section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-bold">Resumo do pedido</h3><button type="button" onClick={() => setEtapa("carrinho")} className="text-sm font-bold text-orange-600">Alterar itens</button></div>{carrinho.map((item) => <div key={item.id} className="mt-3 flex justify-between text-sm"><span>{item.quantidade}x {item.nome}</span><strong>{moeda.format(item.quantidade * item.preco)}</strong></div>)}<div className="mt-4 flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span className="text-orange-700">{moeda.format(total)}</span></div></section><section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"><h3 className="font-bold">1. Seus dados</h3><input required value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Seu nome" className="campo" /><input required value={telefone} onChange={(event) => { setTelefone(event.target.value); setClienteLogado(false); }} placeholder="WhatsApp com DDD" className="campo" />{!clienteLogado && <><div className="flex gap-2"><input value={senha} onChange={(event) => setSenha(event.target.value.toUpperCase())} maxLength={6} placeholder="Senha, se já comprou" className="campo" /><button type="button" onClick={() => void entrar()} className="rounded-xl bg-stone-900 px-3 text-sm font-bold text-white">Entrar</button></div><p className="text-xs text-stone-500">Na primeira compra, sua senha de acesso será criada ao confirmar.</p></>}{clienteLogado && <p className="rounded-xl bg-green-50 p-3 text-xs font-bold text-green-700">Você está conectado. Seus dados foram carregados.</p>}</section><section className="rounded-2xl bg-white p-4 shadow-sm"><h3 className="font-bold">2. Como quer receber?</h3><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setAtendimento("entrega")} className={`rounded-xl p-3 text-sm font-bold ${atendimento === "entrega" ? "bg-stone-900 text-white" : "bg-stone-100"}`}>Entrega</button><button type="button" onClick={() => setAtendimento("retirada")} className={`rounded-xl p-3 text-sm font-bold ${atendimento === "retirada" ? "bg-stone-900 text-white" : "bg-stone-100"}`}>Retirada</button></div>{atendimento === "entrega" && <div className="mt-4">{enderecos.length > 0 && <select onChange={(event) => { const salvo = enderecos.find((item) => item.id === event.target.value); if (salvo) setEndereco(salvo); }} className="campo mb-3"><option value="">Usar endereço salvo</option>{enderecos.map((item) => <option key={item.id} value={item.id}>{item.endereco}, {item.numero} · {item.bairro}</option>)}</select>}<div className="grid grid-cols-2 gap-2"><input required value={endereco.endereco} onChange={(event) => alterarEndereco("endereco", event.target.value)} placeholder="Endereço" className="campo col-span-2" /><input required value={endereco.numero} onChange={(event) => alterarEndereco("numero", event.target.value)} placeholder="Número" className="campo" /><input required value={endereco.bairro} onChange={(event) => alterarEndereco("bairro", event.target.value)} placeholder="Bairro" className="campo" /><input required value={endereco.cidade} onChange={(event) => alterarEndereco("cidade", event.target.value)} placeholder="Cidade" className="campo" /><input required value={endereco.estado} onChange={(event) => alterarEndereco("estado", event.target.value)} placeholder="Estado (UF)" maxLength={2} className="campo" /><input value={endereco.complemento ?? ""} onChange={(event) => alterarEndereco("complemento", event.target.value)} placeholder="Complemento (opcional)" className="campo col-span-2" /><input value={endereco.referencia ?? ""} onChange={(event) => alterarEndereco("referencia", event.target.value)} placeholder="Ponto de referência (opcional)" className="campo col-span-2" /></div></div>}</section><section className="rounded-2xl bg-white p-4 shadow-sm"><h3 className="font-bold">3. Pagamento</h3><div className="mt-3 grid grid-cols-3 gap-2">{["Pix", "Cartão", "Dinheiro"].map((opcao) => <button key={opcao} type="button" onClick={() => setPagamento(opcao)} className={`rounded-xl p-3 text-sm font-bold ${pagamento === opcao ? "bg-stone-900 text-white" : "bg-stone-100"}`}>{opcao}</button>)}</div>{pagamento === "Dinheiro" && <input value={trocoPara} onChange={(event) => setTrocoPara(event.target.value)} inputMode="decimal" placeholder="Troco para quanto? Ex.: 50,00" className="campo mt-3" />}<textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} placeholder="Observação do pedido (opcional)" rows={2} className="campo mt-3" /></section>{mensagem && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{mensagem}</p>}<button disabled={enviando || !funcionamento.aberto || !carrinho.length} className="w-full rounded-xl bg-orange-500 py-4 font-bold text-white disabled:opacity-50">{enviando ? "Enviando pedido..." : `Confirmar pedido · ${moeda.format(total)}`}</button></form>}
    </section>

    {carrinho.length > 0 && etapa === "menu" && funcionamento.aberto && <button onClick={() => setEtapa("carrinho")} className="fixed inset-x-4 bottom-4 z-20 mx-auto flex max-w-2xl items-center justify-between rounded-2xl bg-stone-900 px-5 py-4 font-bold text-white shadow-xl"><span>{quantidadeTotal} itens · Ver carrinho</span><span>{moeda.format(total)}</span></button>}
  </main>;
}
