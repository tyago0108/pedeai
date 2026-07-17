import { registrarAuditoria } from "@/lib/plataforma";
import { requirePlatformAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin(request);
    const { data, error } = await admin.from("configuracoes_plataforma").select("chave,valor,updated_at").order("chave");
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível carregar as configurações." }, { status: 403 });
  }
}

export async function PUT(request: Request) {
  try {
    const { admin, user } = await requirePlatformAdmin(request);
    const body = await request.json();
    if (!Array.isArray(body.configuracoes)) return Response.json({ error: "Configurações inválidas." }, { status: 400 });
    const registros: { chave: string; valor: unknown; updated_by: string; updated_at: string }[] = body.configuracoes
      .filter((item: unknown): item is { chave: string; valor: unknown } => typeof item === "object" && item !== null && "chave" in item && "valor" in item && typeof (item as { chave: unknown }).chave === "string")
      .map((item: { chave: string; valor: unknown }) => ({ chave: item.chave.slice(0, 80), valor: item.valor, updated_by: user.id, updated_at: new Date().toISOString() }));
    if (!registros.length) return Response.json({ error: "Nenhuma configuração válida foi informada." }, { status: 400 });
    const { error } = await admin.from("configuracoes_plataforma").upsert(registros, { onConflict: "chave" });
    if (error) throw error;
    await registrarAuditoria(admin, { administradorId: user.id, acao: "atualizou", recurso: "configuracoes_plataforma", detalhes: { chaves: registros.map((registro: { chave: string }) => registro.chave) } });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível salvar as configurações." }, { status: 400 });
  }
}
