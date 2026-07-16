import { supabase } from "@/lib/supabase/client";

type ItemRecebido = { produtoId: string; quantidade: number };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const telefone = typeof body.telefone === "string" ? body.telefone.trim() : null;
    const pagamento = typeof body.pagamento === "string" ? body.pagamento.trim() : "";
    const observacao = typeof body.observacao === "string" ? body.observacao.trim() : null;
    const enderecoEntrega = typeof body.enderecoEntrega === "string" ? body.enderecoEntrega.trim() : null;
    const tipoAtendimento = body.tipoAtendimento === "retirada" ? "retirada" : "entrega";
    const trocoPara = typeof body.trocoPara === "number" && body.trocoPara > 0 ? body.trocoPara : null;
    const empresaId = typeof body.empresaId === "string" ? body.empresaId : "";
    const itens = Array.isArray(body.itens) ? (body.itens as ItemRecebido[]) : [];

    if (!nome || !telefone || !pagamento || !empresaId || itens.length === 0 || (tipoAtendimento === "entrega" && !enderecoEntrega)) {
      return Response.json({ error: "Preencha nome, pagamento e itens do pedido." }, { status: 400 });
    }

    const ids = itens.map((item) => item.produtoId);
    const { data: produtos, error: produtosError } = await supabase
      .from("produtos")
      .select("id, nome, preco")
      .eq("empresa_id", empresaId)
      .eq("disponivel", true)
      .in("id", ids);

    if (produtosError || !produtos || produtos.length !== ids.length) {
      return Response.json({ error: "Um ou mais produtos não estão disponíveis." }, { status: 400 });
    }

    const produtosPorId = new Map(produtos.map((produto) => [produto.id, produto]));
    const itensValidos = itens.map((item) => {
      const quantidade = Number(item.quantidade);
      const produto = produtosPorId.get(item.produtoId);
      if (!produto || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 50) {
        throw new Error("Item inválido.");
      }
      return { produto, quantidade };
    });
    const total = itensValidos.reduce((soma, item) => soma + Number(item.produto.preco) * item.quantidade, 0);

    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos")
      .insert({
        empresa_id: empresaId,
        cliente_nome: nome,
        cliente_telefone: telefone || null,
        tipo_entrega: "whatsapp",
        pagamento,
        observacao: observacao || null,
        tipo_atendimento: tipoAtendimento,
        endereco_entrega: enderecoEntrega || null,
        troco_para: trocoPara,
        total,
      })
      .select("id")
      .single();

    if (pedidoError || !pedido) throw pedidoError ?? new Error("Não foi possível criar o pedido.");

    const { error: itensError } = await supabase.from("itens_pedido").insert(
      itensValidos.map(({ produto, quantidade }) => ({
        pedido_id: pedido.id,
        produto_id: produto.id,
        nome_produto: produto.nome,
        quantidade,
        preco_unitario: produto.preco,
      })),
    );
    if (itensError) throw itensError;

    return Response.json({ pedidoId: pedido.id }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar pedido", error);
    return Response.json({ error: "Não foi possível enviar o pedido. Tente novamente." }, { status: 500 });
  }
}
