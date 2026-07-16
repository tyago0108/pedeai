"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export function LoginSistema() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setErro(""); setEnviando(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
    if (error || !data.user) { setEnviando(false); return setErro("E-mail ou senha inválidos."); }

    const { data: master } = await supabase.from("administradores_plataforma").select("id").eq("id", data.user.id).maybeSingle();
    if (master) { router.replace("/plataforma"); router.refresh(); return; }

    const { data: perfil } = await supabase.from("perfis").select("id").eq("id", data.user.id).maybeSingle();
    if (perfil) { router.replace("/restaurante"); router.refresh(); return; }

    await supabase.auth.signOut(); setEnviando(false);
    setErro("Este acesso não está vinculado a um painel de gestão.");
  }

  return <main className="grid min-h-screen place-items-center bg-stone-950 p-5"><form onSubmit={entrar} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"><p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-500">PedeAI Gestão</p><h1 className="mt-3 text-2xl font-bold text-stone-900">Entrar no painel</h1><p className="mt-2 text-sm leading-6 text-stone-500">Acesso exclusivo para a administração da plataforma e dos restaurantes.</p><div className="mt-6 space-y-3"><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail" className="campo"/><input required type="password" autoComplete="current-password" value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Senha" className="campo"/>{erro && <p className="text-sm text-red-600">{erro}</p>}<button disabled={enviando} className="w-full rounded-xl bg-orange-500 py-3 font-bold text-white disabled:opacity-50">{enviando ? "Entrando..." : "Entrar"}</button></div></form></main>;
}
