import Link from "next/link";

export default function Home() {
  return <main className="grid min-h-screen place-items-center bg-stone-950 px-6 text-white"><section className="max-w-xl text-center"><p className="text-sm font-bold uppercase tracking-[0.3em] text-orange-400">PedeAI</p><h1 className="mt-4 text-4xl font-bold">Pedidos simples para negócios locais.</h1><p className="mt-4 text-stone-300">O primeiro cardápio de demonstração está pronto para receber pedidos.</p><Link href="/loja/minha-lanchonete" className="mt-8 inline-block rounded-xl bg-orange-500 px-5 py-3 font-bold">Abrir cardápio de demonstração</Link></section></main>;
}
