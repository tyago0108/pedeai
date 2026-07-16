-- Execute no SQL Editor após as migrações anteriores.
-- Identificadores públicos para acompanhamento e confirmação de entrega/retirada.

alter table public.pedidos add column if not exists codigo_acompanhamento uuid unique default gen_random_uuid();
alter table public.pedidos add column if not exists codigo_retirada text unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

update public.pedidos
set codigo_acompanhamento = gen_random_uuid()
where codigo_acompanhamento is null;

update public.pedidos
set codigo_retirada = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
where codigo_retirada is null;

alter table public.pedidos alter column codigo_acompanhamento set not null;
alter table public.pedidos alter column codigo_retirada set not null;

create index if not exists pedidos_empresa_telefone_idx on public.pedidos (empresa_id, cliente_telefone, created_at desc);
