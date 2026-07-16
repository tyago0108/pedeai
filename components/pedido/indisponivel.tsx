import Link from "next/link";

export function RestauranteIndisponivel({ nome, slug, mensagem }: { nome: string; slug: string; mensagem: string }) {
  return <main className="grid min-h-screen place-items-center bg-stone-100 p-5 text-stone-900"><section role="dialog" aria-modal="true" className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-orange-100 text-3xl">⏸</div><p className="mt-5 text-xs font-bold uppercase tracking-widest text-orange-500">{nome}</p><h1 className="mt-2 text-3xl font-bold">Indisponível agora</h1><p className="mt-3 text-sm leading-6 text-stone-600">{mensagem}</p><Link href={`/${slug}/meus-pedidos`} className="mt-6 block w-full rounded-xl bg-stone-900 py-3 font-bold text-white">Meus pedidos</Link></section></main>;
}
