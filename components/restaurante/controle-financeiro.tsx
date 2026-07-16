"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Pedido = { id: string; total: number; status: string; pagamento: string; pago: boolean; created_at: string };
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ControleFinanceiro() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => { async function carregar() { const { data: { user } } = await supabase.auth.getUser(); if (!user) return router.replace("/restaurante/login"); const { data: perfil } = await supabase.from("perfis").select("empresa_id").single(); if (!perfil) return; const { data } = await supabase.from("pedidos").select("id,total,status,pagamento,pago,created_at").eq("empresa_id", perfil.empresa_id).order("created_at", { ascending: false }); setPedidos((data ?? []).map((pedido) => ({ ...pedido, total: Number(pedido.total) }))); setCarregando(false); } void carregar(); }, [router]);
  const inicioHoje = useMemo(() => { const data = new Date(); data.setHours(0, 0, 0, 0); return data; }, []);
  const inicioMes = useMemo(() => new Date(inicioHoje.getFullYear(), inicioHoje.getMonth(), 1), [inicioHoje]);
  const recebidos = pedidos.filter((pedido) => pedido.pago && pedido.status !== "cancelado");
  const pendentes = pedidos.filter((pedido) => !pedido.pago && pedido.status !== "cancelado");
  const soma = (inicio: Date) => recebidos.filter((pedido) => new Date(pedido.created_at) >= inicio).reduce((total, pedido) => total + pedido.total, 0);
  const porPagamento = Object.entries(recebidos.reduce<Record<string, number>>((total, pedido) => ({ ...total, [pedido.pagamento]: (total[pedido.pagamento] ?? 0) + pedido.total }), {}));
  if (carregando) return <main className="grid min-h-screen place-items-center bg-stone-50">Carregando financeiro...</main>;
  return <main className="min-h-screen bg-stone-50 p-5 text-stone-900"><header className="mx-auto flex max-w-4xl items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-orange-500">PedeAI · Restaurante</p><h1 className="text-2xl font-bold">Controle financeiro</h1></div><Link href="/restaurante" className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-bold text-white">Painel</Link></header><p className="mx-auto mt-4 max-w-4xl text-sm text-stone-600">O faturamento considera somente pedidos marcados como pagos pela equipe.</p><section className="mx-auto mt-4 grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-4"><article className="rounded-2xl bg-stone-900 p-4 text-white"><p className="text-xs text-stone-300">Recebido hoje</p><p className="mt-2 text-xl font-bold">{moeda.format(soma(inicioHoje))}</p></article><article className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-stone-500">Recebido no mês</p><p className="mt-2 text-xl font-bold">{moeda.format(soma(inicioMes))}</p></article><article className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-stone-500">Pedidos pagos</p><p className="mt-2 text-xl font-bold">{recebidos.length}</p></article><article className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-stone-500">Aguardando confirmação</p><p className="mt-2 text-xl font-bold">{pendentes.length}</p></article></section><section className="mx-auto mt-5 max-w-4xl rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Recebimentos por pagamento</h2><div className="mt-4 space-y-3">{porPagamento.length ? porPagamento.map(([metodo, valor]) => <div key={metodo} className="flex items-center justify-between border-b border-stone-100 pb-3"><span className="font-medium">{metodo}</span><strong className="text-orange-600">{moeda.format(valor)}</strong></div>) : <p className="text-sm text-stone-500">Nenhum pagamento confirmado ainda.</p>}</div></section></main>;
}
