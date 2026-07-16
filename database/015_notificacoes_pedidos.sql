alter table public.empresas add column if not exists notificacoes_ativas boolean not null default true;
alter table public.empresas add column if not exists notificacao_sonora boolean not null default true;
