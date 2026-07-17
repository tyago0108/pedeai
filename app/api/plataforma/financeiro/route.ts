import { registrarAuditoria, textoSeguro } from "@/lib/plataforma";
import { requirePlatformAdmin } from "@/lib/supabase/server";

const hoje = () => new Date().toISOString().slice(0, 10);

export async function GET(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin(request);
    const [planos, assinaturas, pagamentos] = await Promise.all([
      admin.from("planos_plataforma").select("*").order("valor_mensal"),
      admin.from("assinaturas_restaurante").select("*,empresas(nome,slug,bloqueada),planos_plataforma(nome)").order("vencimento_em", { ascending: true, nullsFirst: false }),
      admin.from("pagamentos_plataforma").select("*,empresas(nome)").order("created_at", { ascending: false }).limit(100),
    ]);
    if (planos.error || assinaturas.error || pagamentos.error) throw planos.error ?? assinaturas.error ?? pagamentos.error;
    return Response.json({
      planos: planos.data ?? [],
      assinaturas: (assinaturas.data ?? []).map((assinatura) => ({ ...assinatura, valor_mensal: Number(assinatura.valor_mensal) })),
      pagamentos: (pagamentos.data ?? []).map((pagamento) => ({ ...pagamento, valor: Number(pagamento.valor) })),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível carregar o financeiro." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const { admin, user } = await requirePlatformAdmin(request);
    const body = await request.json();
    if (body.acao === "plano") {
      const nome = textoSeguro(body.nome, 80);
      const valor = Number(body.valorMensal);
      if (!nome || !Number.isFinite(valor) || valor < 0) return Response.json({ error: "Informe nome e valor válido para o plano." }, { status: 400 });
      const { data, error } = await admin.from("planos_plataforma").insert({ nome, descricao: textoSeguro(body.descricao), valor_mensal: valor, limite_pedidos_mensal: Number.isInteger(body.limitePedidos) && body.limitePedidos > 0 ? body.limitePedidos : null }).select().single();
      if (error) throw error;
      await registrarAuditoria(admin, { administradorId: user.id, acao: "criou", recurso: "plano", detalhes: { planoId: data.id, nome } });
      return Response.json(data, { status: 201 });
    }
    if (body.acao === "pagamento") {
      const empresaId = textoSeguro(body.empresaId, 100);
      const valor = Number(body.valor);
      if (!empresaId || !Number.isFinite(valor) || valor < 0) return Response.json({ error: "Informe restaurante e valor válido." }, { status: 400 });
      const { data: assinatura } = await admin.from("assinaturas_restaurante").select("id").eq("empresa_id", empresaId).maybeSingle();
      const confirmado = body.status === "confirmado";
      const { data, error } = await admin.from("pagamentos_plataforma").insert({ empresa_id: empresaId, assinatura_id: assinatura?.id ?? null, valor, referencia: textoSeguro(body.referencia, 100) || null, observacao: textoSeguro(body.observacao), status: confirmado ? "confirmado" : "pendente", pago_em: confirmado ? new Date().toISOString() : null }).select().single();
      if (error) throw error;
      if (confirmado && assinatura) await admin.from("assinaturas_restaurante").update({ status: "ativo", ultimo_pagamento_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", assinatura.id);
      await registrarAuditoria(admin, { administradorId: user.id, empresaId, acao: confirmado ? "confirmou" : "registrou", recurso: "pagamento_plataforma", detalhes: { pagamentoId: data.id, valor } });
      return Response.json(data, { status: 201 });
    }
    return Response.json({ error: "Ação financeira inválida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a operação financeira." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin, user } = await requirePlatformAdmin(request);
    const body = await request.json();
    if (body.acao === "assinatura") {
      const assinaturaId = textoSeguro(body.assinaturaId, 100);
      const valor = Number(body.valorMensal);
      if (!assinaturaId || !Number.isFinite(valor) || valor < 0) return Response.json({ error: "Dados da assinatura inválidos." }, { status: 400 });
      const status = ["teste", "ativo", "inadimplente", "cancelado"].includes(body.status) ? body.status : "teste";
      const { data: atual, error: atualErro } = await admin.from("assinaturas_restaurante").select("empresa_id").eq("id", assinaturaId).single();
      if (atualErro || !atual) throw atualErro ?? new Error("Assinatura não encontrada.");
      const { error } = await admin.from("assinaturas_restaurante").update({ plano_id: textoSeguro(body.planoId, 100) || null, status, valor_mensal: valor, vencimento_em: textoSeguro(body.vencimentoEm, 10) || null, bloqueio_automatico: Boolean(body.bloqueioAutomatico), observacoes_internas: textoSeguro(body.observacoes, 2000) || null, updated_at: new Date().toISOString() }).eq("id", assinaturaId);
      if (error) throw error;
      await registrarAuditoria(admin, { administradorId: user.id, empresaId: atual.empresa_id, acao: "atualizou", recurso: "assinatura", detalhes: { assinaturaId, status, valor } });
      return Response.json({ ok: true });
    }
    if (body.acao === "processar_inadimplencia") {
      const { data: vencidas, error } = await admin.from("assinaturas_restaurante").select("id,empresa_id").eq("bloqueio_automatico", true).in("status", ["teste", "ativo", "inadimplente"]).lt("vencimento_em", hoje());
      if (error) throw error;
      const ids = (vencidas ?? []).map((item) => item.id);
      const empresas = (vencidas ?? []).map((item) => item.empresa_id);
      if (ids.length) {
        await admin.from("assinaturas_restaurante").update({ status: "inadimplente", updated_at: new Date().toISOString() }).in("id", ids);
        await admin.from("empresas").update({ bloqueada: true, ativo: false }).in("id", empresas);
      }
      await registrarAuditoria(admin, { administradorId: user.id, acao: "processou", recurso: "inadimplencia", detalhes: { bloqueados: empresas.length } });
      return Response.json({ bloqueados: empresas.length });
    }
    return Response.json({ error: "Ação financeira inválida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível atualizar o financeiro." }, { status: 400 });
  }
}
