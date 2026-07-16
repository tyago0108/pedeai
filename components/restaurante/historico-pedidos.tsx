"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Pedido = { id: string; numero_pedido: number; cliente_nome: string; cliente_telefone: string | null; status: string; pagamento: string; pago: boolean; total: number; created_at: string; endereco_entrega: string | null };
type Item = { id: string; nome_produto: string; quantidade: number; preco_unitario: number };
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = (valor: number) => `#${String(valor).padStart(5, "0")}`;

export function HistoricoPedidosRestaurante() {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState("");
  const [busca, setBusca] = useState("");
  const [data, setData] = useState("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selecionado, setSelecionado] = useState<{ pedido: Pedido; itens: Item[] } | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async (id: string, termo = "", dia = "") => {
    let consulta = supabase.from("pedidos").select("id,numero_pedido,cliente_nome,cliente_telefone,status,pagamento,pago,total,created_at,endereco_entrega").eq("empresa_id", id).in("status", ["finalizado", "entregue", "cancelado"]).order("created_at", { ascending: false }).limit(100);
    if (dia) consulta = consulta.gte("created_at", `${dia}T00:00:00`).lte("created_at", `${dia}T23:59:59.999`);
    const valor = termo.trim();
    if (valor) {
      if (/^\d+$/.test(valor)) {
        const digitos = valor.replace(/\D/g, "");
        consulta = consulta.or(`numero_pedido.eq.${Number(digitos)},cliente_telefone.ilike.%${digitos}%`);
      } else {
        consulta = consulta.ilike("cliente_nome", `%${valor}%`);
      }
    }
    const { data: resultado, error } = await consulta;
    if (error) return setErro("Não foi possível consultar o histórico.");
    setPedidos((resultado ?? []).map((pedido) => ({ ...pedido, numero_pedido: Number(pedido.numero_pedido), total: Number(pedido.total) })));
  }, []);

  useEffect(() => {
    async function iniciar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/restaurante/login"); return; }
      const { data: perfil } = await supabase.from("perfis").select("empresa_id").single();
      if (!perfil) return setErro("Este usuário não está vinculado a um restaurante.");
      setEmpresaId(perfil.empresa_id);
      void carregar(perfil.empresa_id);
    }
    void iniciar();
  }, [carregar, router]);

  async function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    if (empresaId) await carregar(empresaId, busca, data);
  }

  async function abrir(pedido: Pedido) {
    const { data, error } = await supabase.from("itens_pedido").select("id,nome_produto,quantidade,preco_unitario").eq("pedido_id", pedido.id);
    if (error) return setErro("Não foi possível carregar os itens do pedido.");
    setSelecionado({ pedido, itens: (data ?? []).map((item) => ({ ...item, preco_unitario: Number(item.preco_unitario) })) });
  }

  return <main className="min-h-screen bg-stone-100 pb-24 text-stone-900"><header className="border-b bg-white p-4"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3"><div><p className="text-xs font-bold text-orange-500">PEDEAI · OPERAÇÃO</p><h1 className="text-xl font-bold">Histórico de pedidos</h1></div><Link href="/restaurante/pedidos" className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-bold text-white">Pedidos ativos</Link></div></header><section className="mx-auto max-w-5xl p-4"><p className="mb-4 text-sm text-stone-600">Registro salvo no servidor. Busque por número, nome, WhatsApp ou data.</p><form onSubmit={buscar} className="grid gap-2 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_180px_auto]"><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nº do pedido, nome ou WhatsApp" className="campo" /><input type="date" value={data} onChange={(event) => setData(event.target.value)} className="campo" /><button className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white">Buscar</button></form>{erro && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}<div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">{pedidos.length === 0 ? <p className="p-6 text-center text-sm text-stone-500">Nenhum pedido encontrado.</p> : pedidos.map((pedido) => <button key={pedido.id} onClick={() => void abrir(pedido)} className="flex w-full items-center justify-between gap-3 border-b border-stone-100 p-4 text-left transition hover:bg-stone-50"><div className="min-w-0"><div className="flex items-center gap-2"><strong className="text-orange-700">{numero(pedido.numero_pedido)}</strong><strong className="truncate">{pedido.cliente_nome}</strong>{pedido.pago && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">PAGO</span>}</div><p className="mt-1 text-xs text-stone-500">{new Date(pedido.created_at).toLocaleString("pt-BR")} · {pedido.cliente_telefone || "Sem WhatsApp"} · {pedido.status}</p></div><strong className="whitespace-nowrap">{moeda.format(pedido.total)}</strong></button>)}</div></section>{selecionado && <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"><section className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"><div className="flex justify-between"><div><p className="text-xs font-bold text-orange-600">PEDIDO {numero(selecionado.pedido.numero_pedido)}</p><h2 className="text-xl font-bold">{selecionado.pedido.cliente_nome}</h2></div><button onClick={() => setSelecionado(null)} className="text-xl text-stone-500">×</button></div><p className="mt-3 text-sm"><b>Data:</b> {new Date(selecionado.pedido.created_at).toLocaleString("pt-BR")}</p><p className="mt-1 text-sm"><b>Telefone:</b> {selecionado.pedido.cliente_telefone || "Não informado"}</p><p className="mt-1 text-sm"><b>Pagamento:</b> {selecionado.pedido.pagamento} · {selecionado.pedido.pago ? "Pago antecipado" : "Não confirmado"}</p>{selecionado.pedido.endereco_entrega && <p className="mt-1 text-sm"><b>Entrega:</b> {selecionado.pedido.endereco_entrega}</p>}<h3 className="mt-5 font-bold">Itens</h3>{selecionado.itens.map((item) => <div key={item.id} className="mt-2 flex justify-between rounded-xl border p-3 text-sm"><span>{item.quantidade}x {item.nome_produto}</span><strong>{moeda.format(item.quantidade * item.preco_unitario)}</strong></div>)}<div className="mt-4 flex justify-between border-t pt-4 text-lg font-bold"><span>Total</span><span>{moeda.format(selecionado.pedido.total)}</span></div></section></div>}<nav className="fixed inset-x-0 bottom-0 grid grid-cols-3 border-t bg-white sm:grid-cols-6"><Link href="/restaurante" className="p-3 text-center text-xs">Painel</Link><Link href="/restaurante/pedidos" className="p-3 text-center text-xs">Pedidos</Link><Link href="/restaurante/historico" className="p-3 text-center text-xs font-bold text-orange-600">Histórico</Link><Link href="/restaurante/financeiro" className="p-3 text-center text-xs">Financeiro</Link><Link href="/restaurante/cardapio" className="p-3 text-center text-xs">Cardápio</Link><Link href="/restaurante/configuracoes" className="p-3 text-center text-xs">Ajustes</Link></nav></main>;
}
