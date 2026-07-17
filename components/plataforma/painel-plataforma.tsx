"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Aba = "resumo" | "restaurantes" | "administradores" | "pedidos" | "financeiro" | "comunicacao" | "suporte" | "seguranca" | "relatorios" | "configuracoes";
type Empresa = { id: string; nome: string; slug: string; whatsapp?: string | null; endereco?: string | null; horario_funcionamento?: string | null; logo_url?: string | null; bloqueada: boolean; ativo: boolean; pendente_aprovacao: boolean; modo_operacao?: string; created_at: string; administrador?: { id: string; nome: string; email: string | null; ultimoAcesso: string | null } | null; assinatura?: { id: string; status: string; valor_mensal: number; vencimento_em: string | null; bloqueio_automatico: boolean; planos_plataforma?: { nome: string } | { nome: string }[] | null } | null };
type Resumo = { restaurantes: { ativos: number; pausados: number; bloqueados: number; aguardandoAprovacao: number }; pedidosHoje: number; volumePedidosHoje: number; faturamentoPlataformaMes: number; alertas: { assinaturasVencidas: number; bloqueioAutomaticoPendente: number; chamadosAbertos: number } };
type Pedido = { id: string; numero_pedido: number; cliente_nome: string; cliente_telefone: string | null; status: string; pagamento: string; pago: boolean; total: number; created_at: string; tipo_atendimento: string; empresas: { nome: string; slug: string } | { nome: string; slug: string }[] | null };
type Plano = { id: string; nome: string; descricao: string | null; valor_mensal: number; limite_pedidos_mensal: number | null; ativo: boolean };
type Assinatura = { id: string; empresa_id: string; plano_id: string | null; status: string; valor_mensal: number; vencimento_em: string | null; bloqueio_automatico: boolean; observacoes_internas: string | null; empresas: { nome: string; slug: string; bloqueada: boolean } | { nome: string; slug: string; bloqueada: boolean }[] | null; planos_plataforma: { nome: string } | { nome: string }[] | null };
type Pagamento = { id: string; empresa_id: string; valor: number; referencia: string | null; status: string; pago_em: string | null; created_at: string; empresas: { nome: string } | { nome: string }[] | null };
type Chamado = { id: string; empresa_id: string; assunto: string; descricao: string | null; status: string; prioridade: string; resposta: string | null; nota_interna: string | null; created_at: string; empresas: { nome: string; slug: string } | { nome: string; slug: string }[] | null };
type Log = { id: string; acao: string; recurso: string; detalhes: Record<string, unknown>; created_at: string; empresa_id: string | null };
type Configuracao = { chave: string; valor: Record<string, unknown> };

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const primeiro = <T,>(valor: T | T[] | null | undefined) => Array.isArray(valor) ? valor[0] : valor;
const data = (valor: string | null | undefined) => valor ? new Date(valor).toLocaleString("pt-BR") : "—";
const dataCurta = (valor: string | null | undefined) => valor ? new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR") : "Sem vencimento";

const abas: { id: Aba; titulo: string }[] = [
  { id: "resumo", titulo: "Painel" }, { id: "restaurantes", titulo: "Restaurantes" }, { id: "administradores", titulo: "Administradores" }, { id: "pedidos", titulo: "Pedidos" }, { id: "financeiro", titulo: "Financeiro" }, { id: "comunicacao", titulo: "Comunicação" }, { id: "suporte", titulo: "Suporte" }, { id: "seguranca", titulo: "Segurança" }, { id: "relatorios", titulo: "Relatórios" }, { id: "configuracoes", titulo: "Ajustes" },
];

export function PainelPlataforma() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("resumo");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [configuracoes, setConfiguracoes] = useState<Configuracao[]>([]);
  const [erro, setErro] = useState(""); const [carregando, setCarregando] = useState(true);
  const [buscaPedido, setBuscaPedido] = useState(""); const [statusPedido, setStatusPedido] = useState(""); const [empresaPedido, setEmpresaPedido] = useState(""); const [dataPedidoDe, setDataPedidoDe] = useState(""); const [dataPedidoAte, setDataPedidoAte] = useState("");
  const [novoRestaurante, setNovoRestaurante] = useState({ nome: "", slug: "", email: "", senha: "" });
  const [novoPagamento, setNovoPagamento] = useState({ empresaId: "", valor: "", referencia: "", confirmado: true });
  const [novoChamado, setNovoChamado] = useState({ empresaId: "", assunto: "", descricao: "", prioridade: "normal" });
  const [comunicado, setComunicado] = useState({ destino: "todos", titulo: "", conteudo: "" });
  const [novoPlano, setNovoPlano] = useState({ nome: "", descricao: "", valor: "" });

  async function requisicao(url: string, options?: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession();
    const resposta = await fetch(url, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}`, ...(options?.headers ?? {}) } });
    const conteudo = await resposta.json();
    if (!resposta.ok) throw new Error(conteudo.error ?? "Não foi possível concluir a operação.");
    return conteudo;
  }

  async function carregar() {
    setCarregando(true); setErro("");
    try {
      const [dadosResumo, dadosEmpresas, dadosPedidos, dadosFinanceiro, dadosChamados, dadosLogs, dadosConfiguracoes] = await Promise.all([
        requisicao("/api/plataforma/resumo"), requisicao("/api/plataforma/restaurantes"), requisicao("/api/plataforma/pedidos"), requisicao("/api/plataforma/financeiro"), requisicao("/api/plataforma/suporte"), requisicao("/api/plataforma/auditoria"), requisicao("/api/plataforma/configuracoes"),
      ]);
      setResumo(dadosResumo); setEmpresas(dadosEmpresas); setPedidos(dadosPedidos); setPlanos(dadosFinanceiro.planos); setAssinaturas(dadosFinanceiro.assinaturas); setPagamentos(dadosFinanceiro.pagamentos); setChamados(dadosChamados); setLogs(dadosLogs); setConfiguracoes(dadosConfiguracoes);
    } catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível carregar a plataforma."); }
    finally { setCarregando(false); }
  }

  useEffect(() => { void carregar(); }, []);

  async function enviar(url: string, method: string, body?: unknown) {
    setErro("");
    try { await requisicao(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }); await carregar(); return true; }
    catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível concluir a operação."); return false; }
  }

  async function criarRestaurante(event: FormEvent) {
    event.preventDefault();
    if (await enviar("/api/plataforma/restaurantes", "POST", novoRestaurante)) setNovoRestaurante({ nome: "", slug: "", email: "", senha: "" });
  }

  async function editarRestaurante(empresa: Empresa) {
    const nome = window.prompt("Nome do restaurante:", empresa.nome); if (nome === null) return;
    const slug = window.prompt("Link público (sem barras):", empresa.slug); if (slug === null) return;
    const whatsapp = window.prompt("WhatsApp:", empresa.whatsapp ?? ""); if (whatsapp === null) return;
    const endereco = window.prompt("Endereço:", empresa.endereco ?? ""); if (endereco === null) return;
    const horario = window.prompt("Horário de funcionamento:", empresa.horario_funcionamento ?? ""); if (horario === null) return;
    const logoUrl = window.prompt("URL da logo (opcional):", empresa.logo_url ?? ""); if (logoUrl === null) return;
    await enviar("/api/plataforma/restaurantes", "PATCH", { empresaId: empresa.id, acao: "editar", nome, slug, whatsapp, endereco, horario, logoUrl });
  }

  async function redefinirSenha(empresa: Empresa) { const senha = window.prompt(`Nova senha do administrador de ${empresa.nome} (mínimo 8 caracteres):`); if (senha) await enviar("/api/plataforma/restaurantes", "PATCH", { empresaId: empresa.id, acao: "senha", senha }); }
  async function trocarEmail(empresa: Empresa) { const email = window.prompt("Novo e-mail do administrador:", empresa.administrador?.email ?? ""); if (email) await enviar("/api/plataforma/restaurantes", "PATCH", { empresaId: empresa.id, acao: "email", email }); }

  async function pesquisarPedidos(event: FormEvent) {
    event.preventDefault();
    try { setPedidos(await requisicao(`/api/plataforma/pedidos?busca=${encodeURIComponent(buscaPedido)}&status=${encodeURIComponent(statusPedido)}&empresaId=${encodeURIComponent(empresaPedido)}&de=${encodeURIComponent(dataPedidoDe)}&ate=${encodeURIComponent(dataPedidoAte)}`)); }
    catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível pesquisar pedidos."); }
  }

  async function salvarAssinatura(assinatura: Assinatura) {
    const status = window.prompt("Status: teste, ativo, inadimplente ou cancelado", assinatura.status); if (!status) return;
    const valor = window.prompt("Valor mensal:", String(assinatura.valor_mensal)); if (valor === null) return;
    const vencimentoEm = window.prompt("Vencimento (AAAA-MM-DD, opcional):", assinatura.vencimento_em ?? ""); if (vencimentoEm === null) return;
    const observacoes = window.prompt("Observações internas:", assinatura.observacoes_internas ?? ""); if (observacoes === null) return;
    const bloqueioAutomatico = window.confirm("Ativar bloqueio automático quando esta assinatura vencer? Clique em Cancelar para deixar desligado.");
    await enviar("/api/plataforma/financeiro", "PATCH", { acao: "assinatura", assinaturaId: assinatura.id, planoId: assinatura.plano_id, status, valorMensal: Number(valor.replace(",", ".")), vencimentoEm, observacoes, bloqueioAutomatico });
  }

  async function registrarPagamento(event: FormEvent) {
    event.preventDefault();
    if (await enviar("/api/plataforma/financeiro", "POST", { acao: "pagamento", empresaId: novoPagamento.empresaId, valor: Number(novoPagamento.valor.replace(",", ".")), referencia: novoPagamento.referencia, status: novoPagamento.confirmado ? "confirmado" : "pendente" })) setNovoPagamento({ empresaId: "", valor: "", referencia: "", confirmado: true });
  }

  async function criarPlano(event: FormEvent) {
    event.preventDefault();
    if (await enviar("/api/plataforma/financeiro", "POST", { acao: "plano", nome: novoPlano.nome, descricao: novoPlano.descricao, valorMensal: Number(novoPlano.valor.replace(",", ".")) })) setNovoPlano({ nome: "", descricao: "", valor: "" });
  }

  async function enviarComunicado(event: FormEvent) {
    event.preventDefault();
    const todos = comunicado.destino === "todos";
    if (await enviar("/api/plataforma/comunicacao", "POST", { todos, empresaIds: todos ? [] : [comunicado.destino], titulo: comunicado.titulo, conteudo: comunicado.conteudo })) setComunicado({ destino: "todos", titulo: "", conteudo: "" });
  }

  async function criarChamado(event: FormEvent) {
    event.preventDefault();
    if (await enviar("/api/plataforma/suporte", "POST", { empresaId: novoChamado.empresaId, assunto: novoChamado.assunto, descricao: novoChamado.descricao, prioridade: novoChamado.prioridade })) setNovoChamado({ empresaId: "", assunto: "", descricao: "", prioridade: "normal" });
  }

  async function atualizarChamado(chamado: Chamado) {
    const status = window.prompt("Status: aberto, em_atendimento, resolvido ou fechado", chamado.status); if (!status) return;
    const resposta = window.prompt("Resposta para o restaurante:", chamado.resposta ?? ""); if (resposta === null) return;
    const notaInterna = window.prompt("Nota interna:", chamado.nota_interna ?? ""); if (notaInterna === null) return;
    await enviar("/api/plataforma/suporte", "PATCH", { chamadoId: chamado.id, status, resposta, notaInterna });
  }

  const identidade = (configuracoes.find((item) => item.chave === "identidade")?.valor ?? {}) as { nome?: string; mensagem_padrao?: string };
  const operacao = (configuracoes.find((item) => item.chave === "operacao")?.valor ?? {}) as { dias_tolerancia_inadimplencia?: number; mensagem_inadimplencia?: string; features_teste?: string[] };
  const [nomePlataforma, setNomePlataforma] = useState(""); const [mensagemPadrao, setMensagemPadrao] = useState(""); const [mensagemInadimplencia, setMensagemInadimplencia] = useState(""); const [tolerancia, setTolerancia] = useState("3"); const [featuresTeste, setFeaturesTeste] = useState("");
  useEffect(() => { setNomePlataforma(identidade.nome ?? "PedeAI"); setMensagemPadrao(identidade.mensagem_padrao ?? ""); setMensagemInadimplencia(operacao.mensagem_inadimplencia ?? ""); setTolerancia(String(operacao.dias_tolerancia_inadimplencia ?? 3)); setFeaturesTeste((operacao.features_teste ?? []).join(", ")); }, [configuracoes.length]);
  async function salvarConfiguracoes(event: FormEvent) { event.preventDefault(); await enviar("/api/plataforma/configuracoes", "PUT", { configuracoes: [{ chave: "identidade", valor: { nome: nomePlataforma, mensagem_padrao: mensagemPadrao } }, { chave: "operacao", valor: { dias_tolerancia_inadimplencia: Number(tolerancia), mensagem_inadimplencia: mensagemInadimplencia, features_teste: featuresTeste.split(",").map((feature) => feature.trim()).filter(Boolean) } }] }); }
  async function sair() { await supabase.auth.signOut(); router.replace("/entrar"); }

  const totalPedidos = useMemo(() => pedidos.reduce((soma, pedido) => soma + pedido.total, 0), [pedidos]);

  return <main className="min-h-screen bg-stone-50 p-4 pb-24 text-stone-900 sm:p-6"><header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">PedeAI · Plataforma</p><h1 className="mt-1 text-3xl font-bold">Central do superusuário</h1></div><div className="flex gap-2"><Link href="/plataforma/conta" className="rounded-xl bg-white px-3 py-2 text-sm font-bold shadow-sm">Minha conta</Link><button onClick={sair} className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-bold text-white">Sair</button></div></header><nav className="mx-auto mt-5 flex max-w-7xl gap-2 overflow-x-auto pb-2">{abas.map((item) => <button key={item.id} onClick={() => setAba(item.id)} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold ${aba === item.id ? "bg-orange-500 text-white" : "bg-white text-stone-600 shadow-sm"}`}>{item.titulo}</button>)}</nav>{erro && <p className="mx-auto mt-4 max-w-7xl rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{erro}</p>}{carregando ? <p className="grid min-h-64 place-items-center text-sm text-stone-500">Carregando central da plataforma…</p> : <section className="mx-auto mt-5 max-w-7xl">{aba === "resumo" && <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Restaurantes ativos", resumo?.restaurantes.ativos ?? 0], ["Em pausa", resumo?.restaurantes.pausados ?? 0], ["Bloqueados", resumo?.restaurantes.bloqueados ?? 0], ["Pedidos hoje", resumo?.pedidosHoje ?? 0]].map(([titulo, valor]) => <article key={String(titulo)} className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-stone-500">{titulo}</p><strong className="mt-2 block text-3xl">{valor}</strong></article>)}</div><div className="mt-4 grid gap-3 md:grid-cols-3"><article className="rounded-2xl bg-stone-900 p-5 text-white"><p className="text-sm text-stone-300">Volume dos pedidos hoje</p><strong className="mt-2 block text-2xl">{moeda.format(resumo?.volumePedidosHoje ?? 0)}</strong></article><article className="rounded-2xl bg-orange-500 p-5 text-white"><p className="text-sm text-orange-100">Recebido em planos no mês</p><strong className="mt-2 block text-2xl">{moeda.format(resumo?.faturamentoPlataformaMes ?? 0)}</strong></article><article className="rounded-2xl bg-white p-5 shadow-sm"><p className="font-bold">Alertas operacionais</p><p className="mt-2 text-sm text-stone-600">{resumo?.alertas.assinaturasVencidas ?? 0} assinaturas vencidas · {resumo?.alertas.chamadosAbertos ?? 0} chamados abertos</p><button onClick={() => void enviar("/api/plataforma/financeiro", "PATCH", { acao: "processar_inadimplencia" })} className="mt-4 rounded-xl bg-stone-900 px-3 py-2 text-sm font-bold text-white">Processar bloqueios vencidos</button></article></div></>}
  {aba === "restaurantes" && <><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Novo restaurante e administrador</h2><form onSubmit={criarRestaurante} className="mt-4 grid gap-2 md:grid-cols-2"><input required value={novoRestaurante.nome} onChange={(e) => setNovoRestaurante({ ...novoRestaurante, nome: e.target.value })} placeholder="Nome do restaurante" className="campo"/><input required value={novoRestaurante.slug} onChange={(e) => setNovoRestaurante({ ...novoRestaurante, slug: e.target.value })} placeholder="Link: minha-lanchonete" className="campo"/><input required type="email" value={novoRestaurante.email} onChange={(e) => setNovoRestaurante({ ...novoRestaurante, email: e.target.value })} placeholder="E-mail do administrador" className="campo"/><input required type="password" minLength={8} value={novoRestaurante.senha} onChange={(e) => setNovoRestaurante({ ...novoRestaurante, senha: e.target.value })} placeholder="Senha inicial (8 caracteres)" className="campo"/><button className="rounded-xl bg-orange-500 px-4 py-3 font-bold text-white md:col-span-2">Criar restaurante</button></form></section><div className="mt-5 grid gap-3 md:grid-cols-2">{empresas.map((empresa) => { const plano = primeiro(empresa.assinatura?.planos_plataforma)?.nome ?? "Sem plano"; return <article key={empresa.id} className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex gap-3">{empresa.logo_url && <img src={empresa.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover"/>}<div className="min-w-0 flex-1"><strong className="block truncate">{empresa.nome}</strong><Link href={`/${empresa.slug}`} target="_blank" className="text-sm font-bold text-orange-600">/{empresa.slug}</Link><p className="mt-2 text-xs text-stone-500">Plano: {plano} · {empresa.assinatura?.status ?? "sem assinatura"}</p><p className="mt-1 text-xs text-stone-500">{empresa.bloqueada ? "Bloqueado" : empresa.modo_operacao === "pausado" ? "Em pausa" : "Ativo"}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void editarRestaurante(empresa)} className="rounded-lg bg-stone-100 px-3 py-2 text-xs font-bold">Editar</button>{empresa.pendente_aprovacao && <button onClick={() => void enviar("/api/plataforma/restaurantes", "PATCH", { empresaId: empresa.id, acao: "aprovar" })} className="rounded-lg bg-green-100 px-3 py-2 text-xs font-bold text-green-800">Aprovar</button>}<button onClick={() => void enviar("/api/plataforma/restaurantes", "PATCH", { empresaId: empresa.id, acao: "bloquear", bloqueada: !empresa.bloqueada })} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{empresa.bloqueada ? "Reativar" : "Bloquear"}</button><button onClick={() => { if (window.confirm(`Excluir ${empresa.nome}? Esta ação remove dados do restaurante.`)) void enviar(`/api/plataforma/restaurantes?empresaId=${empresa.id}`, "DELETE"); }} className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-bold text-white">Excluir</button></div></article>; })}</div></>}
  {aba === "administradores" && <div className="space-y-3">{empresas.map((empresa) => <article key={empresa.id} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-orange-500">{empresa.nome}</p><h2 className="mt-1 font-bold">{empresa.administrador?.nome ?? "Sem administrador"}</h2><p className="mt-1 text-sm text-stone-600">{empresa.administrador?.email ?? "E-mail não encontrado"} · último acesso: {data(empresa.administrador?.ultimoAcesso)}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void redefinirSenha(empresa)} className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-bold text-white">Redefinir senha</button><button onClick={() => void trocarEmail(empresa)} className="rounded-xl bg-stone-100 px-3 py-2 text-sm font-bold">Trocar e-mail</button><span className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-800">Senhas nunca são exibidas.</span></div></article>)}</div>}
  {aba === "pedidos" && <><form onSubmit={pesquisarPedidos} className="flex flex-wrap gap-2 rounded-2xl bg-white p-4 shadow-sm"><input value={buscaPedido} onChange={(e) => setBuscaPedido(e.target.value)} placeholder="Número, cliente ou WhatsApp" className="campo min-w-56 flex-1"/><select value={empresaPedido} onChange={(e) => setEmpresaPedido(e.target.value)} className="campo"><option value="">Todos os restaurantes</option>{empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}</select><select value={statusPedido} onChange={(e) => setStatusPedido(e.target.value)} className="campo"><option value="">Todos os status</option><option value="recebido">Novo</option><option value="preparando">Em produção</option><option value="pronto_para_retirada">Pronto para retirada</option><option value="saiu_para_entrega">Em rota</option><option value="finalizado">Finalizado</option><option value="cancelado">Cancelado</option></select><input type="date" value={dataPedidoDe} onChange={(e) => setDataPedidoDe(e.target.value)} className="campo"/><input type="date" value={dataPedidoAte} onChange={(e) => setDataPedidoAte(e.target.value)} className="campo"/><button className="rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white">Buscar</button></form><div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">{pedidos.map((pedido) => <article key={pedido.id} className="flex flex-wrap items-center justify-between gap-2 border-b p-4 text-sm"><div><strong>#{String(pedido.numero_pedido).padStart(5, "0")} · {pedido.cliente_nome}</strong><p className="mt-1 text-xs text-stone-500">{primeiro(pedido.empresas)?.nome ?? "Restaurante"} · {pedido.cliente_telefone ?? "sem telefone"} · {pedido.status}</p></div><div className="text-right"><strong>{moeda.format(pedido.total)}</strong><p className="text-xs text-stone-500">{data(pedido.created_at)} · {pedido.pago ? "Pago" : pedido.pagamento}</p></div></article>)}</div></>}
  {aba === "financeiro" && <><div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Registrar pagamento de plano</h2><form onSubmit={registrarPagamento} className="mt-4 space-y-2"><select required value={novoPagamento.empresaId} onChange={(e) => setNovoPagamento({ ...novoPagamento, empresaId: e.target.value })} className="campo"><option value="">Selecione o restaurante</option>{empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}</select><input required value={novoPagamento.valor} onChange={(e) => setNovoPagamento({ ...novoPagamento, valor: e.target.value })} placeholder="Valor" inputMode="decimal" className="campo"/><input value={novoPagamento.referencia} onChange={(e) => setNovoPagamento({ ...novoPagamento, referencia: e.target.value })} placeholder="Referência: Julho/2026" className="campo"/><label className="flex gap-2 text-sm"><input type="checkbox" checked={novoPagamento.confirmado} onChange={(e) => setNovoPagamento({ ...novoPagamento, confirmado: e.target.checked })}/> Pagamento confirmado</label><button className="w-full rounded-xl bg-orange-500 py-3 font-bold text-white">Registrar pagamento</button></form></section><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Criar plano</h2><form onSubmit={criarPlano} className="mt-4 space-y-2"><input required value={novoPlano.nome} onChange={(e) => setNovoPlano({ ...novoPlano, nome: e.target.value })} placeholder="Nome do plano" className="campo"/><input value={novoPlano.descricao} onChange={(e) => setNovoPlano({ ...novoPlano, descricao: e.target.value })} placeholder="Descrição" className="campo"/><input required value={novoPlano.valor} onChange={(e) => setNovoPlano({ ...novoPlano, valor: e.target.value })} placeholder="Valor mensal" inputMode="decimal" className="campo"/><button className="w-full rounded-xl bg-stone-900 py-3 font-bold text-white">Adicionar plano</button></form><p className="mt-4 text-xs text-stone-500">Planos: {planos.map((plano) => `${plano.nome} (${moeda.format(plano.valor_mensal)})`).join(" · ")}</p></section></div><section className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm"><h2 className="p-5 font-bold">Assinaturas</h2>{assinaturas.map((assinatura) => <article key={assinatura.id} className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm"><div><strong>{primeiro(assinatura.empresas)?.nome}</strong><p className="mt-1 text-xs text-stone-500">{primeiro(assinatura.planos_plataforma)?.nome ?? "Sem plano"} · {assinatura.status} · vence {dataCurta(assinatura.vencimento_em)}</p></div><div className="flex items-center gap-2"><strong>{moeda.format(assinatura.valor_mensal)}</strong><button onClick={() => void salvarAssinatura(assinatura)} className="rounded-lg bg-stone-100 px-3 py-2 text-xs font-bold">Editar</button></div></article>)}</section></>}
  {aba === "comunicacao" && <section className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]"><form onSubmit={enviarComunicado} className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Novo comunicado</h2><select value={comunicado.destino} onChange={(e) => setComunicado({ ...comunicado, destino: e.target.value })} className="campo mt-4"><option value="todos">Todos os restaurantes ativos</option>{empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}</select><input required value={comunicado.titulo} onChange={(e) => setComunicado({ ...comunicado, titulo: e.target.value })} placeholder="Título" className="campo mt-2"/><textarea required value={comunicado.conteudo} onChange={(e) => setComunicado({ ...comunicado, conteudo: e.target.value })} placeholder="Mensagem" rows={6} className="campo mt-2"/><button className="mt-3 w-full rounded-xl bg-orange-500 py-3 font-bold text-white">Enviar comunicado</button></form><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Envios recentes</h2><p className="mt-3 text-sm text-stone-500">Os avisos ficam disponíveis no painel do restaurante.</p></section></section>}
  {aba === "suporte" && <><form onSubmit={criarChamado} className="grid gap-2 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-2"><select required value={novoChamado.empresaId} onChange={(e) => setNovoChamado({ ...novoChamado, empresaId: e.target.value })} className="campo"><option value="">Restaurante</option>{empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}</select><select value={novoChamado.prioridade} onChange={(e) => setNovoChamado({ ...novoChamado, prioridade: e.target.value })} className="campo"><option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select><input required value={novoChamado.assunto} onChange={(e) => setNovoChamado({ ...novoChamado, assunto: e.target.value })} placeholder="Assunto" className="campo md:col-span-2"/><textarea value={novoChamado.descricao} onChange={(e) => setNovoChamado({ ...novoChamado, descricao: e.target.value })} placeholder="Descrição ou observação interna" className="campo md:col-span-2"/><button className="rounded-xl bg-stone-900 px-4 py-3 font-bold text-white md:col-span-2">Criar chamado</button></form><div className="mt-4 space-y-3">{chamados.map((chamado) => <article key={chamado.id} className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs font-bold uppercase text-orange-500">{primeiro(chamado.empresas)?.nome}</p><h2 className="mt-1 font-bold">{chamado.assunto}</h2><p className="mt-2 text-sm text-stone-600">{chamado.descricao}</p></div><button onClick={() => void atualizarChamado(chamado)} className="h-fit rounded-xl bg-stone-100 px-3 py-2 text-sm font-bold">{chamado.status} · editar</button></div></article>)}</div></>}
  {aba === "seguranca" && <section className="overflow-hidden rounded-2xl bg-white shadow-sm"><h2 className="p-5 font-bold">Log de auditoria</h2>{logs.map((log) => <article key={log.id} className="border-t p-4 text-sm"><strong>{log.acao} · {log.recurso}</strong><p className="mt-1 text-xs text-stone-500">{data(log.created_at)} · {log.empresa_id ?? "Plataforma"}</p></article>)}</section>}
  {aba === "relatorios" && <div className="grid gap-4 md:grid-cols-3"><article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-stone-500">Restaurantes cadastrados</p><strong className="mt-2 block text-3xl">{empresas.length}</strong></article><article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-stone-500">Pedidos consultados</p><strong className="mt-2 block text-3xl">{pedidos.length}</strong><p className="mt-2 text-xs text-stone-500">A busca considera os últimos 100 pedidos.</p></article><article className="rounded-2xl bg-stone-900 p-5 text-white"><p className="text-sm text-stone-300">Volume dos pedidos consultados</p><strong className="mt-2 block text-3xl">{moeda.format(totalPedidos)}</strong></article></div>}
  {aba === "configuracoes" && <form onSubmit={salvarConfiguracoes} className="max-w-2xl rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Configurações da plataforma</h2><input required value={nomePlataforma} onChange={(e) => setNomePlataforma(e.target.value)} placeholder="Nome da plataforma" className="campo mt-4"/><textarea value={mensagemPadrao} onChange={(e) => setMensagemPadrao(e.target.value)} placeholder="Mensagem padrão" className="campo mt-2"/><input value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} inputMode="numeric" placeholder="Dias de tolerância para inadimplência" className="campo mt-2"/><textarea value={mensagemInadimplencia} onChange={(e) => setMensagemInadimplencia(e.target.value)} placeholder="Mensagem de inadimplência" className="campo mt-2"/><input value={featuresTeste} onChange={(e) => setFeaturesTeste(e.target.value)} placeholder="Features em teste, separadas por vírgula" className="campo mt-2"/><button className="mt-3 rounded-xl bg-orange-500 px-5 py-3 font-bold text-white">Salvar ajustes</button></form>}</section>}</main>;
}
