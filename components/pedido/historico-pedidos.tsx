"use client";

import { FormEvent, useState } from "react";

type Pedido = { codigo_acompanhamento: string; status: string; total: number; created_at: string };

export function HistoricoPedidos({ slug }: { slug: string }) {
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [novoCodigo, setNovoCodigo] = useState("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [acessoConfirmado, setAcessoConfirmado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  async function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setAviso("");
    setAcessoConfirmado(false);
    const resposta = await fetch("/api/historico-pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, telefone, codigo }),
    });
    const resultado = await resposta.json();
    if (!resposta.ok) return setErro(resultado.error ?? "Não foi possível consultar.");
    setPedidos(resultado);
    setAcessoConfirmado(true);
  }

  async function trocarCodigo() {
    setErro("");
    setAviso("");
    const resposta = await fetch("/api/cliente-publico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "alterar-codigo", slug, telefone, codigo, novoCodigo }),
    });
    const resultado = await resposta.json();
    if (!resposta.ok) return setErro(resultado.error ?? "Não foi possível trocar o código.");
    setCodigo(novoCodigo);
    setNovoCodigo("");
    setAviso("Código alterado com sucesso. Guarde o novo código em um local seguro.");
  }

  return (
    <main className="min-h-screen bg-stone-50 p-5 text-stone-900">
      <section className="mx-auto max-w-md">
        <a href={`/${slug}`} className="text-sm font-bold text-orange-600">← Cardápio</a>
        <h1 className="mt-4 text-3xl font-bold">Meus pedidos</h1>
        <p className="mt-2 text-sm text-stone-600">Informe o WhatsApp e o código pessoal recebido na primeira compra. Perdeu o código? Peça a redefinição diretamente ao restaurante.</p>

        <form onSubmit={buscar} className="mt-5 space-y-2">
          <input required value={telefone} onChange={(event) => setTelefone(event.target.value)} placeholder="Seu WhatsApp" className="campo" />
          <input required maxLength={6} value={codigo} onChange={(event) => setCodigo(event.target.value.toUpperCase())} placeholder="Código pessoal de 6 caracteres" className="campo" />
          <button className="w-full rounded-xl bg-stone-900 py-3 font-bold text-white">Acessar meus pedidos</button>
        </form>

        {acessoConfirmado && <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm font-bold">Trocar código de acesso</p>
          <p className="mt-1 text-xs text-stone-500">Escolha outro código de seis letras ou números.</p>
          <div className="mt-2 flex gap-2">
            <input maxLength={6} value={novoCodigo} onChange={(event) => setNovoCodigo(event.target.value.toUpperCase())} placeholder="Novo código" className="campo" />
            <button type="button" onClick={trocarCodigo} className="rounded-xl bg-stone-900 px-3 text-sm font-bold text-white">Trocar</button>
          </div>
        </section>}

        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
        {aviso && <p className="mt-3 text-sm text-green-700">{aviso}</p>}

        {acessoConfirmado && pedidos.length === 0 && <p className="mt-5 rounded-2xl bg-white p-4 text-sm text-stone-600 shadow-sm">Nenhum pedido encontrado neste restaurante.</p>}
        <div className="mt-5 space-y-3">
          {pedidos.map((pedido) => <a key={pedido.codigo_acompanhamento} href={`/pedido/${pedido.codigo_acompanhamento}`} className="block rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex justify-between"><strong>{pedido.status.replaceAll("_", " ")}</strong><strong>R$ {Number(pedido.total).toFixed(2)}</strong></div>
            <p className="mt-1 text-sm text-stone-500">{new Date(pedido.created_at).toLocaleString("pt-BR")}</p>
          </a>)}
        </div>
      </section>
    </main>
  );
}
