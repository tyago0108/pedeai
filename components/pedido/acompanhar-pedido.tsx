"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Empresa = { nome: string; slug: string; tempo_entrega_minutos: number; whatsapp: string | null; pix_chave: string | null; pix_mensagem: string | null };
type Pedido = { numero_pedido: number; cliente_nome: string; status: string; total: number; created_at: string; tipo_atendimento: string; pagamento: string; empresas: Empresa | Empresa[] | null };

const mensagens: Record<string, { titulo: string; texto: string; emoji: string }> = {
  recebido: { titulo: "Pedido recebido", texto: "Estamos conferindo tudo e separando os ingredientes.", emoji: "🧾" },
  preparando: { titulo: "Na cozinha", texto: "Hora de preparar seu pedido com todo o cuidado.", emoji: "🍔" },
  saiu_para_entrega: { titulo: "A caminho", texto: "Seu pedido saiu e está indo até você.", emoji: "🛵" },
  finalizado: { titulo: "Pedido concluído", texto: "Bom apetite! Esperamos que você aproveite muito.", emoji: "✨" },
  entregue: { titulo: "Pedido concluído", texto: "Bom apetite! Esperamos que você aproveite muito.", emoji: "✨" },
  cancelado: { titulo: "Pedido cancelado", texto: "Fale com o restaurante para mais informações.", emoji: "⚠️" },
};

mensagens.pronto_para_retirada = { titulo: "Pronto para retirada", texto: "Seu pedido está pronto. Pode vir buscar no restaurante.", emoji: "🛍️" };

function copiarTexto(valor: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(valor);
  const campo = document.createElement("textarea");
  campo.value = valor;
  campo.style.position = "fixed";
  campo.style.opacity = "0";
  document.body.appendChild(campo);
  campo.select();
  document.execCommand("copy");
  campo.remove();
  return Promise.resolve();
}

export function AcompanharPedido({ codigo, senhaGerada, aoVoltar }: { codigo: string; senhaGerada?: string; aoVoltar?: () => void }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const resposta = await fetch(`/api/acompanhamento?codigo=${encodeURIComponent(codigo)}`, { cache: "no-store" });
      const dados = await resposta.json();
      if (!ativo) return;
      if (!resposta.ok) setErro(dados.error ?? "Pedido não encontrado.");
      else setPedido(dados);
    }
    void carregar();
    const intervalo = window.setInterval(() => { void carregar(); }, 12000);
    return () => { ativo = false; window.clearInterval(intervalo); };
  }, [codigo]);

  async function copiar(valor: string, tipo: string) {
    try {
      await copiarTexto(valor);
      setCopiado(tipo);
      window.setTimeout(() => setCopiado(""), 1800);
    } catch {
      setCopiado("Não foi possível copiar automaticamente.");
    }
  }

  if (erro) return <main className="grid min-h-screen place-items-center bg-stone-50 p-5 text-stone-900"><p className="rounded-2xl bg-white p-5 text-center shadow-sm">{erro}</p></main>;
  if (!pedido) return <main className="grid min-h-screen place-items-center bg-stone-50 text-stone-600">Atualizando pedido...</main>;

  const empresa = Array.isArray(pedido.empresas) ? pedido.empresas[0] : pedido.empresas;
  const statusExibicao = pedido.status === "entregue" ? "finalizado" : pedido.status;
  const etapas = pedido.tipo_atendimento === "retirada"
    ? ["recebido", "preparando", "pronto_para_retirada", "finalizado"]
    : ["recebido", "preparando", "saiu_para_entrega", "finalizado"];
  const info = mensagens[statusExibicao] ?? mensagens.recebido;
  const indice = etapas.indexOf(statusExibicao);
  const telefone = String(empresa?.whatsapp ?? "").replace(/\D/g, "");
  const textoComprovante = encodeURIComponent(`${empresa?.pix_mensagem?.trim() || "Olá, envio o comprovante Pix."}\n\nPedido #${pedido.numero_pedido} · ${pedido.cliente_nome} · R$ ${pedido.total.toFixed(2)}`);

  return <main className="min-h-screen bg-stone-50 p-5 text-stone-900"><section className="mx-auto max-w-md"><p className="text-sm font-bold uppercase tracking-widest text-orange-500">{empresa?.nome ?? "PedeAI"}</p><h1 className="mt-2 text-3xl font-bold">{aoVoltar ? "Pedido realizado" : "Acompanhar pedido"}</h1><p className="mt-1 text-sm text-stone-500">Pedido #{String(pedido.numero_pedido).padStart(5, "0")} · esta tela atualiza automaticamente.</p>{senhaGerada && <section className="mt-5 rounded-3xl bg-orange-500 p-5 text-white shadow-sm"><p className="text-sm font-bold">Sua senha de acesso</p><p className="mt-2 text-3xl font-black tracking-[0.25em]">{senhaGerada}</p><p className="mt-3 text-xs leading-5 text-orange-50">Guarde esta senha. Ela protege seus pedidos e endereços neste restaurante. Você já ficou conectado neste aparelho.</p><button onClick={() => void copiar(senhaGerada, "Senha copiada.")} className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-bold text-orange-700">{copiado === "Senha copiada." ? copiado : "Copiar senha"}</button></section>}{pedido.pagamento === "Pix" && <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-widest text-orange-500">Pagamento Pix</p><h2 className="mt-2 text-xl font-bold">Pague e envie o comprovante</h2><p className="mt-2 text-sm leading-6 text-stone-600">{empresa?.pix_mensagem?.trim() || "Copie a chave, faça o Pix e envie o comprovante ao restaurante."}</p><div className="mt-4 rounded-2xl bg-orange-50 p-4"><p className="text-xs font-bold text-orange-800">Chave Pix</p><p className="mt-1 break-all font-bold text-orange-800">{empresa?.pix_chave || "Chave Pix ainda não cadastrada"}</p></div>{empresa?.pix_chave && <button onClick={() => void copiar(empresa.pix_chave!, "Chave Pix copiada.")} className="mt-3 w-full rounded-xl bg-stone-900 py-3 text-sm font-bold text-white">{copiado === "Chave Pix copiada." ? copiado : "Copiar chave Pix"}</button>}{telefone && <a href={`https://wa.me/55${telefone}?text=${textoComprovante}`} target="_blank" rel="noreferrer" className="mt-3 block rounded-xl bg-green-600 py-3 text-center text-sm font-bold text-white">Enviar comprovante no WhatsApp</a>}</section>}<article className="mt-5 rounded-3xl bg-white p-6 text-center shadow-sm"><div className="text-5xl">{info.emoji}</div><h2 className="mt-4 text-2xl font-bold">{info.titulo}</h2><p className="mt-2 text-sm leading-6 text-stone-600">{info.texto}</p>{statusExibicao !== "finalizado" && statusExibicao !== "cancelado" && <p className="mt-4 rounded-xl bg-orange-50 p-3 text-sm font-semibold text-orange-800">Tempo médio: {empresa?.tempo_entrega_minutos ?? 45} minutos</p>}</article><div className="mt-5 space-y-2">{etapas.map((etapa, index) => <div key={etapa} className={`flex items-center gap-3 rounded-2xl p-3 ${indice >= index ? "bg-stone-900 text-white" : "bg-white text-stone-400"}`}><span className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-xs font-bold">{index + 1}</span><span className="text-sm font-bold">{mensagens[etapa].titulo}</span></div>)}</div><div className="mt-5 grid gap-2 sm:grid-cols-2">{empresa?.slug && <Link href={`/${empresa.slug}/meus-pedidos`} className="rounded-xl border border-stone-300 py-3 text-center text-sm font-bold">Meus pedidos</Link>}{aoVoltar ? <button onClick={aoVoltar} className="rounded-xl bg-orange-500 py-3 text-sm font-bold text-white">Voltar ao cardápio</button> : empresa?.slug && <Link href={`/${empresa.slug}`} className="rounded-xl bg-orange-500 py-3 text-center text-sm font-bold text-white">Voltar ao cardápio</Link>}</div></section></main>;
}
