alter table public.pedidos add column if not exists status_atualizado_em timestamptz not null default now();

update public.pedidos
set status_atualizado_em = coalesce(status_atualizado_em, created_at)
where status_atualizado_em is null;
