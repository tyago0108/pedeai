This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Funcionalidade futura

A confirmação de entrega ou retirada por código foi preparada na estrutura do projeto, mas está desativada no momento. Pedidos são concluídos diretamente pelo restaurante; a confirmação por código será reavaliada em uma versão futura.

Pedidos para retirada possuem a etapa `pronto_para_retirada`. Execute `database/019_status_pronto_retirada.sql` no SQL Editor do Supabase antes de publicar esta versão.

## Manual do desenvolvedor

Consulte o [MANUAL_DESENVOLVEDOR.md](./MANUAL_DESENVOLVEDOR.md) para configuração do ambiente, migrações do Supabase, novos campos, pagamentos, status, RLS, rotas, diagnóstico e publicação.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
