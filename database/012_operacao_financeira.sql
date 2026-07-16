-- Permite que a equipe remova somente pedidos da própria empresa.
drop policy if exists "equipe exclui pedidos da propria empresa" on public.pedidos;
create policy "equipe exclui pedidos da propria empresa" on public.pedidos for delete
using (empresa_id in (select empresa_id from public.perfis where id = auth.uid()));
