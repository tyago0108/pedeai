-- Execute após 001 e 002. Pode ser executado uma única vez.

alter table public.empresas add column if not exists bloqueada boolean not null default false;
alter table public.empresas add column if not exists taxa_entrega numeric(10,2) not null default 0;
alter table public.empresas add column if not exists taxa_cartao numeric(10,2) not null default 0;
alter table public.empresas add column if not exists tempo_entrega_minutos integer not null default 45;
alter table public.empresas add column if not exists aceita_pix boolean not null default true;
alter table public.empresas add column if not exists aceita_dinheiro boolean not null default true;
alter table public.empresas add column if not exists aceita_cartao boolean not null default true;

alter table public.pedidos add column if not exists taxa_entrega numeric(10,2) not null default 0;
alter table public.pedidos add column if not exists taxa_pagamento numeric(10,2) not null default 0;
alter table public.pedidos add column if not exists precisa_troco boolean not null default false;
alter table public.pedidos add column if not exists troco_para numeric(10,2);
alter table public.pedidos add column if not exists endereco_texto text;

create table if not exists public.mensagens_plataforma (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  titulo text not null,
  conteudo text not null,
  lida_em timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  descricao text,
  preco numeric(10,2) not null check (preco >= 0),
  disponivel boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.combo_produtos (
  combo_id uuid not null references public.combos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  quantidade integer not null default 1 check (quantidade > 0),
  primary key (combo_id, produto_id)
);

alter table public.mensagens_plataforma enable row level security;
alter table public.combos enable row level security;
alter table public.combo_produtos enable row level security;

create policy "plataforma gerencia mensagens" on public.mensagens_plataforma for all
using (public.eh_administrador_plataforma()) with check (public.eh_administrador_plataforma());
create policy "restaurante le suas mensagens" on public.mensagens_plataforma for select
using (empresa_id = public.empresa_do_usuario());
create policy "plataforma gerencia combos" on public.combos for all
using (public.eh_administrador_plataforma()) with check (public.eh_administrador_plataforma());
create policy "restaurante gerencia seus combos" on public.combos for all
using (empresa_id = public.empresa_do_usuario()) with check (empresa_id = public.empresa_do_usuario());
create policy "catalogo le combos disponiveis" on public.combos for select using (disponivel = true);
create policy "restaurante gerencia itens de combo" on public.combo_produtos for all
using (combo_id in (select id from public.combos where empresa_id = public.empresa_do_usuario()))
with check (combo_id in (select id from public.combos where empresa_id = public.empresa_do_usuario()));
create policy "catalogo le itens de combo" on public.combo_produtos for select using (true);
create policy "restaurante atualiza configuracoes" on public.empresas for update
using (id = public.empresa_do_usuario()) with check (id = public.empresa_do_usuario());
