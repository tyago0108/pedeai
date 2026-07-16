import Link from "next/link";
import { ChavePix } from "@/components/restaurante/chave-pix";
export default function PixPage(){return <main className="mx-auto min-h-screen max-w-2xl bg-stone-50 p-5"><Link href="/restaurante/configuracoes" className="text-sm font-bold text-orange-600">← Configurações</Link><h1 className="mt-4 text-3xl font-bold">Configuração Pix</h1><ChavePix/></main>}
