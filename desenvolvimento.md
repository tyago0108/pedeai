# PedeAI - Documento de Desenvolvimento

## Objetivo do Projeto

O PedeAI será uma plataforma SaaS de pedidos para pequenos restaurantes, lanchonetes, hamburguerias e negócios locais.

A proposta inicial é oferecer uma alternativa simples e de baixo custo para estabelecimentos que não querem pagar sistemas caros como Anota AI.

O cliente final realizará pedidos através de um link enviado pelo WhatsApp.

---

# Visão do Produto

O sistema permitirá:

- Cadastro de restaurantes.
- Criação de cardápio digital.
- Recebimento de pedidos.
- Controle de pedidos locais.
- Controle de pedidos vindos do WhatsApp.
- Gestão de produtos.
- Gestão de categorias.

---

# Estratégia Inicial

O MVP será desenvolvido para atender inicialmente:

- 1 ou 2 restaurantes reais.

Após validação:

- Transformar em SaaS.
- Criar planos pagos.
- Escalar para diversos restaurantes.

---

# Tecnologias

## Front-end

- Next.js
- React
- TypeScript
- Tailwind CSS


## Backend

Inicialmente:

- Supabase

Responsável por:

- Banco PostgreSQL.
- Autenticação.
- API.
- Storage.


## Hospedagem

- Vercel


## Versionamento

- Git
- GitHub

---

# Arquitetura

Modelo:

Multi Tenant.

Um único sistema atenderá vários restaurantes.

Cada dado será relacionado através de:

empresa_id

Exemplo:

Restaurante A:

- Produtos
- Pedidos
- Clientes


Restaurante B:

- Produtos
- Pedidos
- Clientes


Os dados nunca serão misturados.

---

# Estrutura de Pastas

## app

Páginas e rotas do Next.js.


## components

Componentes visuais reutilizáveis.


## services

Comunicação com banco e regras de negócio.


## lib

Configurações externas:

- Supabase
- APIs
- autenticação


## hooks

Hooks personalizados React.


## contexts

Estados globais da aplicação.


## types

Interfaces TypeScript.


## utils

Funções auxiliares.


## constants

Valores fixos da aplicação.


## database

Arquivos relacionados ao banco.

---

# Regras de Desenvolvimento

1. Toda funcionalidade deve ser testada antes de avançar.

2. Toda alteração importante gera um commit.

3. Não criar funcionalidades futuras sem necessidade.

4. Sempre desenvolver em pequenas etapas.

5. Manter documentação atualizada.

---

# Histórico

## Versão 0.1

Data:
16/07/2026

Status:

Projeto inicial criado.

Concluído:

- Next.js configurado.
- TypeScript configurado.
- Tailwind configurado.
- Git configurado.
- GitHub conectado.
- Estrutura inicial criada.

Commit:

dd5ca70

---

# Próximas etapas

## Etapa 1

Configuração inicial da arquitetura.

- Criar documentação.
- Revisar estrutura.
- Primeiro commit da organização.


## Etapa 2

Configurar Supabase.

- Criar projeto.
- Configurar variáveis ambiente.
- Criar conexão.