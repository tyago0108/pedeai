import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { criarSessaoCliente, lerSessaoCliente, nomeCookieCliente, opcoesCookieCliente } from "@/lib/sessao-cliente";

async function consultar(slug: string, telefone: string, senha: string) {
  const admin = getSupabaseAdmin();
  const { data: empresa } = await admin.from("empresas").select("id").eq("slug", slug).maybeSingle();
  if (!empresa) return { erro: "Restaurante não encontrado.", status: 404 as const };

  const { data: cliente } = await admin
    .from("clientes_publicos")
    .select("id")
    .eq("empresa_id", empresa.id)
    .eq("telefone", telefone)
    .eq("codigo_acesso", senha)
    .maybeSingle();
  if (!cliente) return { erro: "WhatsApp ou senha não conferem.", status: 403 as const };

  const { data, error } = await admin
    .from("pedidos")
    .select("codigo_acompanhamento,status,total,created_at")
    .eq("empresa_id", empresa.id)
    .eq("cliente_publico_id", cliente.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return { erro: "Não foi possível consultar os pedidos.", status: 500 as const };
  return { pedidos: (data ?? []).map((pedido) => ({ ...pedido, total: Number(pedido.total) })) };
}

function respostaComSessao(dados: unknown, slug: string, telefone: string, senha: string) {
  const resposta = NextResponse.json(dados);
  const sessao = criarSessaoCliente(slug, telefone, senha);
  if (sessao) resposta.cookies.set(nomeCookieCliente(slug), sessao, opcoesCookieCliente);
  return resposta;
}

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? "";
  if (!slug) return NextResponse.json({ error: "Restaurante inválido." }, { status: 400 });
  const armazenamento = await cookies();
  const sessao = lerSessaoCliente(armazenamento.get(nomeCookieCliente(slug))?.value, slug);
  if (!sessao) return NextResponse.json({ error: "Sessão do cliente não encontrada." }, { status: 401 });
  const resultado = await consultar(slug, sessao.telefone, sessao.codigo);
  if ("erro" in resultado) return NextResponse.json({ error: resultado.erro }, { status: resultado.status });
  return respostaComSessao({ pedidos: resultado.pedidos, telefone: sessao.telefone }, slug, sessao.telefone, sessao.codigo);
}

export async function POST(request: Request) {
  const { slug, telefone, codigo } = await request.json();
  const telefoneLimpo = String(telefone ?? "").replace(/\D/g, "");
  const senha = String(codigo ?? "").trim().toUpperCase();
  if (typeof slug !== "string" || telefoneLimpo.length < 10 || !/^[A-Z0-9]{6}$/.test(senha)) {
    return NextResponse.json({ error: "Informe WhatsApp e sua senha de acesso." }, { status: 400 });
  }
  const resultado = await consultar(slug, telefoneLimpo, senha);
  if ("erro" in resultado) return NextResponse.json({ error: resultado.erro }, { status: resultado.status });
  return respostaComSessao({ pedidos: resultado.pedidos, telefone: telefoneLimpo }, slug, telefoneLimpo, senha);
}
