export type AgendaDia = { ativo?: boolean; inicio?: string; fim?: string };
export type Agenda = Record<string, AgendaDia>;

export function verificarFuncionamento(empresa: { ativo?: boolean; bloqueada?: boolean; modo_operacao?: string; agenda_funcionamento?: Agenda | null; mensagem_pausa?: string | null }, agora = new Date()) {
  if (!empresa.ativo || empresa.bloqueada) return { aberto: false, mensagem: "Este restaurante não está aceitando pedidos no momento." };
  if (empresa.modo_operacao === "aberto") return { aberto: true, mensagem: "" };
  if (empresa.modo_operacao === "pausado") return { aberto: false, mensagem: empresa.mensagem_pausa?.trim() || "Fizemos uma pausa, voltamos em breve." };
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(agora);
  const diaIngles = partes.find(p => p.type === "weekday")?.value ?? "Sun";
  const dia: Record<string, string> = { Sun: "dom", Mon: "seg", Tue: "ter", Wed: "qua", Thu: "qui", Fri: "sex", Sat: "sab" };
  const hora = `${partes.find(p => p.type === "hour")?.value ?? "00"}:${partes.find(p => p.type === "minute")?.value ?? "00"}`;
  const configuracao = empresa.agenda_funcionamento?.[dia[diaIngles]];
  const aberto = Boolean(configuracao?.ativo && configuracao.inicio && configuracao.fim && hora >= configuracao.inicio && hora < configuracao.fim);
  return { aberto, mensagem: aberto ? "" : empresa.mensagem_pausa?.trim() || "Estamos fora do horário de atendimento. Consulte nosso horário e volte em breve." };
}
