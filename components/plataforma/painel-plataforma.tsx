"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Empresa = { id: string; nome: string; slug: string; bloqueada: boolean; pendente_aprovacao: boolean };

export function PainelPlataforma() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [erro, setErro] = useState("");
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function requisicao(url: string, options?: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(url, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` } });
  }
  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/admin"); return; }
    const resposta = await requisicao("/api/plataforma/restaurantes"); const json = await resposta.json();
    if (!resposta.ok) setErro(json.error); else setEmpresas(json);
  }
  useEffect(() => { carregar(); }, []);
  async function criar(event: FormEvent) {
    event.preventDefault(); setErro("");
    const resposta = await requisicao("/api/plataforma/restaurantes", { method: "POST", body: JSON.stringify({ nome, slug, email, senha }) }); const json = await resposta.json();
    if (!resposta.ok) return setErro(json.error); setNome(""); setSlug(""); setEmail(""); setSenha(""); carregar();
  }
  async function acao(empresaId: string, acao: string, dados: Record<string, unknown> = {}) {
    const resposta = await requisicao("/api/plataforma/restaurantes", { method: "PATCH", body: JSON.stringify({ empresaId, acao, ...dados }) }); const json = await resposta.json();
    if (!resposta.ok) setErro(json.error); else carregar();
  }
  return <main className="mx-auto min-h-screen max-w-5xl bg-stone-50 p-5 text-stone-900"><p className="text-sm font-bold uppercase tracking-widest text-orange-500">PedeAI · Plataforma</p><h1 className="mt-1 text-3xl font-bold">Restaurantes</h1><section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Criar restaurante e administrador</h2><form onSubmit={criar} className="mt-4 grid gap-2 md:grid-cols-2"><input required value={nome} onChange={e=>setNome(e.target.value)} placeholder="Nome do restaurante" className="campo"/><input required value={slug} onChange={e=>setSlug(e.target.value)} placeholder="Link: minha-lanchonete" className="campo"/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail do administrador" className="campo"/><input required type="password" minLength={6} value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Senha inicial" className="campo"/><button className="rounded-xl bg-orange-500 px-4 py-3 font-bold text-white md:col-span-2">Criar restaurante e acesso</button></form>{erro&&<p className="mt-3 text-sm text-red-600">{erro}</p>}</section><section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Cadastros e restaurantes</h2>{empresas.map(empresa=><article key={empresa.id} className="mt-4 rounded-xl border border-stone-100 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">{empresa.nome}</p><p className="text-sm text-stone-500">/loja/{empresa.slug}{empresa.bloqueada?" · BLOQUEADO":empresa.pendente_aprovacao?" · AGUARDANDO APROVAÇÃO":""}</p></div><div className="flex flex-wrap gap-2">{empresa.pendente_aprovacao&&<button onClick={()=>acao(empresa.id,"aprovar")} className="rounded-lg bg-green-100 px-3 py-2 text-sm font-semibold text-green-800">Aprovar</button>}<button onClick={()=>acao(empresa.id,"bloquear",{bloqueada:!empresa.bloqueada})} className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-semibold">{empresa.bloqueada?"Desbloquear":"Bloquear"}</button><button onClick={()=>{const nova=prompt("Nova senha (mínimo 6 caracteres):");if(nova)acao(empresa.id,"senha",{senha:nova});}} className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-semibold">Redefinir senha</button><button onClick={()=>{const conteudo=prompt("Mensagem para o restaurante:");if(conteudo)acao(empresa.id,"mensagem",{titulo:"Comunicado PedeAI",conteudo});}} className="rounded-lg bg-orange-100 px-3 py-2 text-sm font-semibold text-orange-800">Enviar mensagem</button></div></div></article>)}</section></main>;
}
