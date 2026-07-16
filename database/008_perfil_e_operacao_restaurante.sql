-- Perfil público e dados operacionais do restaurante.

alter table public.empresas add column if not exists logo_url text;
alter table public.empresas add column if not exists endereco text;
alter table public.empresas add column if not exists horario_funcionamento text;

insert into storage.buckets (id, name, public) values ('empresa-imagens', 'empresa-imagens', true) on conflict (id) do nothing;
drop policy if exists "logo publico para leitura" on storage.objects;
create policy "logo publico para leitura" on storage.objects for select using (bucket_id = 'empresa-imagens');
drop policy if exists "restaurante envia logo" on storage.objects;
create policy "restaurante envia logo" on storage.objects for insert to authenticated with check (bucket_id = 'empresa-imagens');
drop policy if exists "restaurante remove logo" on storage.objects;
create policy "restaurante remove logo" on storage.objects for delete to authenticated using (bucket_id = 'empresa-imagens');

drop policy if exists "equipe adiciona itens aos pedidos" on public.itens_pedido;
create policy "equipe adiciona itens aos pedidos" on public.itens_pedido for insert to authenticated with check (
  pedido_id in (select id from public.pedidos where empresa_id in (select empresa_id from public.perfis where id = auth.uid()))
);
