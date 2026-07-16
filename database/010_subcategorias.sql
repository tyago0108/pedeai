-- Categorias podem ter uma categoria principal opcional, formando subcategorias.
alter table public.categorias add column if not exists categoria_pai_id uuid references public.categorias(id) on delete set null;
create index if not exists categorias_empresa_pai_idx on public.categorias(empresa_id, categoria_pai_id);
