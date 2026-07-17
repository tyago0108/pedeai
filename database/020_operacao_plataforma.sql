-- Painel de operação do superusuário: planos, financeiro, suporte, auditoria e configurações.
-- Execute após as migrações 001 a 019 no SQL Editor do Supabase.

create table if not exists public.planos_plataforma (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  valor_mensal numeric(10,2) not null default 0 check (valor_mensal >= 0),
  limite_pedidos_mensal integer,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assinaturas_restaurante (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null unique references public.empresas(id) on delete cascade,
  plano_id uuid references public.planos_plataforma(id) on delete set null,
  status text not null default 'teste' check (status in ('teste', 'ativo', 'inadimplente', 'cancelado')),
  valor_mensal numeric(10,2) not null default 0 check (valor_mensal >= 0),
  vencimento_em date,
  ultimo_pagamento_em timestamptz,
  bloqueio_automatico boolean not null default false,
  observacoes_internas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pagamentos_plataforma (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  assinatura_id uuid references public.assinaturas_restaurante(id) on delete set null,
  valor numeric(10,2) not null check (valor >= 0),
  referencia text,
  status text not null default 'pendente' check (status in ('pendente', 'confirmado', 'cancelado')),
  pago_em timestamptz,
  observacao text,
  created_at timestamptz not null default now()
);

create table if not exists public.chamados_suporte (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  assunto text not null,
  descricao text,
  status text not null default 'aberto' check (status in ('aberto', 'em_atendimento', 'resolvido', 'fechado')),
  prioridade text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta', 'urgente')),
  resposta text,
  nota_interna text,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.logs_auditoria_plataforma (
  id uuid primary key default gen_random_uuid(),
  administrador_id uuid references auth.users(id) on delete set null,
  empresa_id uuid references public.empresas(id) on delete set null,
  acao text not null,
  recurso text not null,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.configuracoes_plataforma (
  chave text primary key,
  valor jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists assinaturas_restaurante_vencimento_idx on public.assinaturas_restaurante(status, vencimento_em);
create index if not exists pagamentos_plataforma_empresa_data_idx on public.pagamentos_plataforma(empresa_id, created_at desc);
create index if not exists chamados_suporte_status_data_idx on public.chamados_suporte(status, created_at desc);
create index if not exists logs_auditoria_plataforma_data_idx on public.logs_auditoria_plataforma(created_at desc);

alter table public.planos_plataforma enable row level security;
alter table public.assinaturas_restaurante enable row level security;
alter table public.pagamentos_plataforma enable row level security;
alter table public.chamados_suporte enable row level security;
alter table public.logs_auditoria_plataforma enable row level security;
alter table public.configuracoes_plataforma enable row level security;

create policy "plataforma gerencia planos" on public.planos_plataforma for all
using (public.eh_administrador_plataforma()) with check (public.eh_administrador_plataforma());
create policy "plataforma gerencia assinaturas" on public.assinaturas_restaurante for all
using (public.eh_administrador_plataforma()) with check (public.eh_administrador_plataforma());
create policy "plataforma gerencia pagamentos" on public.pagamentos_plataforma for all
using (public.eh_administrador_plataforma()) with check (public.eh_administrador_plataforma());
create policy "plataforma gerencia chamados" on public.chamados_suporte for all
using (public.eh_administrador_plataforma()) with check (public.eh_administrador_plataforma());
create policy "plataforma le auditoria" on public.logs_auditoria_plataforma for select
using (public.eh_administrador_plataforma());
create policy "plataforma gerencia configuracoes" on public.configuracoes_plataforma for all
using (public.eh_administrador_plataforma()) with check (public.eh_administrador_plataforma());

insert into public.planos_plataforma (nome, descricao, valor_mensal, limite_pedidos_mensal)
values
  ('Teste', 'Validação inicial do restaurante.', 0, null),
  ('Essencial', 'Cardápio, pedidos e operação.', 49.90, null),
  ('Profissional', 'Operação completa e recursos avançados.', 99.90, null)
on conflict (nome) do nothing;

insert into public.configuracoes_plataforma (chave, valor)
values
  ('identidade', '{"nome":"PedeAI","mensagem_padrao":"Bem-vindo ao PedeAI."}'::jsonb),
  ('operacao', '{"dias_tolerancia_inadimplencia":3,"mensagem_inadimplencia":"Identificamos uma pendência no seu plano. Fale com o suporte PedeAI.","features_teste":[]}'::jsonb)
on conflict (chave) do nothing;

insert into public.assinaturas_restaurante (empresa_id, plano_id, status, valor_mensal)
select e.id, p.id, 'teste', p.valor_mensal
from public.empresas e
cross join public.planos_plataforma p
where p.nome = 'Teste'
on conflict (empresa_id) do nothing;
