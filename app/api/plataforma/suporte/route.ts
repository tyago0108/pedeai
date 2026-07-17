import { registrarAuditoria, textoSeguro } from "@/lib/plataforma";
import { requirePlatformAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin(request);
    const { data, error } = await admin.from("chamados_suporte").select("*,empresas(nome,slug)").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível carregar o suporte." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const { admin, user } = await requirePlatformAdmin(request);
    const body = await request.json();
    const empresaId = textoSeguro(body.empresaId, 100);
    const assunto = textoSeguro(body.assunto, 160);
    const prioridade = ["baixa", "normal", "alta", "urgente"].includes(body.prioridade) ? body.prioridade : "normal";
    if (!empresaId || !assunto) return Response.json({ error: "Informe restaurante e assunto." }, { status: 400 });
    const { data, error } = await admin.from("chamados_suporte").insert({ empresa_id: empresaId, assunto, descricao: textoSeguro(body.descricao, 4000) || null, prioridade, criado_por: user.id, atualizado_por: user.id }).select().single();
    if (error) throw error;
    await registrarAuditoria(admin, { administradorId: user.id, empresaId, acao: "criou", recurso: "chamado_suporte", detalhes: { chamadoId: data.id, assunto } });
    return Response.json(data, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível criar o chamado." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin, user } = await requirePlatformAdmin(request);
    const body = await request.json();
    const chamadoId = textoSeguro(body.chamadoId, 100);
    const status = ["aberto", "em_atendimento", "resolvido", "fechado"].includes(body.status) ? body.status : "aberto";
    if (!chamadoId) return Response.json({ error: "Chamado não informado." }, { status: 400 });
    const { data: atual, error: consultaErro } = await admin.from("chamados_suporte").select("empresa_id").eq("id", chamadoId).single();
    if (consultaErro || !atual) throw consultaErro ?? new Error("Chamado não encontrado.");
    const { error } = await admin.from("chamados_suporte").update({ status, resposta: textoSeguro(body.resposta, 4000) || null, nota_interna: textoSeguro(body.notaInterna, 4000) || null, atualizado_por: user.id, updated_at: new Date().toISOString() }).eq("id", chamadoId);
    if (error) throw error;
    await registrarAuditoria(admin, { administradorId: user.id, empresaId: atual.empresa_id, acao: "atualizou", recurso: "chamado_suporte", detalhes: { chamadoId, status } });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível atualizar o chamado." }, { status: 400 });
  }
}
