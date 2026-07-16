-- Execute após as migrações anteriores.

alter table public.empresas add column if not exists pendente_aprovacao boolean not null default false;

create policy "plataforma aprova cadastro" on public.empresas for update
using (public.eh_administrador_plataforma()) with check (public.eh_administrador_plataforma());
