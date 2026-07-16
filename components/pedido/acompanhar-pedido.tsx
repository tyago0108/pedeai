"use client";

import { useEffect, useState } from "react";

type Pedido = { cliente_nome: string; status: string; total: number; created_at: string; tipo_atendimento: string; empresas: { nome: string; tempo_entrega_minutos: number } | { nome: string; tempo_entrega_minutos: number }[] | null };
const etapas = ["recebido", "preparando", "saiu_para_entrega", "entregue"];
const mensagens: Record<string, { titulo: string; texto: string; emoji: string }> = {
  recebido: { titulo: "Pedido recebido", texto: "Estamos conferindo tudo e separando os ingredientes.", emoji: "🧾" },
  preparando: { titulo: "Na cozinha", texto: "Hora de prensar o hambúrguer e caprichar no seu pedido.", emoji: "🍔" },
  saiu_para_entrega: { titulo: "A caminho", texto: "Seu pedido saiu da cozinha e está indo até você.", emoji: "🛵" },
  entregue: { titulo: "Pedido concluído", texto: "Bom apetite! Esperamos que você aproveite muito.", emoji: "✨" },
  cancelado: { titulo: "Pedido cancelado", texto: "Fale com o restaurante para mais informações.", emoji: "⚠️" },
};

export function AcompanharPedido({ codigo }: { codigo: string }) {
  const [pedido, setPedido] = useState<Pedido | null>(null); const [erro, setErro] = useState("");
  async function carregar() { const resposta = await fetch(`/api/acompanhamento?codigo=${encodeURIComponent(codigo)}`); const json = await resposta.json(); if (!resposta.ok) setErro(json.error ?? "Pedido não encontrado."); else setPedido(json); }
  useEffect(() => { carregar(); const intervalo = window.setInterval(carregar, 10000); return () => window.clearInterval(intervalo); }, [codigo]);
  if (erro) return <main className="grid min-h-screen place-items-center bg-stone-50 p-5 text-stone-900"><p className="rounded-2xl bg-white p-5 text-center shadow-sm">{erro}</p></main>;
  if (!pedido) return <main className="grid min-h-screen place-items-center bg-stone-50 text-stone-600">Atualizando pedido...</main>;
  const empresa = Array.isArray(pedido.empresas) ? pedido.empresas[0] : pedido.empresas; const info = mensagens[pedido.status] ?? mensagens.recebido; const indice = etapas.indexOf(pedido.status);
  return <main className="min-h-screen bg-stone-50 p-5 text-stone-900"><section className="mx-auto max-w-md"><p className="text-sm font-bold uppercase tracking-widest text-orange-500">{empresa?.nome ?? "PedeAI"}</p><h1 className="mt-2 text-3xl font-bold">Acompanhar pedido</h1><p className="mt-1 text-sm text-stone-500">Olá, {pedido.cliente_nome}. Esta tela atualiza automaticamente.</p><article className="mt-6 rounded-3xl bg-white p-6 text-center shadow-sm"><div className="text-5xl">{info.emoji}</div><h2 className="mt-4 text-2xl font-bold">{info.titulo}</h2><p className="mt-2 text-sm leading-6 text-stone-600">{info.texto}</p>{pedido.status !== "entregue" && pedido.status !== "cancelado" && <p className="mt-4 rounded-xl bg-orange-50 p-3 text-sm font-semibold text-orange-800">Tempo médio: {empresa?.tempo_entrega_minutos ?? 45} minutos</p>}</article><div className="mt-6 space-y-3">{etapas.map((etapa, index) => <div key={etapa} className={`flex items-center gap-3 rounded-2xl p-3 ${indice >= index ? "bg-stone-900 text-white" : "bg-white text-stone-400"}`}><span className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-xs font-bold">{index + 1}</span><span className="text-sm font-bold">{mensagens[etapa].titulo}</span></div>)}</div></section></main>;
}
