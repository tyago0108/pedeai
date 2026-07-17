"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Mensagem = { id: string; titulo: string; conteudo: string; created_at: string };

export function MensagensPlataforma() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const { data: perfil } = await supabase.from("perfis").select("empresa_id").single();
      if (!perfil) return;
      const { data } = await supabase.from("mensagens_plataforma").select("id,titulo,conteudo,created_at").eq("empresa_id", perfil.empresa_id).order("created_at", { ascending: false }).limit(5);
      if (ativo) setMensagens(data ?? []);
    }
    void carregar();
    return () => { ativo = false; };
  }, []);
  if (!mensagens.length) return null;
  return <section className="mt-5 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-widest text-orange-500">Comunicados PedeAI</p>{mensagens.map((mensagem) => <article key={mensagem.id} className="mt-3 border-t border-stone-100 pt-3 first:border-0 first:pt-0"><h3 className="text-sm font-bold">{mensagem.titulo}</h3><p className="mt-1 text-sm leading-6 text-stone-600">{mensagem.conteudo}</p></article>)}</section>;
}
