import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type ItemRecebido = { produtoId?: string; quantidade?: number };
type EnderecoRecebido = {
  endereco?: string; numero?: string; bairro?: string; cidade?: string; estado?: string;
  complemento?: string; referencia?: string;
};

const pagamentosPermitidos = ["Pix", "Cartão", "Dinheiro"];
const novoCodigo = () => crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

async function codigoDisponivel(supabase: ReturnType<typeof getSupabaseAdmin>, empresaId: string) {
  for (let tentativa = 0; tentativa < 10; tentativa += 1) {
    const codigo = novoCodigo();
    const { data } = await supabase.from("clientes_publicos").select("id").eq("empresa_id", empresaId).eq("codigo_acesso", codigo).maybeSingle();
    if (!data) return codigo;
  }
  throw new Error("Não foi possível gerar um código de acesso.");
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!token) return NextResponse.json({ error: "Sessão inválida. Entre novamente no painel." }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const { data: autenticacao, error: authErro } = await supabase.auth.getUser(token);
    if (authErro || !autenticacao.user) return NextResponse.json({ error: "Sessão inválida. Entre novamente no painel." }, { status: 401 });

    const { data: perfil } = await supabase.from("perfis").select("empresa_id").eq("id", autenticacao.user.id).maybeSingle();
    if (!perfil?.empresa_id) return NextResponse.json({ error: "Este usuário não está vinculado a um restaurante." }, { status: 403 });

    const body = await request.json();
    const empresaId = perfil.empresa_id;
    const nome = texto(body.nome);
    const telefone = texto(body.telefone).replace(/\D/g, "");
    const tipoAtendimento = ["local", "retirada", "entrega"].includes(body.tipoAtendimento) ? body.tipoAtendimento : "local";
    const pagamento = texto(body.pagamento);
    const observacao = texto(body.observacao) || null;
    const endereco = (body.endereco ?? {}) as EnderecoRecebido;
    const itens = Array.isArray(body.itens) ? body.itens as ItemRecebido[] : [];
    const trocoRecebido = Number(body.trocoPara);
    const trocoPara = pagamento === "Dinheiro" && Number.isFinite(trocoRecebido) && trocoRecebido > 0 ? trocoRecebido : null;
    const gerarNovoCodigo = body.gerarNovoCodigo !== false;

    const enderecoValido = tipoAtendimento !== "entrega" || [endereco.endereco, endereco.numero, endereco.bairro, endereco.cidade, endereco.estado].every((campo) => texto(campo));
    if (!nome || telefone.length < 10 || !pagamentosPermitidos.includes(pagamento) || itens.length === 0 || !enderecoValido) {
      return NextResponse.json({ error: "Preencha cliente, WhatsApp, pagamento, endereço de entrega e itens." }, { status: 400 });
    }

    const ids = itens.map((item) => typeof item.produtoId === "string" ? item.produtoId : "");
    if (ids.some((id) => !id)) return NextResponse.json({ error: "Há um item inválido no pedido." }, { status: 400 });
    const { data: produtos, error: produtosErro } = await supabase.from("produtos").select("id,nome,preco").eq("empresa_id", empresaId).eq("disponivel", true).in("id", ids);
    if (produtosErro || !produtos || produtos.length !== ids.length) return NextResponse.json({ error: "Um ou mais produtos não estão mais disponíveis." }, { status: 400 });

    const porId = new Map(produtos.map((produto) => [produto.id, produto]));
    const itensValidos = itens.map((item) => {
      const produto = porId.get(item.produtoId ?? "");
      const quantidade = Number(item.quantidade);
      if (!produto || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 50) throw new Error("Há um item inválido no pedido.");
      return { produto, quantidade };
    });
    const total = itensValidos.reduce((soma, item) => soma + Number(item.produto.preco) * item.quantidade, 0);

    const { data: existente } = await supabase.from("clientes_publicos").select("id,codigo_acesso").eq("empresa_id", empresaId).eq("telefone", telefone).maybeSingle();
    const codigoAcesso = gerarNovoCodigo || !existente ? await codigoDisponivel(supabase, empresaId) : existente.codigo_acesso;
    let clienteId = existente?.id ?? "";

    if (existente) {
      const { error } = await supabase.from("clientes_publicos").update({ nome, codigo_acesso: codigoAcesso, updated_at: new Date().toISOString() }).eq("id", existente.id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("clientes_publicos").insert({ empresa_id: empresaId, nome, telefone, codigo_acesso: codigoAcesso }).select("id").single();
      if (error || !data) throw error ?? new Error("Não foi possível criar o cliente.");
      clienteId = data.id;
    }

    let enderecoPublicoId: string | null = null;
    let enderecoEntrega: string | null = null;
    if (tipoAtendimento === "entrega") {
      enderecoEntrega = `${texto(endereco.endereco)}, ${texto(endereco.numero)} · ${texto(endereco.bairro)} · ${texto(endereco.cidade)}/${texto(endereco.estado).toUpperCase()}${texto(endereco.complemento) ? ` · ${texto(endereco.complemento)}` : ""}${texto(endereco.referencia) ? ` · Ref.: ${texto(endereco.referencia)}` : ""}`;
      const { data, error } = await supabase.from("enderecos_publicos").insert({
        cliente_publico_id: clienteId, endereco: texto(endereco.endereco), numero: texto(endereco.numero), bairro: texto(endereco.bairro), cidade: texto(endereco.cidade), estado: texto(endereco.estado).toUpperCase(), complemento: texto(endereco.complemento) || null, referencia: texto(endereco.referencia) || null,
      }).select("id").single();
      if (error || !data) throw error ?? new Error("Não foi possível salvar o endereço.");
      enderecoPublicoId = data.id;
    }

    const { data: pedido, error: pedidoErro } = await supabase.from("pedidos").insert({
      empresa_id: empresaId, cliente_nome: nome, cliente_telefone: telefone, cliente_publico_id: clienteId,
      tipo_entrega: "local", tipo_atendimento: tipoAtendimento, status: "recebido", pagamento, observacao,
      endereco_entrega: enderecoEntrega, endereco_publico_id: enderecoPublicoId, troco_para: trocoPara,
      precisa_troco: Boolean(trocoPara), codigo_acompanhamento: crypto.randomUUID(), total,
    }).select("id,numero_pedido").single();
    if (pedidoErro || !pedido) throw pedidoErro ?? new Error("Não foi possível criar o pedido.");

    const { error: itensErro } = await supabase.from("itens_pedido").insert(itensValidos.map(({ produto, quantidade }) => ({
      pedido_id: pedido.id, produto_id: produto.id, nome_produto: produto.nome, quantidade, preco_unitario: produto.preco,
    })));
    if (itensErro) throw itensErro;

    return NextResponse.json({ numeroPedido: pedido.numero_pedido, codigoAcesso, codigoFoiAtualizado: gerarNovoCodigo || !existente }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar pedido de balcão", error);
    const mensagem = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String(error.message) : "Erro inesperado no banco de dados.";
    return NextResponse.json({ error: `Não foi possível criar o pedido de balcão: ${mensagem}` }, { status: 500 });
  }
}
