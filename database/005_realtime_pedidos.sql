-- Execute no SQL Editor do Supabase para atualizações instantâneas no painel.
-- O painel também consulta automaticamente a cada 15 segundos como alternativa.

alter publication supabase_realtime add table public.pedidos;
