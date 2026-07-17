# PedeAI — Manual do desenvolvedor

Este documento explica como executar, alterar e publicar o PedeAI com segurança. Ele é voltado para quem vai manter o código, o banco Supabase e os deploys da Vercel.

## 1. Visão rápida da arquitetura

- **Next.js + React + TypeScript:** páginas, componentes e rotas de servidor.
- **Supabase:** PostgreSQL, autenticação, Storage e Realtime.
- **Vercel:** hospedagem da aplicação.
- **Multiempresa:** todo dado de restaurante deve ter `empresa_id`. Nunca faça uma consulta de produto, cliente ou pedido sem filtrar pela empresa correta.
- **Cliente final:** não usa Supabase Auth. A identidade é isolada por restaurante com telefone + senha de acesso de seis caracteres, guardada em cookie seguro pelo servidor.
- **Chave de serviço:** `SUPABASE_SERVICE_ROLE_KEY` só pode ser usada em código de servidor (`app/api` e `lib/supabase/server.ts`). Nunca coloque essa chave em componente com `"use client"`, no navegador, no GitHub ou em mensagem.

## 2. Preparar o ambiente local

No PowerShell:

```powershell
cd C:\Users\newli\OneDrive\Documentos\pedeai
npm install
```

Crie `.env.local` na raiz. O arquivo já é ignorado pelo Git:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-publicavel
SUPABASE_SERVICE_ROLE_KEY=sua-chave-secreta-do-servidor
```

Use a chave **Publishable/Anon** no navegador e a **Secret/Service Role** somente no servidor. Se uma chave secreta for exposta, revogue-a no Supabase e gere outra imediatamente.

Comandos de execução e validação:

```powershell
npm run dev
npm run build
npm run start
npm run lint
```

O `build` é obrigatório antes de publicar. Um deploy da Vercel que falha ao coletar dados geralmente indica variável de ambiente ausente, erro de TypeScript ou uma consulta de banco executada durante a geração da página.

## 3. Banco de dados: ordem das migrações

Execute os arquivos da pasta `database` no **SQL Editor** do Supabase, nesta ordem:

```text
001_mvp_inicial.sql
002_acessos_e_catalogo.sql
003_operacao_restaurante.sql
004_cadastro_restaurante_e_checkout.sql
005_realtime_pedidos.sql
006_checkout_cliente.sql
007_acompanhamento_pedidos.sql
008_perfil_e_operacao_restaurante.sql
009_clientes_publicos_e_enderecos.sql
010_subcategorias.sql
011_funcionamento_restaurante.sql
012_operacao_financeira.sql
013_pagamento_manual_pix.sql
014_mensagem_pix.sql
015_notificacoes_pedidos.sql
016_numero_e_historico_pedidos.sql
017_tempo_por_etapa_pedido.sql
018_pedido_local.sql
019_status_pronto_retirada.sql
```

`001_mvp_inicial.sql` cria as tabelas base e dados de demonstração; não execute esse arquivo novamente em um projeto já inicializado. As migrações seguintes usam `if not exists` sempre que possível, mas ainda devem ser aplicadas uma vez e na ordem.

### Realtime já habilitado

Se `005_realtime_pedidos.sql` retornar `relation "pedidos" is already member of publication "supabase_realtime"`, o Realtime já está configurado. Não repita o `alter publication`. Para conferir:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by schemaname, tablename;
```

Se precisar de uma versão idempotente para `pedidos`:

```sql
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pedidos'
  ) then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end $$;
```

### Conferir se as migrações foram aplicadas

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'pedidos'
order by ordinal_position;

select enumlabel
from pg_enum
where enumtypid = 'public.status_pedido'::regtype
order by enumsortorder;
```

O último comando deve conter `finalizado` e `pronto_para_retirada`.

## 4. Mapa das tabelas principais

| Tabela | Uso | Regra obrigatória |
|---|---|---|
| `empresas` | Restaurantes, configurações, horário, Pix e taxas | `id` identifica o restaurante |
| `perfis` | Usuários administrativos do restaurante | Sempre filtrar pelo `empresa_id` do perfil autenticado |
| `administradores_plataforma` | Superusuários | O acesso é independente do restaurante |
| `categorias` | Categorias e subcategorias | `empresa_id` obrigatório; subcategoria usa `categoria_pai_id` |
| `produtos` | Itens do cardápio | `empresa_id`, preço e `disponivel` |
| `adicionais` / `produto_adicionais` | Extras e vínculo com produtos | O vínculo também precisa pertencer à empresa |
| `combos` / `combo_produtos` | Combos e seus produtos | Nunca misturar produtos de empresas diferentes |
| `pedidos` | Cabeçalho do pedido | `empresa_id`, status, pagamento, total e cliente |
| `itens_pedido` | Itens congelados do pedido | Salvar nome e preço no momento da compra |
| `clientes_publicos` | Cliente final por restaurante | Unicidade é `(empresa_id, telefone)` |
| `enderecos_publicos` | Endereços do cliente final | Relacionado a `clientes_publicos` |
| `mensagens_plataforma` | Mensagens do superusuário | Relacionada à empresa |

## 5. Como adicionar um campo novo

Nunca edite uma migração que já foi executada em produção. Crie um novo arquivo numerado, por exemplo `020_whatsapp_secundario.sql`:

```sql
alter table public.empresas
  add column if not exists whatsapp_secundario text;
```

Depois:

1. Execute o arquivo no Supabase.
2. Inclua o campo no tipo TypeScript usado pelo componente.
3. Inclua o campo no `select`, `insert` ou `update` correspondente.
4. Adicione o campo à tela de configuração.
5. Revise as políticas RLS se o campo for acessível diretamente pelo navegador.
6. Teste com dois restaurantes diferentes para garantir que os dados não cruzam.

Para valores numéricos, use precisão monetária:

```sql
alter table public.empresas
  add column if not exists taxa_servico numeric(10,2) not null default 0
  check (taxa_servico >= 0);
```

Para opções estruturadas, prefira `jsonb` somente quando a aplicação realmente precisar de uma estrutura variável:

```sql
alter table public.empresas
  add column if not exists configuracoes_impressao jsonb not null default '{}'::jsonb;
```

## 6. Como adicionar um método de pagamento

Hoje `pedidos.pagamento` é `text`, portanto **não é necessário criar um enum no Supabase** para adicionar, por exemplo, “Vale-refeição”. O trabalho precisa ser feito em quatro pontos:

### 6.1 Banco (se o restaurante puder ativar/desativar)

Crie uma migração, por exemplo `020_pagamento_vale.sql`:

```sql
alter table public.empresas
  add column if not exists aceita_vale_refeicao boolean not null default false;

alter table public.empresas
  add column if not exists taxa_vale_refeicao numeric(10,2) not null default 0
  check (taxa_vale_refeicao >= 0);
```

Se o método não tiver configuração própria, nenhuma alteração SQL é necessária para o texto do pagamento.

### 6.2 Interface

Atualize as opções em:

- `components/pedido/cardapio.tsx` — checkout público.
- `components/admin/formulario-pedido-balcao.tsx` — PDV/balcão.
- `components/restaurante/configuracoes.tsx` ou `components/restaurante/pagamentos.tsx` — preferências do restaurante.

### 6.3 Servidor

Valide o valor recebido em `app/api/pedidos/route.ts` e `app/api/pedidos/balcao/route.ts`; nunca confie apenas no botão do navegador:

```ts
const pagamentosPermitidos = ["Pix", "Cartão", "Dinheiro", "Vale-refeição"];
if (!pagamentosPermitidos.includes(pagamento)) {
  return Response.json({ error: "Método de pagamento inválido." }, { status: 400 });
}
```

Se houver taxa, calcule o total no servidor e grave a taxa em `pedidos.taxa_pagamento`. O total enviado pelo cliente nunca deve ser considerado confiável.

### 6.4 Pagamento manual

O botão “Pago?” atualiza `pedidos.pago` e `pedidos.pago_em`. Ainda não existe gateway de pagamento; confirmação é manual pelo atendente.

## 7. Como adicionar um status de pedido

Status são um enum PostgreSQL. Crie uma migração:

```sql
alter type public.status_pedido
  add value if not exists 'em_conferencia';
```

Depois altere todos os pontos da interface:

- `components/admin/painel-pedidos.tsx`: lista de status ativos, rótulo, barra de progresso e `<option>` do pedido.
- `components/pedido/acompanhar-pedido.tsx`: mensagem, emoji e sequência exibida ao cliente.
- `components/restaurante/historico-pedidos.tsx`: inclua o status se ele representar histórico.
- `app/api/*`: valide o status caso a rota receba mudanças por HTTP.

Para retirada, o status já implementado é:

```text
recebido → preparando → pronto_para_retirada → finalizado
```

Para entrega:

```text
recebido → preparando → saiu_para_entrega → finalizado
```

Não remova valores antigos do enum sem planejar uma migração de dados. Para “cancelado”, “entregue” ou “finalizado”, mantenha compatibilidade com pedidos antigos.

## 8. Categorias, produtos, extras e combos

### Nova categoria

```sql
insert into public.categorias (empresa_id, nome, ordem)
values ('UUID-DA-EMPRESA', 'Hambúrgueres', 1);
```

### Subcategoria

```sql
insert into public.categorias (empresa_id, nome, categoria_pai_id, ordem)
values ('UUID-DA-EMPRESA', 'Artesanais', 'UUID-CATEGORIA-PAI', 2);
```

### Novo produto

```sql
insert into public.produtos (empresa_id, categoria_id, nome, descricao, preco, disponivel)
values ('UUID-DA-EMPRESA', 'UUID-DA-CATEGORIA', 'X-Bacon', 'Pão, hambúrguer e bacon', 29.90, true);
```

Para pausar sem excluir:

```sql
update public.produtos
set disponivel = false
where id = 'UUID-DO-PRODUTO'
  and empresa_id = 'UUID-DA-EMPRESA';
```

Para excluir, prefira a tela administrativa. Se precisar de SQL, mantenha o filtro de empresa:

```sql
delete from public.produtos
where id = 'UUID-DO-PRODUTO'
  and empresa_id = 'UUID-DA-EMPRESA';
```

O preço e o nome do item são copiados para `itens_pedido` no momento da compra. Isso preserva o histórico quando o cardápio mudar.

## 9. Segurança e RLS

As tabelas públicas de cardápio podem ter leitura pública apenas para dados ativos. Dados de clientes e pedidos devem continuar protegidos pelas rotas do servidor.

Ao criar uma tabela administrativa por restaurante, siga este padrão:

```sql
alter table public.nova_tabela enable row level security;

create policy "equipe gerencia dados da propria empresa"
on public.nova_tabela
for all
using (empresa_id = public.empresa_do_usuario())
with check (empresa_id = public.empresa_do_usuario());
```

Para dados do superusuário, use `public.eh_administrador_plataforma()`.

Antes de criar uma política, confira se ela não libera todos os restaurantes:

```sql
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Não crie política pública para `clientes_publicos`, `enderecos_publicos` ou dados sensíveis. As rotas usam `getSupabaseAdmin()` no servidor e devem validar empresa, sessão e entrada.

## 10. Rotas principais

### Usuário master

- `/plataforma/entrar` — login do superusuário.
- `/plataforma` — restaurantes, bloqueio, aprovação e mensagens.
- `/plataforma/conta` — dados da conta master.

### Restaurante

- `/restaurante/login` — login da equipe.
- `/restaurante` — dashboard.
- `/restaurante/pedidos` — pedidos ativos, status, impressão e balcão.
- `/restaurante/pdv` — tela exclusiva de pedido manual.
- `/restaurante/cardapio` — produtos, categorias e disponibilidade.
- `/restaurante/configuracoes` — dados públicos, horário e notificações.
- `/restaurante/pagamentos` — confirmação manual de pagamento.
- `/restaurante/pix` — chave e mensagem Pix.
- `/restaurante/historico` — pedidos finalizados, entregues e cancelados.
- `/restaurante/financeiro` — totais baseados em pedidos marcados como pagos.

### Cliente

- `/{slug}` — cardápio público principal.
- `/loja/{slug}` — rota alternativa do cardápio.
- `/{slug}/meus-pedidos` — histórico do cliente naquele restaurante.
- `/pedido/{codigo}` — acompanhamento do pedido.

### APIs

- `POST /api/pedidos` — checkout público.
- `POST /api/pedidos/balcao` — pedido manual autenticado do restaurante.
- `GET /api/acompanhamento?codigo=...` — acompanhamento.
- `GET/POST /api/cliente-publico` — sessão e dados do cliente.
- `GET/POST /api/historico-pedidos` — histórico e ações operacionais de pedidos.
- `PATCH /api/restaurante/clientes` — redefinição da senha de acesso do cliente pelo restaurante.
- `GET /api/pix` — leitura das configurações Pix do restaurante.
- `GET/POST/PATCH /api/plataforma/restaurantes` — operações do master.

## 11. Storage e imagens

Os buckets usados pelo projeto são `produto-imagens` e `empresa-imagens`. Para adicionar outro tipo de imagem:

1. Crie o bucket no Storage do Supabase.
2. Crie políticas de leitura pública somente se a imagem for pública.
3. Crie políticas de upload/exclusão para usuários autenticados e vinculados à empresa.
4. Salve apenas a URL no banco; não salve arquivo em coluna `text`.

Exemplo de política de leitura pública:

```sql
create policy "leitura publica de imagens"
on storage.objects for select
using (bucket_id = 'novo-bucket');
```

## 12. Diagnóstico rápido

### “Variáveis do Supabase ausentes”

Confira `.env.local` localmente e as variáveis da Vercel em **Settings → Environment Variables**. Marque os ambientes usados (Preview e Production) e faça novo deploy.

### “Forbidden use of secret API key in browser”

Algum componente com `"use client"` está importando `getSupabaseAdmin` ou usando `SUPABASE_SERVICE_ROLE_KEY`. Mova a operação para `app/api/.../route.ts` e chame a rota pelo navegador.

### “relation already exists”

O objeto já existe. Não recrie a tabela; use `alter table ... add column if not exists` ou confira a migração aplicada.

### “relation is already member of publication”

O Realtime já foi ativado. Use a consulta da seção 3 e não repita o `alter publication` simples.

### Erro ao criar pedido de balcão

Confirme que `018_pedido_local.sql` foi executado. O PDV usa `tipo_atendimento = 'local'`, enquanto a primeira versão do checkout aceitava apenas `entrega` e `retirada`.

### Página 404

Confira se a pasta e o arquivo `page.tsx` existem na rota esperada. Depois execute `npm run build`; o relatório final lista todas as rotas reconhecidas pelo Next.js.

## 13. Fluxo seguro para uma alteração

1. Descreva a mudança e identifique as telas, APIs e tabelas afetadas.
2. Crie uma nova migração SQL; não reescreva migrações já aplicadas.
3. Atualize tipos, consultas, servidor e interface.
4. Teste com pelo menos dois restaurantes e um cliente.
5. Execute `git diff --check`, `npm run build` e, quando possível, `npm run lint`.
6. Faça um commit pequeno e descritivo.
7. Execute a migração no Supabase antes de publicar o código que depende dela.
8. Publique no GitHub/Vercel e teste a URL de produção.

Comandos Git:

```powershell
git status
git add caminho/do/arquivo
git commit -m "feat: descreve a alteração"
git push origin main
```

## 14. Checklist antes de produção

- [ ] Variáveis do Supabase configuradas na Vercel.
- [ ] Chave de serviço somente no servidor.
- [ ] Migrações aplicadas na ordem.
- [ ] Realtime confirmado para `public.pedidos`.
- [ ] RLS habilitado e testado por empresa.
- [ ] Cardápio público testado em `/{slug}`.
- [ ] Checkout de entrega e retirada testado.
- [ ] PDV testado com pedido local.
- [ ] Status, histórico, impressão e confirmação manual de pagamento testados.
- [ ] `npm run build` concluído sem erro.
- [ ] Commit enviado ao GitHub e novo deploy concluído na Vercel.
