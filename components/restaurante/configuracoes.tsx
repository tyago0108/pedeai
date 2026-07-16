"use client";

import { FormEvent, useEffect, useState } from "react";
import { ChavePix } from "@/components/restaurante/chave-pix";
import { CodigoCliente } from "@/components/restaurante/codigo-cliente";
import { supabase } from "@/lib/supabase/client";

type Agenda = Record<string, { ativo: boolean; inicio: string; fim: string }>;
const dias: [string, string][] = [
  ["seg", "Segunda"], ["ter", "Terça"], ["qua", "Quarta"], ["qui", "Quinta"],
  ["sex", "Sexta"], ["sab", "Sábado"], ["dom", "Domingo"],
];
const agendaInicial = Object.fromEntries(dias.map(([id]) => [id, { ativo: false, inicio: "08:00", fim: "18:00" }])) as Agenda;

export function ConfiguracoesRestaurante() {
  const [empresa, setEmpresa] = useState("");
  const [taxaEntrega, setTaxaEntrega] = useState("0");
  const [taxaCartao, setTaxaCartao] = useState("0");
  const [tempo, setTempo] = useState("45");
  const [aceitaPix, setAceitaPix] = useState(true);
  const [aceitaDinheiro, setAceitaDinheiro] = useState(true);
  const [aceitaCartao, setAceitaCartao] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");
  const [endereco, setEndereco] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [modo, setModo] = useState("agenda");
  const [agenda, setAgenda] = useState<Agenda>(agendaInicial);
  const [mensagemPausa, setMensagemPausa] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    async function carregar() {
      const { data: perfil } = await supabase
        .from("perfis")
        .select("empresa_id,empresas(taxa_entrega,taxa_cartao,tempo_entrega_minutos,aceita_pix,aceita_dinheiro,aceita_cartao,whatsapp,endereco,modo_operacao,agenda_funcionamento,mensagem_pausa)")
        .single();
      if (!perfil) return;

      setEmpresa(perfil.empresa_id);
      const dados = Array.isArray(perfil.empresas) ? perfil.empresas[0] : perfil.empresas;
      if (!dados) return;
      const negocio = dados as Record<string, any>;
      setTaxaEntrega(String(negocio.taxa_entrega ?? 0));
      setTaxaCartao(String(negocio.taxa_cartao ?? 0));
      setTempo(String(negocio.tempo_entrega_minutos ?? 45));
      setAceitaPix(negocio.aceita_pix ?? true);
      setAceitaDinheiro(negocio.aceita_dinheiro ?? true);
      setAceitaCartao(negocio.aceita_cartao ?? true);
      setWhatsapp(negocio.whatsapp ?? "");
      setEndereco(negocio.endereco ?? "");
      setModo(negocio.modo_operacao ?? "agenda");
      setAgenda({ ...agendaInicial, ...(negocio.agenda_funcionamento ?? {}) });
      setMensagemPausa(negocio.mensagem_pausa ?? "");
    }
    carregar();
  }, []);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");
    let logoUrl: string | undefined;

    if (logo) {
      const caminho = `${empresa}/${crypto.randomUUID()}-${logo.name}`;
      const envio = await supabase.storage.from("empresa-imagens").upload(caminho, logo);
      if (envio.error) return setMensagem("Não foi possível enviar a logo.");
      logoUrl = supabase.storage.from("empresa-imagens").getPublicUrl(caminho).data.publicUrl;
    }

    const { error } = await supabase.from("empresas").update({
      taxa_entrega: Number(taxaEntrega), taxa_cartao: Number(taxaCartao),
      tempo_entrega_minutos: Number(tempo), aceita_pix: aceitaPix,
      aceita_dinheiro: aceitaDinheiro, aceita_cartao: aceitaCartao,
      whatsapp, endereco, modo_operacao: modo, agenda_funcionamento: agenda,
      mensagem_pausa: mensagemPausa, ...(logoUrl ? { logo_url: logoUrl } : {}),
    }).eq("id", empresa);
    setMensagem(error ? "Não foi possível salvar as configurações." : "Configurações salvas.");
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-stone-50 p-5 text-stone-900">
      <a href="/restaurante" className="text-sm font-semibold text-orange-600">← Voltar ao painel</a>
      <h1 className="mt-4 text-3xl font-bold">Configurações do negócio</h1>
      <p className="mt-1 text-sm text-stone-500">Funcionamento, contato, taxas, pagamentos e identidade pública.</p>

      <form onSubmit={salvar} className="mt-6 space-y-5 rounded-2xl bg-white p-5 shadow-sm">
        <label className="block font-semibold">Logo do restaurante
          <input type="file" accept="image/*" onChange={(event) => setLogo(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" />
        </label>

        <label className="block font-semibold">Status de funcionamento
          <select value={modo} onChange={(event) => setModo(event.target.value)} className="campo mt-2">
            <option value="agenda">Seguir agenda automática</option>
            <option value="aberto">Aberto agora (manual)</option>
            <option value="pausado">Em pausa / fechado (manual)</option>
          </select>
        </label>

        {modo === "pausado" && <label className="block font-semibold">Mensagem da pausa
          <textarea value={mensagemPausa} onChange={(event) => setMensagemPausa(event.target.value)} placeholder="Fizemos uma pausa, voltamos em breve." className="campo mt-2" />
        </label>}

        {modo === "agenda" && <section>
          <h2 className="font-bold">Agenda semanal</h2>
          <p className="mt-1 text-xs text-stone-500">Fora desses horários, o cardápio informa que o restaurante está fechado.</p>
          <div className="mt-3 space-y-2">
            {dias.map(([id, nome]) => <div key={id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl bg-stone-50 p-2 text-sm">
              <label className="font-semibold"><input type="checkbox" checked={agenda[id].ativo} onChange={(event) => setAgenda({ ...agenda, [id]: { ...agenda[id], ativo: event.target.checked } })} /> {nome}</label>
              <input type="time" disabled={!agenda[id].ativo} value={agenda[id].inicio} onChange={(event) => setAgenda({ ...agenda, [id]: { ...agenda[id], inicio: event.target.value } })} className="rounded-lg border p-2" />
              <input type="time" disabled={!agenda[id].ativo} value={agenda[id].fim} onChange={(event) => setAgenda({ ...agenda, [id]: { ...agenda[id], fim: event.target.value } })} className="rounded-lg border p-2" />
            </div>)}
          </div>
        </section>}

        <label className="block font-semibold">WhatsApp
          <input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="Número com DDD" className="campo mt-2" />
        </label>
        <label className="block font-semibold">Endereço do restaurante
          <textarea value={endereco} onChange={(event) => setEndereco(event.target.value)} className="campo mt-2" />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="font-semibold">Taxa de entrega
            <input type="number" step="0.01" min="0" value={taxaEntrega} onChange={(event) => setTaxaEntrega(event.target.value)} className="campo mt-2" />
          </label>
          <label className="font-semibold">Taxa de cartão
            <input type="number" step="0.01" min="0" value={taxaCartao} onChange={(event) => setTaxaCartao(event.target.value)} className="campo mt-2" />
          </label>
          <label className="font-semibold">Tempo médio (min)
            <input type="number" min="1" value={tempo} onChange={(event) => setTempo(event.target.value)} className="campo mt-2" />
          </label>
        </div>

        <div className="space-y-2">
          <p className="font-semibold">Métodos de pagamento aceitos</p>
          <label><input type="checkbox" checked={aceitaPix} onChange={(event) => setAceitaPix(event.target.checked)} /> Pix</label>
          <label className="ml-3"><input type="checkbox" checked={aceitaDinheiro} onChange={(event) => setAceitaDinheiro(event.target.checked)} /> Dinheiro</label>
          <label className="ml-3"><input type="checkbox" checked={aceitaCartao} onChange={(event) => setAceitaCartao(event.target.checked)} /> Cartão</label>
        </div>

        <button className="w-full rounded-xl bg-orange-500 py-3 font-bold text-white">Salvar configurações</button>
        {mensagem && <p className="text-sm text-orange-700">{mensagem}</p>}
      </form>

      <ChavePix />
      <CodigoCliente />
    </main>
  );
}
