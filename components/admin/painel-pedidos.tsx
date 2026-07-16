"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Pedido = { id: string; cliente_nome: string; cliente_telefone: string | null; tipo_entrega: string; status: string; pagamento: string; total: number; created_at: string };
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const rotulos: Record<string, string> = { recebido: "Recebido", preparando: "Preparando", saiu_para_entrega: "Saiu para entrega", entregue: "Entregue", cancelado: "Cancelado" };

export function PainelPedidos() {
  const router = useRouter(); const [pedidos, setPedidos] = useState<Pedido[]>([]); const [carregando, setCarregando] = useState(true); const [erro, setErro] = useState("");
  async function carregar() {
    setCarregando(true); const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/admin"); return; }
    const { data: perfil, error: perfilError } = await supabase.from("perfis").select("empresa_id, empresas(nome, slug)").single();
    if (perfilError || !perfil) { setErro("Este usuário não está vinculado a uma lanchonete. Consulte a configuração do Supabase."); setCarregando(false); return; }
    const { data, error } = await supabase.from("pedidos").select("id, cliente_nome, cliente_telefone, tipo_entrega, status, pagamento, total, created_at").eq("empresa_id", perfil.empresa_id).order("created_at", { ascending: false });
    if (error) setErro("Não foi possível carregar os pedidos."); else setPedidos((data ?? []).map((pedido) => ({ ...pedido, total: Number(pedido.total) })));
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);
  async function atualizarStatus(id: string, status: string) { const { error } = await supabase.from("pedidos").update({ status }).eq("id", id); if (!error) setPedidos((atual) => atual.map((pedido) => pedido.id === id ? { ...pedido, status } : pedido)); }
  async function sair() { await supabase.auth.signOut(); router.replace("/admin"); }
  if (carregando) return <main className="grid min-h-screen place-items-center">Carregando pedidos...</main>;
  return <main className="min-h-screen bg-stone-50 p-4 text-stone-900"><header className="mx-auto flex max-w-4xl items-center justify-between py-5"><div><p className="text-sm font-bold uppercase tracking-widest text-orange-500">PedeAI</p><h1 className="text-2xl font-bold">Pedidos</h1></div><div className="flex gap-2"><button onClick={carregar} className="rounded-xl bg-white px-4 py-2 font-semibold shadow-sm">Atualizar</button><button onClick={sair} className="rounded-xl bg-stone-900 px-4 py-2 font-semibold text-white">Sair</button></div></header><section className="mx-auto max-w-4xl">{erro ? <p className="rounded-xl bg-red-50 p-4 text-red-700">{erro}</p> : pedidos.length === 0 ? <p className="rounded-xl bg-white p-6 text-stone-500 shadow-sm">Ainda não há pedidos. Compartilhe o link do seu cardápio para começar.</p> : <div className="grid gap-4 md:grid-cols-2">{pedidos.map((pedido) => <article key={pedido.id} className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="font-bold">{pedido.cliente_nome}</p><p className="text-sm text-stone-500">{pedido.tipo_entrega === "local" ? "Venda local" : "WhatsApp"} · {pedido.pagamento}</p></div><p className="font-bold text-orange-600">{moeda.format(pedido.total)}</p></div><select value={pedido.status} onChange={(e) => atualizarStatus(pedido.id, e.target.value)} className="mt-4 w-full rounded-xl border border-stone-200 px-3 py-2 font-medium"><option value="recebido">{rotulos.recebido}</option><option value="preparando">{rotulos.preparando}</option><option value="saiu_para_entrega">{rotulos.saiu_para_entrega}</option><option value="entregue">{rotulos.entregue}</option><option value="cancelado">{rotulos.cancelado}</option></select></article>)}</div>}</section></main>;
}
