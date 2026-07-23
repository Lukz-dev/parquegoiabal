# 🎯 Sistema de Assinatura com MercadoPago

## Configuração

### 1. Variáveis de Ambiente

Adicione estas variáveis ao seu `.env.local`:

```env
# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=APP_USR_xxxxxxxxxxxx
NEXT_PUBLIC_MERCADOPAGO_ENV=sandbox  # ou 'production'
DEFAULT_PAYER_EMAIL=seu-email@example.com

# URLs (ajuste conforme seu ambiente)
NEXTAUTH_URL=http://localhost:3000
```

### 2. Obter Credenciais do MercadoPago

1. Acesse [https://www.mercadopago.com.br/](https://www.mercadopago.com.br/)
2. Faça login ou crie uma conta
3. Vá para [Configurações > Credenciais](https://www.mercadopago.com.br/settings/account/credentials)
4. Copie o **Access Token** (use o token de Sandbox para testes)
5. Cole em `MERCADOPAGO_ACCESS_TOKEN`

### 3. Atualizar Database

Execute as migrações do Prisma:

```bash
npm run db:push
```

Isso criará a tabela `Subscription` com os campos necessários.

## Planos

| Plano | Preço | Ciclo | Desconto |
|-------|-------|-------|----------|
| Mensal | R$ 100 | 1 mês | - |
| Anual | R$ 1.020 | 1 ano | 15% (economiza R$ 180) |

## Fluxo de Pagamento

```
1. Usuário acessa /plans
2. Escolhe Mensal ou Anual
3. Clica em "Começar Agora"
4. API cria preferência no MercadoPago
5. Redireciona para checkout do MercadoPago ou preapproval de recorrência
6. Após aprovação, vai para /plans/success
7. Se recusado, vai para /plans/failure
```

## WebHook

O MercadoPago enviará notificações para:
- **URL**: `https://seu-dominio.com/api/webhook/mercadopago`
- **Método**: POST
- **Conteúdo**: Notificações de pagamento

### Configurar Webhook no MercadoPago

1. Acesse [Configurações > WebHooks](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/integration-configuration/how-tos/configuring-webhooks)
2. Adicione a URL: `https://seu-dominio.com/api/webhook/mercadopago`
3. Selecione os eventos:
   - `payment.created`
   - `payment.updated`

## Arquivos Criados

### Prisma Schema
- `prisma/schema.prisma` - Adicionados enums `PlanType` e `SubscriptionStatus` + modelo `Subscription`

### API Routes
- `app/api/subscription/create-preference/route.ts` - Cria preferência de pagamento
- `app/api/subscription/callback/route.ts` - Processa callback após pagamento
- `app/api/webhook/mercadopago/route.ts` - Recebe notificações do MercadoPago

### Componentes
- `components/PlansClient.tsx` - Exibe os planos disponíveis
- `app/(auth)/plans/page.tsx` - Página de planos

### Páginas de Retorno
- `app/(auth)/plans/success/page.tsx` - Pagamento aprovado
- `app/(auth)/plans/failure/page.tsx` - Pagamento recusado
- `app/(auth)/plans/pending/page.tsx` - Pagamento pendente

### Utilidades
- `lib/mercadopago.ts` - Configuração e funções auxiliares

## Testes

### Modo Sandbox (Testes)

1. Use cartões de teste do MercadoPago:
   - **Aprovado**: `4111 1111 1111 1111`
   - **Recusado**: `4002 1100 0000 0001`
   - Data qualquer (futura)
   - CVV: qualquer 3 dígitos

2. Acesse: `http://localhost:3000/plans`

3. Escolha um plano e clique em "Começar Agora"

### Modo Produção

1. Altere `NEXT_PUBLIC_MERCADOPAGO_ENV=production`
2. Use `MERCADOPAGO_ACCESS_TOKEN` de produção
3. Use cartões reais

## Status de Assinatura

- `PENDING` - Aguardando pagamento
- `ACTIVE` - Assinatura ativa
- `CANCELLED` - Assinatura cancelada
- `EXPIRED` - Assinatura expirada
- `SUSPENDED` - Assinatura suspensa

## Renovação Automática

O sistema calcula `nextBillingDate` automaticamente e o webhook sincroniza os eventos do MercadoPago:
- Mensal: +1 mês
- Anual: +1 ano
O fluxo recorrente usa a API de pré-aprovação da MercadoPago e atualiza a assinatura via webhook.

## Próximos Passos

- [ ] Implementar cancelamento de assinatura
- [ ] Adicionar mudança de plano (downgrade/upgrade)
- [ ] Criar página de gerenciamento de assinatura
- [ ] Integrar com email para confirmações
- [ ] Implementar cron job para renovação automática
- [ ] Adicionar relatórios de faturamento
