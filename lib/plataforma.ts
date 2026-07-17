import type { SupabaseClient } from "@supabase/supabase-js";

type Auditoria = {
  administradorId: string;
  acao: string;
  recurso: string;
  empresaId?: string | null;
  detalhes?: Record<string, unknown>;
};

export async function registrarAuditoria(admin: SupabaseClient, evento: Auditoria) {
  const { error } = await admin.from("logs_auditoria_plataforma").insert({
    administrador_id: evento.administradorId,
    empresa_id: evento.empresaId ?? null,
    acao: evento.acao,
    recurso: evento.recurso,
    detalhes: evento.detalhes ?? {},
  });
  // A auditoria foi adicionada numa migração posterior. A ausência dessa tabela
  // não pode desfazer uma ação já concluída, como bloquear um restaurante.
  if (error && (error as { code?: string }).code !== "42P01") throw error;
}

export function textoSeguro(valor: unknown, limite = 500) {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}
