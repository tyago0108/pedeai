import { getSupabaseAdmin } from "@/lib/supabase/server";
import { verificarFuncionamento } from "@/lib/operacao";

type ItemRecebido = { produtoId: string; quantidade: number };
type EnderecoRecebido = { endereco?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; complemento?: string; referencia?: string };
const codigoNovo = () => crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const telefone = typeof body.telefone === "string" ? body.telefone.replace(/\D/g, "") : "";
    const codigoCliente = typeof body.codigoCliente === "string" ? body.codigoCliente.trim().toUpperCase() : "";
    const pagamento = typeof body.pagamento === "string" ? body.pagamento.trim() : "";
    const observacao = typeof body.observacao === "string" ? body.observacao.trim() : null;
    const endereco = (body.endereco ?? {}) as EnderecoRecebido;
    const tipoAtendimento = body.tipoAtendimento === "retirada" ? "retirada" : "entrega";
    const trocoPara = typeof body.trocoPara === "number" && body.trocoPara > 0 ? body.trocoPara : null;
    const empresaId = typeof body.empresaId === "string" ? body.empresaId : "";
    const itens = Array.isArray(body.itens) ? (body.itens as ItemRecebido[]) : [];

    const enderecoValido = tipoAtendimento !== "entrega" || [endereco.endereco, endereco.numero, endereco.bairro, endereco.cidade, endereco.estado].every((campo) => typeof campo === "string" && campo.trim());
    if (!nome || telefone.length < 10 || !pagamento || !empresaId || itens.length === 0 || !enderecoValido) {
      return Response.json({ error: "Preencha nome, pagamento e itens do pedido." }, { status: 400 });
    }

    const { data: empresa } = await supabase.from("empresas").select("id,ativo,bloqueada,modo_operacao,agenda_funcionamento,mensagem_pausa").eq("id", empresaId).maybeSingle();
    const funcionamento = empresa ? verificarFuncionamento(empresa) : { aberto: false, mensagem: "Este restaurante não está aceitando pedidos no momento." };
    if (!funcionamento.aberto) return Response.json({ error: funcionamento.mensagem }, { status: 403 });
    let { data: cliente } = await supabase.from("clientes_publicos").select("id,codigo_acesso").eq("empresa_id", empresaId).eq("telefone", telefone).maybeSingle();
    let novoCodigoCliente: string | null = null;
    if (cliente) {
      if (!/^[A-Z0-9]{6}$/.test(codigoCliente) || codigoCliente !== cliente.codigo_acesso) return Response.json({ error: "Este WhatsApp já possui cadastro. Informe seu código de acesso para continuar." }, { status: 403 });
      await supabase.from("clientes_publicos").update({ nome, updated_at: new Date().toISOString() }).eq("id", cliente.id);
    } else {
      for (let tentativa = 0; tentativa < 5 && !cliente; tentativa += 1) {
        const codigo = codigoNovo();
        const { data, error } = await supabase.from("clientes_publicos").insert({ empresa_id: empresaId, nome, telefone, codigo_acesso: codigo }).select("id,codigo_acesso").single();
        if (!error && data) { cliente = data; novoCodigoCliente = codigo; }
      }
      if (!cliente) throw new Error("Não foi possível criar o acesso do cliente.");
    }
    let enderecoPublicoId: string | null = null;
    let enderecoTexto: string | null = null;
    if (tipoAtendimento === "entrega") {
      enderecoTexto = `${endereco.endereco!.trim()}, ${endereco.numero!.trim()} · ${endereco.bairro!.trim()} · ${endereco.cidade!.trim()}/${endereco.estado!.trim()}${endereco.complemento?.trim() ? ` · ${endereco.complemento.trim()}` : ""}${endereco.referencia?.trim() ? ` · Ref.: ${endereco.referencia.trim()}` : ""}`;
      const { data: enderecoSalvo, error: enderecoError } = await supabase.from("enderecos_publicos").insert({ cliente_publico_id: cliente.id, endereco: endereco.endereco!.trim(), numero: endereco.numero!.trim(), bairro: endereco.bairro!.trim(), cidade: endereco.cidade!.trim(), estado: endereco.estado!.trim().toUpperCase(), complemento: endereco.complemento?.trim() || null, referencia: endereco.referencia?.trim() || null }).select("id").single();
      if (enderecoError || !enderecoSalvo) throw enderecoError ?? new Error("Não foi possível salvar o endereço.");
      enderecoPublicoId = enderecoSalvo.id;
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
        cliente_telefone: telefone,
        cliente_publico_id: cliente.id,
        tipo_entrega: "whatsapp",
        pagamento,
        observacao: observacao || null,
        tipo_atendimento: tipoAtendimento,
        endereco_entrega: enderecoTexto,
        endereco_publico_id: enderecoPublicoId,
        troco_para: trocoPara,
        codigo_acompanhamento: crypto.randomUUID(),
        total,
      })
      .select("id, codigo_acompanhamento")
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

    const { data: dadosPix } = await supabase.from("empresas").select("pix_chave,whatsapp").eq("id",empresaId).maybeSingle();
    return Response.json({ pedidoId: pedido.id, acompanhamento: pedido.codigo_acompanhamento, codigoCliente: novoCodigoCliente, pixChave: dadosPix?.pix_chave ?? null, whatsappRestaurante: dadosPix?.whatsapp ?? null }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar pedido", error);
    return Response.json({ error: "Não foi possível enviar o pedido. Tente novamente." }, { status: 500 });
  }
}
