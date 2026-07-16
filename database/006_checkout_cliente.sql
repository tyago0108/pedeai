-- Execute após as migrações anteriores no SQL Editor do Supabase.
-- Dados necessários para o checkout público (entrega, retirada e troco).

alter table public.pedidos add column if not exists tipo_atendimento text not null default 'entrega'
  check (tipo_atendimento in ('entrega', 'retirada'));
alter table public.pedidos add column if not exists endereco_entrega text;
alter table public.pedidos add column if not exists troco_para numeric(10,2)
  check (troco_para is null or troco_para >= 0);
