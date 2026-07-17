-- Permite pedidos manuais consumidos no próprio restaurante.
-- Execute depois das migrações anteriores no SQL Editor do Supabase.

alter table public.pedidos drop constraint if exists pedidos_tipo_atendimento_check;

alter table public.pedidos
  add constraint pedidos_tipo_atendimento_check
  check (tipo_atendimento in ('entrega', 'retirada', 'local'));
