-- Status intermediário para pedidos em que o cliente fará a retirada no restaurante.
-- Execute este script no SQL Editor do Supabase depois das migrações anteriores.
alter type public.status_pedido
  add value if not exists 'pronto_para_retirada';
