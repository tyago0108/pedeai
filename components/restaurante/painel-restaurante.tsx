"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { MensagensPlataforma } from "@/components/restaurante/mensagens-plataforma";

export function PainelRestaurante() {
  const router = useRouter();
  const [nome, setNome] = useState("Meu restaurante");
  const [slug, setSlug] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(true);
  const [pedidosAbertos, setPedidosAbertos] = useState(0);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    async function iniciar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/restaurante/login"); return; }
      const { data: perfil } = await supabase.from("perfis").select("empresa_id,empresas(nome,slug,notificacoes_ativas)").single();
      if (!perfil) { setErro("Este usuário não está vinculado a um restaurante."); return; }
      const empresa = Array.isArray(perfil.empresas) ? perfil.empresas[0] : perfil.empresas;
      if (!ativo || !empresa) return;
      setEmpresaId(perfil.empresa_id);
      setNome(empresa.nome ?? "Meu restaurante");
      setSlug(empresa.slug ?? "");
      setNotificacoesAtivas(empresa.notificacoes_ativas ?? true);
    }
    void iniciar();
    return () => { ativo = false; };
  }, [router]);

  useEffect(() => {
    if (!empresaId || !notificacoesAtivas) return;
    let ativo = true;
    async function contar() {
      const { count } = await supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("status", "recebido");
      if (ativo) setPedidosAbertos(count ?? 0);
    }
    void contar();
    const intervalo = window.setInterval(() => { void contar(); }, 30000);
    return () => { ativo = false; window.clearInterval(intervalo); };
  }, [empresaId, notificacoesAtivas]);

  async function sair() { await supabase.auth.signOut(); router.replace("/entrar"); }
  const opcoes = [
    ["Pedidos", "Fila ao vivo, alertas, status e vendas de balcão.", "/restaurante/pedidos", "🧾"],
    ["Cardápio", "Produtos, fotos, preços e adicionais.", "/restaurante/cardapio", "🍔"],
    ["Configurações", "Pix, notificações, entrega e funcionamento.", "/restaurante/configuracoes", "⚙️"],
  ];

  return <main className="min-h-screen bg-stone-50 p-5 text-stone-900"><header className="mx-auto flex max-w-4xl items-center justify-between gap-3 py-4"><div><p className="text-sm font-bold uppercase tracking-widest text-orange-500">PedeAI</p><h1 className="text-2xl font-bold">{nome}</h1></div><button onClick={sair} className="rounded-xl bg-stone-900 px-4 py-2 font-bold text-white">Sair</button></header><section className="mx-auto max-w-4xl"><div className="mt-4 rounded-2xl bg-orange-500 p-5 text-white"><p className="text-sm font-bold">Link público do seu cardápio</p><p className="mt-1 text-sm text-orange-50">Compartilhe este endereço com seus clientes.</p>{slug && <Link href={`/${slug}`} target="_blank" className="mt-3 block rounded-xl bg-white px-4 py-3 font-bold text-orange-700">/{slug}</Link>}</div><MensagensPlataforma /><h2 className="mt-6 text-xl font-bold">Central do restaurante</h2>{erro && <p className="mt-3 rounded-xl bg-red-50 p-3 text-red-700">{erro}</p>}<div className="mt-4 grid gap-4 md:grid-cols-3">{opcoes.map(([titulo, descricao, href, icone]) => <Link key={href} href={href} className={`relative rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md ${titulo === "Pedidos" && pedidosAbertos ? "ring-2 ring-orange-400" : ""}`}><span className="text-3xl">{icone}</span>{titulo === "Pedidos" && pedidosAbertos > 0 && <span className="absolute right-4 top-4 animate-pulse rounded-full bg-orange-500 px-2 py-1 text-xs font-bold text-white">{pedidosAbertos} novo(s)</span>}<h3 className="mt-4 font-bold">{titulo}</h3><p className="mt-1 text-sm text-stone-500">{descricao}</p></Link>)}</div></section></main>;
}
