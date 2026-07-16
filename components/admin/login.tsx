"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export function LoginAdmin({ redirectTo = "/admin/pedidos" }: { redirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setEnviando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });

    setEnviando(false);
    if (error) return setErro(error.message);

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-stone-950 px-4">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <p className="text-sm font-bold uppercase tracking-widest text-orange-500">PedeAI</p>
        <h1 className="mt-2 text-2xl font-bold text-stone-900">Acesso da lanchonete</h1>
        <p className="mt-2 text-sm text-stone-500">Entre para acompanhar e organizar pedidos.</p>
        <div className="mt-6 space-y-3">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className="w-full rounded-xl border border-stone-200 px-4 py-3" />
          <input required type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" className="w-full rounded-xl border border-stone-200 px-4 py-3" />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button disabled={enviando} className="w-full rounded-xl bg-orange-500 py-3 font-bold text-white disabled:opacity-50">{enviando ? "Entrando..." : "Entrar"}</button>
        </div>
      </form>
    </main>
  );
}
