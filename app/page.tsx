import Link from "next/link";

export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center bg-stone-950 px-5 py-10 text-white">
      <section className="max-w-xl text-center">
        <header>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-orange-400">PedeAI</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Bem-vindo ao PedeAI</h1>
          <p className="mt-4 text-lg text-stone-300">Gestão simples de pedidos para restaurantes locais.</p>
        </header>
        <Link href="/entrar" className="mt-8 inline-block rounded-xl bg-orange-500 px-5 py-3 font-bold text-white">Acessar painel de gestão</Link>
        <p className="mt-8 text-sm text-stone-400">Para pedir, use apenas o link do cardápio enviado pelo restaurante.</p>
      </section>
    </main>
  );
}
