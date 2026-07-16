"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function NotificacoesPedido() {
  const [empresa, setEmpresa] = useState("");
  const [ativas, setAtivas] = useState(true);
  const [som, setSom] = useState(true);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.from("perfis").select("empresa_id,empresas(notificacoes_ativas,notificacao_sonora)").single();
      if (!data) return;
      setEmpresa(data.empresa_id);
      const negocio = Array.isArray(data.empresas) ? data.empresas[0] : data.empresas;
      setAtivas(negocio?.notificacoes_ativas ?? true);
      setSom(negocio?.notificacao_sonora ?? true);
    }
    carregar();
  }, []);

  async function salvar() {
    const { error } = await supabase.from("empresas").update({ notificacoes_ativas: ativas, notificacao_sonora: som }).eq("id", empresa);
    setMensagem(error ? "Não foi possível salvar as notificações." : "Notificações salvas.");
  }

  return (
    <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="font-bold">Notificações de novos pedidos</h2>
      <p className="mt-1 text-sm text-stone-500">Alertas visuais no mosaico e lista; o som ajuda a equipe a perceber novos pedidos.</p>
      <div className="mt-4 space-y-3 text-sm">
        <label className="flex items-center justify-between gap-4"><span><strong className="block">Mostrar alertas</strong><span className="text-stone-500">Exibe pop-up, selo e destaque pulsante.</span></span><input type="checkbox" checked={ativas} onChange={(event) => setAtivas(event.target.checked)} className="h-5 w-5" /></label>
        <label className="flex items-center justify-between gap-4"><span><strong className="block">Tocar som</strong><span className="text-stone-500">Emite um alerta curto quando chega pedido novo.</span></span><input type="checkbox" disabled={!ativas} checked={som} onChange={(event) => setSom(event.target.checked)} className="h-5 w-5" /></label>
      </div>
      <button type="button" onClick={salvar} className="mt-4 rounded-xl bg-stone-900 px-4 py-3 font-bold text-white">Salvar notificações</button>
      {mensagem && <p className="mt-2 text-sm text-orange-700">{mensagem}</p>}
    </section>
  );
}
