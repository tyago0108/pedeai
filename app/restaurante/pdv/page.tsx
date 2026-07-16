"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormularioPedidoBalcao } from "@/components/admin/formulario-pedido-balcao";
import { supabase } from "@/lib/supabase/client";

type Produto = { id: string; nome: string; preco: number };

export default function PdvPage() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/restaurante/login"); return; }
      const { data: perfil, error: perfilErro } = await supabase.from("perfis").select("empresa_id").eq("id", user.id).maybeSingle();
      if (perfilErro || !perfil?.empresa_id) {
        if (ativo) { setErro("Este usuário não está vinculado a um restaurante."); setCarregando(false); }
        return;
      }
      const { data, error } = await supabase.from("produtos").select("id,nome,preco").eq("empresa_id", perfil.empresa_id).eq("disponivel", true).order("nome");
      if (!ativo) return;
      if (error) setErro("Não foi possível carregar o catálogo do PDV.");
      else setProdutos((data ?? []).map((produto) => ({ ...produto, preco: Number(produto.preco) })));
      setCarregando(false);
    }
    void carregar();
    return () => { ativo = false; };
  }, [router]);

  if (carregando) return <main className="grid min-h-screen place-items-center bg-stone-100 p-6 text-sm text-stone-600">Carregando PDV...</main>;
  if (erro) return <main className="grid min-h-screen place-items-center bg-stone-100 p-6"><section className="max-w-md rounded-3xl bg-white p-6 text-center shadow-sm"><h1 className="text-xl font-bold">PDV indisponível</h1><p className="mt-2 text-sm text-red-700">{erro}</p><button onClick={() => router.push("/restaurante/pedidos")} className="mt-5 rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white">Voltar aos pedidos</button></section></main>;

  return <main id="pdv-restaurante-page"><FormularioPedidoBalcao produtos={produtos} aoFechar={() => router.push("/restaurante/pedidos")} aoCriar={() => { /* A confirmação do PDV mantém o pedido criado em tela. */ }} /><style jsx global>{`
    #pdv-restaurante-page > div.fixed {
      position: static !important;
      display: grid !important;
      min-height: 100vh;
      place-items: stretch !important;
      overflow: visible !important;
      padding: 0 !important;
      background: #f5f5f4 !important;
    }
    #pdv-restaurante-page > div.fixed > form {
      width: 100% !important;
      max-width: none !important;
      min-height: 100vh;
      margin: 0 !important;
      border-radius: 0 !important;
    }
    #pdv-restaurante-page > div.fixed > section { margin: auto; }
  `}</style></main>;
}
