"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export function PainelRestaurante() {
  const router = useRouter();
  const [nome, setNome] = useState("Meu restaurante");
  const [slug, setSlug] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/restaurante/login"); return; }
    const { data: perfil } = await supabase.from("perfis").select("empresas(nome, slug)").single();
    if (!perfil) { setErro("Este usuário não está vinculado a um restaurante."); return; }
    const empresa = Array.isArray(perfil.empresas) ? perfil.empresas[0] : perfil.empresas;
    if (empresa?.nome) setNome(empresa.nome);
    if (empresa?.slug) setSlug(empresa.slug);
  })(); }, [router]);
  async function sair() { await supabase.auth.signOut(); router.replace("/entrar"); }
  const opcoes = [
    ["Pedidos", "Fila ao vivo, status e vendas de balcão.", "/restaurante/pedidos", "🧾"],
    ["Cardápio", "Produtos, fotos, preços e adicionais.", "/restaurante/cardapio", "🍔"],
    ["Configurações", "Pagamento, entrega e tempo médio.", "/restaurante/configuracoes", "⚙️"],
  ];
  return <main className="min-h-screen bg-stone-50 p-5 text-stone-900"><header className="mx-auto flex max-w-4xl items-center justify-between gap-3 py-4"><div><p className="text-sm font-bold uppercase tracking-widest text-orange-500">PedeAI</p><h1 className="text-2xl font-bold">{nome}</h1></div><button onClick={sair} className="rounded-xl bg-stone-900 px-4 py-2 font-bold text-white">Sair</button></header><section className="mx-auto max-w-4xl"><div className="mt-4 rounded-2xl bg-orange-500 p-5 text-white"><p className="text-sm font-bold">Link público do seu cardápio</p><p className="mt-1 text-sm text-orange-50">Compartilhe este endereço com seus clientes.</p>{slug && <Link href={`/${slug}`} target="_blank" className="mt-3 block rounded-xl bg-white px-4 py-3 font-bold text-orange-700">/{slug}</Link>}</div><h2 className="mt-6 text-xl font-bold">Central do restaurante</h2>{erro && <p className="mt-3 rounded-xl bg-red-50 p-3 text-red-700">{erro}</p>}<div className="mt-4 grid gap-4 md:grid-cols-3">{opcoes.map(([titulo, descricao, href, icone]) => <Link key={href} href={href} className="rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"><span className="text-3xl">{icone}</span><h3 className="mt-4 font-bold">{titulo}</h3><p className="mt-1 text-sm text-stone-500">{descricao}</p></Link>)}</div></section></main>;
}
