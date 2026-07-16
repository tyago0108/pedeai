"use client";

import { useEffect, useState } from "react";

type DadosPix = {
  cliente: string;
  total: number;
  restaurante?: string;
  pixChave?: string;
  mensagem?: string;
  whatsapp?: string;
  error?: string;
};

export default function PixPage({ params }: { params: Promise<{ codigo: string }> }) {
  const [dados, setDados] = useState<DadosPix>();
  const [codigoCliente, setCodigoCliente] = useState("");

  useEffect(() => {
    params.then(({ codigo }) => {
      const chave = `pedeai:codigo-cliente:${codigo}`;
      const codigoSalvo = window.sessionStorage.getItem(chave);
      if (codigoSalvo) {
        setCodigoCliente(codigoSalvo);
        window.sessionStorage.removeItem(chave);
      }
      fetch(`/api/pix?codigo=${encodeURIComponent(codigo)}`).then((resposta) => resposta.json()).then(setDados);
    });
  }, [params]);

  if (!dados) return <main className="grid min-h-screen place-items-center bg-stone-50">Carregando Pix...</main>;
  if (dados.error) return <main className="grid min-h-screen place-items-center bg-stone-50 p-5 text-stone-900">{dados.error}</main>;

  const telefone = String(dados.whatsapp ?? "").replace(/\D/g, "");
  const textoPadrao = `Olá, envio o comprovante Pix do pedido de ${dados.cliente} no valor de R$ ${dados.total.toFixed(2)}.`;
  const texto = encodeURIComponent(`${dados.mensagem?.trim() || textoPadrao}\n\n${textoPadrao}`);

  return (
    <main className="grid min-h-screen place-items-center bg-stone-50 p-5 text-stone-900">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-500">Pagamento Pix</p>
        <h1 className="mt-2 text-3xl font-bold">Finalize seu pagamento</h1>
        <p className="mt-3 text-sm text-stone-600">{dados.mensagem?.trim() || "Copie a chave abaixo, faça o Pix e envie o comprovante ao restaurante."}</p>
        <div className="mt-5 rounded-2xl bg-orange-50 p-4">
          <p className="text-xs font-bold text-orange-800">Chave Pix · {dados.restaurante}</p>
          <p className="mt-2 break-all text-lg font-black text-orange-700">{dados.pixChave || "Chave Pix não cadastrada"}</p>
        </div>
        {codigoCliente && <div className="mt-4 rounded-2xl bg-stone-100 p-4 text-left">
          <p className="text-sm font-bold">Seu código pessoal de acesso</p>
          <p className="mt-1 text-2xl font-black tracking-[0.2em]">{codigoCliente}</p>
          <p className="mt-2 text-xs text-stone-600">Guarde-o: ele protege seus pedidos e endereços neste restaurante.</p>
        </div>}
        {telefone && <a href={`https://wa.me/55${telefone}?text=${texto}`} target="_blank" rel="noreferrer" className="mt-5 block rounded-xl bg-green-600 py-3 font-bold text-white">Enviar comprovante no WhatsApp</a>}
        <a href="/" className="mt-3 block text-sm font-bold text-orange-600">Voltar</a>
      </section>
    </main>
  );
}
