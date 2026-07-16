"use client";

import { FormEvent, useEffect, useState } from "react";

type Pedido = { codigo_acompanhamento: string; status: string; total: number; created_at: string };
type RespostaHistorico = { pedidos: Pedido[]; telefone: string };

export function HistoricoPedidos({ slug }: { slug: string }) {
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [acessoConfirmado, setAcessoConfirmado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  function aplicarHistorico(dados: RespostaHistorico) {
    setPedidos(dados.pedidos ?? []);
    setTelefone(dados.telefone ?? "");
    setAcessoConfirmado(true);
  }

  useEffect(() => {
    let ativo = true;
    fetch(`/api/historico-pedidos?slug=${encodeURIComponent(slug)}`)
      .then(async (resposta) => ({ ok: resposta.ok, dados: await resposta.json() }))
      .then(({ ok, dados }) => { if (ativo && ok) aplicarHistorico(dados); })
      .catch(() => undefined);
    return () => { ativo = false; };
  }, [slug]);

  async function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setAviso("");
    const resposta = await fetch("/api/historico-pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, telefone, codigo: senha }) });
    const dados = await resposta.json();
    if (!resposta.ok) return setErro(dados.error ?? "Não foi possível consultar.");
    aplicarHistorico(dados);
  }

  async function trocarSenha() {
    setErro("");
    setAviso("");
    const resposta = await fetch("/api/cliente-publico", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "alterar-senha", slug, telefone, codigo: senha, novaSenha }) });
    const dados = await resposta.json();
    if (!resposta.ok) return setErro(dados.error ?? "Não foi possível trocar a senha.");
    setSenha(novaSenha);
    setNovaSenha("");
    setAviso("Senha alterada com sucesso. Guarde a nova senha.");
  }

  async function sair() {
    await fetch(`/api/cliente-publico?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
    setPedidos([]);
    setTelefone("");
    setSenha("");
    setAcessoConfirmado(false);
    setAviso("Você saiu deste restaurante neste aparelho.");
  }

  return (
    <main className="min-h-screen bg-stone-50 p-5 text-stone-900">
      <section className="mx-auto max-w-md">
        <a href={`/${slug}`} className="text-sm font-bold text-orange-600">← Cardápio</a>
        <h1 className="mt-4 text-3xl font-bold">Meus pedidos</h1>
        <p className="mt-2 text-sm text-stone-600">Use seu WhatsApp e sua senha de acesso. Ao entrar, este aparelho permanece conectado com segurança.</p>

        {!acessoConfirmado && <form onSubmit={buscar} className="mt-5 space-y-2"><input required value={telefone} onChange={(event) => setTelefone(event.target.value)} placeholder="Seu WhatsApp" className="campo" /><input required maxLength={6} value={senha} onChange={(event) => setSenha(event.target.value.toUpperCase())} placeholder="Senha de 6 caracteres" className="campo" /><button className="w-full rounded-xl bg-stone-900 py-3 font-bold text-white">Entrar e ver meus pedidos</button></form>}

        {acessoConfirmado && <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="font-bold">Você está conectado</p><p className="mt-1 text-xs text-stone-500">Pedidos e endereços deste restaurante ficam protegidos.</p></div><button type="button" onClick={sair} className="text-sm font-bold text-orange-600">Sair</button></div>{senha && <div className="mt-4 border-t pt-4"><p className="text-sm font-bold">Trocar senha</p><div className="mt-2 flex gap-2"><input maxLength={6} value={novaSenha} onChange={(event) => setNovaSenha(event.target.value.toUpperCase())} placeholder="Nova senha" className="campo" /><button type="button" onClick={trocarSenha} className="rounded-xl bg-stone-900 px-3 text-sm font-bold text-white">Trocar</button></div></div>}</section>}

        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
        {aviso && <p className="mt-3 text-sm text-green-700">{aviso}</p>}
        {acessoConfirmado && pedidos.length === 0 && <p className="mt-5 rounded-2xl bg-white p-4 text-sm text-stone-600 shadow-sm">Nenhum pedido encontrado neste restaurante.</p>}
        <div className="mt-5 space-y-3">{pedidos.map((pedido) => <a key={pedido.codigo_acompanhamento} href={`/pedido/${pedido.codigo_acompanhamento}`} className="block rounded-2xl bg-white p-4 shadow-sm"><div className="flex justify-between"><strong>{pedido.status.replaceAll("_", " ")}</strong><strong>R$ {Number(pedido.total).toFixed(2)}</strong></div><p className="mt-1 text-sm text-stone-500">{new Date(pedido.created_at).toLocaleString("pt-BR")}</p></a>)}</div>
      </section>
    </main>
  );
}
