# StokaNet (saas-estoque)

Sistema de controle de estoque multi-empresa com login (NextAuth Credentials), painel e rotas protegidas.

## Rodar localmente

1) Instale dependencias:

```bash
npm install
```

2) Configure as variaveis de ambiente (Postgres):

- Copie `.env.example` para `.env.local` e preencha com um Postgres valido.
- Gere um secret forte para `NEXTAUTH_SECRET`.

3) Gere o Prisma e sincronize o schema:

```bash
npx prisma generate
npx prisma db push
```

Se o banco ja tiver dados e a alteracao de schema nao puder ser aplicada automaticamente, use `npx prisma db push --force-reset` em ambiente local de desenvolvimento.

4) (Opcional) Seed com usuario admin:

```bash
npm run seed
```

5) Inicie o servidor:

```bash
npm run dev
```

## Deploy no Vercel

O Vercel precisa de um banco remoto. O schema Prisma deste projeto usa PostgreSQL.

1) Crie um Postgres (recomendado: Neon) e copie as URLs.

2) No Vercel (Project Settings -> Environment Variables), configure:

- `DATABASE_URL` (pooler/pooled)
- `DIRECT_URL` (direct)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (ex: `https://seu-app.vercel.app`)

3) Faça o deploy. O script `build` roda apenas `prisma generate` e `next build`. Sincronize o schema do banco separadamente quando necessario.

## Login seed (dev)

Se voce rodar `npm run seed`, o admin sera:

- Email: `admin@auroracomercio.com`
- Senha: `admin123`
