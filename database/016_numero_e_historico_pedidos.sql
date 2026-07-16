-- Número humano e pesquisável para cada pedido. Execute uma única vez no SQL Editor.

alter type public.status_pedido add value if not exists 'finalizado';

create sequence if not exists public.pedidos_numero_seq start with 1000;

alter table public.pedidos add column if not exists numero_pedido bigint;
alter table public.pedidos alter column numero_pedido set default nextval('public.pedidos_numero_seq');
alter table public.pedidos add column if not exists pago boolean not null default false;
alter table public.pedidos add column if not exists pago_em timestamptz;

update public.pedidos
set numero_pedido = nextval('public.pedidos_numero_seq')
where numero_pedido is null;

select setval(
  'public.pedidos_numero_seq',
  greatest((select coalesce(max(numero_pedido), 1000) from public.pedidos), 1000),
  true
);

alter table public.pedidos alter column numero_pedido set not null;

create unique index if not exists pedidos_numero_pedido_unico on public.pedidos(numero_pedido);
create index if not exists pedidos_empresa_status_data_idx on public.pedidos(empresa_id, status, created_at desc);
create index if not exists pedidos_empresa_nome_cliente_idx on public.pedidos(empresa_id, cliente_nome);
