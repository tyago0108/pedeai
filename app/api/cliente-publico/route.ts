import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { criarSessaoCliente, lerSessaoCliente, nomeCookieCliente, opcoesCookieCliente } from "@/lib/sessao-cliente";

function telefoneLimpo(valor: unknown) {
  return String(valor ?? "").replace(/\D/g, "");
}

async function carregarCliente(empresaId: string, telefone: string, codigo: string) {
  const admin = getSupabaseAdmin();
  const { data: cliente } = await admin
    .from("clientes_publicos")
    .select("id,nome")
    .eq("empresa_id", empresaId)
    .eq("telefone", telefone)
    .eq("codigo_acesso", codigo)
    .maybeSingle();
  if (!cliente) return null;

  const { data: enderecos, error } = await admin
    .from("enderecos_publicos")
    .select("*")
    .eq("cliente_publico_id", cliente.id)
    .order("principal", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { cliente, enderecos: enderecos ?? [] };
}

async function empresaPorSlug(slug: string) {
  return getSupabaseAdmin().from("empresas").select("id,slug").eq("slug", slug).eq("ativo", true).maybeSingle();
}

function respostaComSessao(dados: unknown, slug: string, telefone: string, codigo: string) {
  const resposta = NextResponse.json(dados);
  const sessao = criarSessaoCliente(slug, telefone, codigo);
  if (sessao) resposta.cookies.set(nomeCookieCliente(slug), sessao, opcoesCookieCliente);
  return resposta;
}

export async function GET(request: Request) {
  try {
    const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? "";
    if (!slug) return NextResponse.json({ error: "Restaurante inválido." }, { status: 400 });
    const { data: empresa } = await empresaPorSlug(slug);
    if (!empresa) return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 404 });

    const armazenamento = await cookies();
    const sessao = lerSessaoCliente(armazenamento.get(nomeCookieCliente(slug))?.value, slug);
    if (!sessao) return NextResponse.json({ error: "Sessão do cliente não encontrada." }, { status: 401 });

    const dados = await carregarCliente(empresa.id, sessao.telefone, sessao.codigo);
    if (!dados) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
    return respostaComSessao({ ...dados, telefone: sessao.telefone }, slug, sessao.telefone, sessao.codigo);
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar sua sessão." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const slug = String(body.slug ?? "").trim();
    const acao = String(body.acao ?? "entrar");
    const telefone = telefoneLimpo(body.telefone);
    const codigo = String(body.codigo ?? "").trim().toUpperCase();
    if (!slug || telefone.length < 10) return NextResponse.json({ error: "Informe seu WhatsApp." }, { status: 400 });
    if (!/^[A-Z0-9]{6}$/.test(codigo)) return NextResponse.json({ error: "Informe a senha de 6 caracteres." }, { status: 400 });

    const { data: empresa } = await empresaPorSlug(slug);
    if (!empresa) return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 404 });
    const dados = await carregarCliente(empresa.id, telefone, codigo);
    if (!dados) return NextResponse.json({ error: "WhatsApp ou senha não conferem para este restaurante." }, { status: 403 });

    if (acao === "alterar-senha") {
      const novaSenha = String(body.novaSenha ?? "").trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(novaSenha)) {
        return NextResponse.json({ error: "A nova senha precisa ter 6 letras ou números." }, { status: 400 });
      }
      const { error } = await getSupabaseAdmin()
        .from("clientes_publicos")
        .update({ codigo_acesso: novaSenha, updated_at: new Date().toISOString() })
        .eq("id", dados.cliente.id);
      if (error?.code === "23505") return NextResponse.json({ error: "Esta senha já está em uso. Escolha outra." }, { status: 409 });
      if (error) throw error;
      return respostaComSessao({ ok: true }, slug, telefone, novaSenha);
    }

    return respostaComSessao({ ...dados, telefone }, slug, telefone, codigo);
  } catch {
    return NextResponse.json({ error: "Não foi possível acessar seus dados." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? "";
  const resposta = NextResponse.json({ ok: true });
  if (slug) resposta.cookies.set(nomeCookieCliente(slug), "", { ...opcoesCookieCliente, maxAge: 0 });
  return resposta;
}
