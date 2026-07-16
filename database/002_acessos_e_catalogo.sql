-- Execute após 001_mvp_inicial.sql no SQL Editor do Supabase.

create table public.administradores_plataforma (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.clientes (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  telefone text,
  created_at timestamptz not null default now()
);

create table public.enderecos_clientes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  apelido text not null default 'Casa',
  cep text,
  rua text not null,
  numero text not null,
  complemento text,
  bairro text not null,
  cidade text not null,
  referencia text,
  principal boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.produtos add column if not exists imagem_url text;
alter table public.pedidos add column if not exists cliente_id uuid references public.clientes(id) on delete set null;
alter table public.pedidos add column if not exists endereco_id uuid references public.enderecos_clientes(id) on delete set null;

create table public.adicionais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  preco numeric(10,2) not null default 0 check (preco >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.produto_adicionais (
  produto_id uuid not null references public.produtos(id) on delete cascade,
  adicional_id uuid not null references public.adicionais(id) on delete cascade,
  primary key (produto_id, adicional_id)
);

create table public.item_pedido_adicionais (
  id uuid primary key default gen_random_uuid(),
  item_pedido_id uuid not null references public.itens_pedido(id) on delete cascade,
  nome text not null,
  preco numeric(10,2) not null default 0 check (preco >= 0)
);

create or replace function public.eh_administrador_plataforma()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.administradores_plataforma where id = auth.uid()) $$;

create or replace function public.empresa_do_usuario()
returns uuid language sql stable security definer set search_path = public
as $$ select empresa_id from public.perfis where id = auth.uid() limit 1 $$;

alter table public.administradores_plataforma enable row level security;
alter table public.clientes enable row level security;
alter table public.enderecos_clientes enable row level security;
alter table public.adicionais enable row level security;
alter table public.produto_adicionais enable row level security;
alter table public.item_pedido_adicionais enable row level security;

create policy "plataforma gerencia empresas" on public.empresas for all
using (public.eh_administrador_plataforma()) with check (public.eh_administrador_plataforma());
create policy "plataforma gerencia perfis" on public.perfis for all
using (public.eh_administrador_plataforma()) with check (public.eh_administrador_plataforma());
create policy "plataforma consulta administradores" on public.administradores_plataforma for select
using (public.eh_administrador_plataforma());

create policy "cliente le proprio cadastro" on public.clientes for select using (id = auth.uid());
create policy "cliente cria proprio cadastro" on public.clientes for insert with check (id = auth.uid());
create policy "cliente atualiza proprio cadastro" on public.clientes for update using (id = auth.uid()) with check (id = auth.uid());
create policy "cliente gerencia enderecos" on public.enderecos_clientes for all
using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());
create policy "cliente le proprios pedidos" on public.pedidos for select using (cliente_id = auth.uid());

create policy "equipe gerencia adicionais" on public.adicionais for all
using (empresa_id = public.empresa_do_usuario()) with check (empresa_id = public.empresa_do_usuario());
create policy "catalogo le adicionais ativos" on public.adicionais for select using (ativo = true);
create policy "equipe gerencia vinculos de adicionais" on public.produto_adicionais for all
using (produto_id in (select id from public.produtos where empresa_id = public.empresa_do_usuario()))
with check (produto_id in (select id from public.produtos where empresa_id = public.empresa_do_usuario()));
create policy "catalogo le vinculos de adicionais" on public.produto_adicionais for select using (true);
create policy "equipe le adicionais de itens" on public.item_pedido_adicionais for select
using (item_pedido_id in (select i.id from public.itens_pedido i join public.pedidos p on p.id = i.pedido_id where p.empresa_id = public.empresa_do_usuario()));

insert into storage.buckets (id, name, public)
values ('produto-imagens', 'produto-imagens', true)
on conflict (id) do nothing;

create policy "imagem publica para leitura" on storage.objects for select using (bucket_id = 'produto-imagens');
create policy "equipe envia imagem de produto" on storage.objects for insert to authenticated
with check (bucket_id = 'produto-imagens');
create policy "equipe remove imagem de produto" on storage.objects for delete to authenticated
using (bucket_id = 'produto-imagens');
