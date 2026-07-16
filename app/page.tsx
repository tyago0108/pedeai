import Link from "next/link";

export default function Home() {
  const acessos = [
    { perfil: "Usuário master", descricao: "Gerencie restaurantes, acessos e comunicações da plataforma.", href: "/plataforma/entrar", acao: "Entrar como master", destaque: "bg-stone-900 text-white" },
    { perfil: "Administrador do restaurante", descricao: "Organize pedidos, cardápio, produtos, pagamentos e entregas.", href: "/restaurante/login", acao: "Entrar no restaurante", destaque: "bg-orange-500 text-white" },
    { perfil: "Cliente do restaurante", descricao: "Acesse seus endereços, acompanhe pedidos e compre novamente.", href: "/conta/entrar", acao: "Entrar como cliente", destaque: "bg-orange-100 text-orange-900" },
  ];

  return (
    <main className="min-h-screen bg-stone-950 px-5 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <header className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-orange-400">PedeAI</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Bem-vindo ao PedeAI</h1>
          <p className="mt-4 text-lg text-stone-300">Escolha como deseja acessar a plataforma.</p>
        </header>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {acessos.map((acesso) => (
            <article key={acesso.perfil} className="flex min-h-64 flex-col rounded-3xl bg-white p-6 text-stone-900 shadow-xl">
              <p className="text-sm font-bold uppercase tracking-wider text-orange-500">Acesso</p>
              <h2 className="mt-3 text-2xl font-bold">{acesso.perfil}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-stone-600">{acesso.descricao}</p>
              <Link href={acesso.href} className={`mt-6 rounded-xl px-4 py-3 text-center text-sm font-bold transition hover:opacity-90 ${acesso.destaque}`}>
                {acesso.acao}
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-8 text-sm text-stone-400">Quer fazer um pedido? Peça ao restaurante o link do cardápio.</p>
      </section>
    </main>
  );
}
