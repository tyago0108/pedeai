import { createHmac, timingSafeEqual } from "crypto";

const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 24 * 30;

export type SessaoCliente = {
  slug: string;
  telefone: string;
  codigo: string;
  expiraEm: number;
};

function segredo() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function nomeCookieCliente(slug: string) {
  return `pedeai_cliente_${slug}`;
}

function assinatura(payload: string) {
  return createHmac("sha256", segredo()).update(payload).digest("base64url");
}

export function criarSessaoCliente(slug: string, telefone: string, codigo: string) {
  if (!segredo()) return null;
  const dados: SessaoCliente = {
    slug,
    telefone,
    codigo,
    expiraEm: Math.floor(Date.now() / 1000) + DURACAO_SESSAO_SEGUNDOS,
  };
  const payload = Buffer.from(JSON.stringify(dados)).toString("base64url");
  return `${payload}.${assinatura(payload)}`;
}

export function lerSessaoCliente(valor: string | undefined, slug: string): SessaoCliente | null {
  if (!valor || !segredo()) return null;
  const [payload, assinaturaRecebida] = valor.split(".");
  if (!payload || !assinaturaRecebida) return null;

  const assinaturaEsperada = assinatura(payload);
  const recebida = Buffer.from(assinaturaRecebida);
  const esperada = Buffer.from(assinaturaEsperada);
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;

  try {
    const dados = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessaoCliente;
    if (dados.slug !== slug || dados.expiraEm < Math.floor(Date.now() / 1000)) return null;
    if (!/^\d{10,15}$/.test(dados.telefone) || !/^[A-Z0-9]{6}$/.test(dados.codigo)) return null;
    return dados;
  } catch {
    return null;
  }
}

export const opcoesCookieCliente = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DURACAO_SESSAO_SEGUNDOS,
};
