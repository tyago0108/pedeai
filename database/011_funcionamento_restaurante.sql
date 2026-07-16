alter table public.empresas add column if not exists modo_operacao text not null default 'agenda'
  check (modo_operacao in ('agenda', 'aberto', 'pausado'));
alter table public.empresas add column if not exists agenda_funcionamento jsonb not null default '{}'::jsonb;
alter table public.empresas add column if not exists mensagem_pausa text;
