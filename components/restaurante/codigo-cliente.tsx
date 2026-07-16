"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function CodigoCliente() {
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");
    setSalvando(true);

    const { data: { session } } = await supabase.auth.getSession();
    const resposta = await fetch("/api/restaurante/clientes", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ telefone, codigo }),
    });
    const resultado = await resposta.json();
    setSalvando(false);

    if (!resposta.ok) return setMensagem(resultado.error ?? "Não foi possível atualizar o acesso.");
    setCodigo(resultado.codigo);
    setMensagem(`Código de ${resultado.nome}: ${resultado.codigo}`);
  }

  return (
    <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="font-bold">Acesso de clientes</h2>
      <p className="mt-1 text-sm text-stone-500">Use somente quando um cliente pedir ajuda para recuperar ou trocar seu código pessoal.</p>
      <form onSubmit={salvar} className="mt-3 space-y-2">
        <input value={telefone} onChange={(event) => setTelefone(event.target.value)} placeholder="WhatsApp do cliente com DDD" required className="campo" />
        <input value={codigo} onChange={(event) => setCodigo(event.target.value.toUpperCase())} maxLength={6} placeholder="Novo código de 6 caracteres (opcional)" className="campo" />
        <button disabled={salvando} className="rounded-xl bg-stone-900 px-4 py-3 font-bold text-white disabled:opacity-50">
          {salvando ? "Atualizando..." : "Gerar ou alterar código"}
        </button>
      </form>
      {mensagem && <p className="mt-3 text-sm font-semibold text-orange-700">{mensagem}</p>}
    </section>
  );
}
