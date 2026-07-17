import { registrarAuditoria, textoSeguro } from "@/lib/plataforma";
import { requirePlatformAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin(request);
    const { data, error } = await admin.from("mensagens_plataforma").select("id,titulo,conteudo,lida_em,created_at,empresas(nome,slug)").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível carregar as mensagens." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const { admin, user } = await requirePlatformAdmin(request);
    const body = await request.json();
    const titulo = textoSeguro(body.titulo, 120);
    const conteudo = textoSeguro(body.conteudo, 4000);
    const todos = Boolean(body.todos);
    const empresaIds = Array.isArray(body.empresaIds) ? (body.empresaIds as unknown[]).filter((id): id is string => typeof id === "string" && id.length < 100) : [];
    if (!titulo || !conteudo || (!todos && !empresaIds.length)) return Response.json({ error: "Informe destinatário, título e mensagem." }, { status: 400 });
    const ids = todos
      ? (await admin.from("empresas").select("id").eq("ativo", true).eq("bloqueada", false)).data?.map((empresa) => empresa.id) ?? []
      : empresaIds;
    if (!ids.length) return Response.json({ error: "Nenhum restaurante elegível foi encontrado." }, { status: 400 });
    const { error } = await admin.from("mensagens_plataforma").insert(ids.map((empresaId) => ({ empresa_id: empresaId, titulo, conteudo })));
    if (error) throw error;
    await registrarAuditoria(admin, { administradorId: user.id, acao: "enviou", recurso: "comunicado", detalhes: { destinatarios: ids.length, titulo } });
    return Response.json({ enviados: ids.length }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível enviar o comunicado." }, { status: 400 });
  }
}
