-- PedeAI MVP: execute este arquivo uma única vez no SQL Editor do Supabase.
-- Ele cria um banco multiempresa, um cardápio público e o fluxo de pedidos.

create extension if not exists "pgcrypto";

create type public.status_pedido as enum (
  'recebido', 'preparando', 'saiu_para_entrega', 'entregue', 'cancelado'
);

create type public.origem_pedido as enum ('local', 'whatsapp');

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  whatsapp text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  unique (empresa_id, nome)
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  categoria_id uuid references public.categorias(id) on delete set null,
  nome text not null,
  descricao text,
  preco numeric(10,2) not null check (preco >= 0),
  disponivel boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_nome text not null,
  cliente_telefone text,
  tipo_entrega public.origem_pedido not null default 'whatsapp',
  status public.status_pedido not null default 'recebido',
  pagamento text not null,
  observacao text,
  total numeric(10,2) not null check (total >= 0),
  created_at timestamptz not null default now()
);

create table public.itens_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  nome_produto text not null,
  quantidade integer not null check (quantidade > 0),
  preco_unitario numeric(10,2) not null check (preco_unitario >= 0)
);

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  papel text not null default 'dono' check (papel in ('dono', 'atendente')),
  created_at timestamptz not null default now()
);

create index produtos_empresa_id_idx on public.produtos(empresa_id);
create index pedidos_empresa_created_at_idx on public.pedidos(empresa_id, created_at desc);

alter table public.empresas enable row level security;
alter table public.categorias enable row level security;
alter table public.produtos enable row level security;
alter table public.pedidos enable row level security;
alter table public.itens_pedido enable row level security;
alter table public.perfis enable row level security;

-- Somente dados do cardápio podem ser lidos sem login.
create policy "cardapio publico le empresas ativas" on public.empresas
  for select using (ativo = true);
create policy "cardapio publico le categorias" on public.categorias
  for select using (true);
create policy "cardapio publico le produtos disponiveis" on public.produtos
  for select using (disponivel = true);

-- O pedido público é permitido, mas o valor e os itens são validados pelo Route Handler.
create policy "cliente cria pedido" on public.pedidos
  for insert with check (true);
create policy "cliente cria itens do pedido" on public.itens_pedido
  for insert with check (true);

create policy "usuario le proprio perfil" on public.perfis
  for select using (id = auth.uid());
create policy "equipe le propria empresa" on public.empresas
  for select using (id in (select empresa_id from public.perfis where id = auth.uid()));
create policy "equipe gerencia categorias" on public.categorias
  for all using (empresa_id in (select empresa_id from public.perfis where id = auth.uid()))
  with check (empresa_id in (select empresa_id from public.perfis where id = auth.uid()));
create policy "equipe gerencia produtos" on public.produtos
  for all using (empresa_id in (select empresa_id from public.perfis where id = auth.uid()))
  with check (empresa_id in (select empresa_id from public.perfis where id = auth.uid()));
create policy "equipe le pedidos da propria empresa" on public.pedidos
  for select using (empresa_id in (select empresa_id from public.perfis where id = auth.uid()));
create policy "equipe atualiza pedidos da propria empresa" on public.pedidos
  for update using (empresa_id in (select empresa_id from public.perfis where id = auth.uid()))
  with check (empresa_id in (select empresa_id from public.perfis where id = auth.uid()));
create policy "equipe le itens dos pedidos da propria empresa" on public.itens_pedido
  for select using (pedido_id in (
    select id from public.pedidos where empresa_id in (
      select empresa_id from public.perfis where id = auth.uid()
    )
  ));

-- Dados de demonstração: remova ou edite depois da primeira execução.
insert into public.empresas (nome, slug, whatsapp)
values ('Minha Lanchonete', 'minha-lanchonete', null);

insert into public.categorias (empresa_id, nome, ordem)
select id, 'Lanches', 1 from public.empresas where slug = 'minha-lanchonete';

insert into public.produtos (empresa_id, categoria_id, nome, descricao, preco)
select e.id, c.id, 'X-Burger', 'Pão, hambúrguer, queijo e molho da casa.', 18.90
from public.empresas e join public.categorias c on c.empresa_id = e.id
where e.slug = 'minha-lanchonete' and c.nome = 'Lanches';

insert into public.produtos (empresa_id, categoria_id, nome, descricao, preco)
select e.id, c.id, 'X-Salada', 'Hambúrguer, queijo, alface, tomate e molho da casa.', 22.90
from public.empresas e join public.categorias c on c.empresa_id = e.id
where e.slug = 'minha-lanchonete' and c.nome = 'Lanches';
