import { requirePlatformAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin(request);
    const empresaId = new URL(request.url).searchParams.get("empresaId")?.trim();
    let consulta = admin.from("logs_auditoria_plataforma").select("id,acao,recurso,detalhes,created_at,empresa_id").order("created_at", { ascending: false }).limit(150);
    if (empresaId) consulta = consulta.eq("empresa_id", empresaId);
    const { data, error } = await consulta;
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível carregar a auditoria." }, { status: 403 });
  }
}
