-- Clientes públicos não usam Auth do Supabase. A identidade é sempre isolada por restaurante.

create table if not exists public.clientes_publicos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  telefone text not null,
  codigo_acesso text not null check (codigo_acesso ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, telefone),
  unique (empresa_id, codigo_acesso)
);

create table if not exists public.enderecos_publicos (
  id uuid primary key default gen_random_uuid(),
  cliente_publico_id uuid not null references public.clientes_publicos(id) on delete cascade,
  apelido text not null default 'Casa',
  endereco text not null,
  numero text not null,
  bairro text not null,
  cidade text not null,
  estado text not null,
  complemento text,
  referencia text,
  principal boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.pedidos add column if not exists cliente_publico_id uuid references public.clientes_publicos(id) on delete set null;
alter table public.pedidos add column if not exists endereco_publico_id uuid references public.enderecos_publicos(id) on delete set null;

create index if not exists clientes_publicos_empresa_telefone_idx on public.clientes_publicos(empresa_id, telefone);
create index if not exists pedidos_empresa_cliente_publico_idx on public.pedidos(empresa_id, cliente_publico_id, created_at desc);

alter table public.clientes_publicos enable row level security;
alter table public.enderecos_publicos enable row level security;
-- Não há políticas públicas: somente as rotas do servidor com chave privada leem ou alteram estes dados.
