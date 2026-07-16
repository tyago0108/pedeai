alter table public.empresas add column if not exists pix_chave text;
alter table public.pedidos add column if not exists pago boolean not null default false;
alter table public.pedidos add column if not exists pago_em timestamptz;
