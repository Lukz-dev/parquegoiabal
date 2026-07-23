# 📝 Passo a Passo Completo - Sistema de Assinatura com MercadoPago

## ✅ Etapa 1: Criar Conta no MercadoPago (5 min)

1. Acesse: https://www.mercadopago.com.br/
2. Clique em **"Criar conta"** (superior direito)
3. Escolha **"Sou profissional"**
4. Preencha seus dados:
   - Nome completo
   - Email (importante: use seu email real)
   - CPF/CNPJ
   - Senha
5. Confirme o email
6. Complete o perfil com seus dados bancários

---

## ✅ Etapa 2: Obter Credenciais do MercadoPago (3 min)

1. Faça login no MercadoPago
2. Clique no seu **nome/avatar** (canto superior direito)
3. Vá em **"Configurações"**
4. Na esquerda, clique em **"Credenciais de produção"** (ou "Desenvolvimento" para testes)
5. Você verá:
   - **Client ID** (não precisa por agora)
   - **Access Token** ← **COPIE ESTE**

**Para Testes (Sandbox):**
- Clique em **"Desenvolvimento"** no menu esquerdo
- Copie o **Access Token** de sandbox

---

## ✅ Etapa 3: Configurar Variáveis de Ambiente (2 min)

1. Abra o arquivo `.env.local` na raiz do projeto
   - Se não existir, crie um novo

2. Adicione/atualize estas linhas:

```env
# MercadoPago (Sandbox para testes)
MERCADOPAGO_ACCESS_TOKEN=APP_USR_xxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_MERCADOPAGO_ENV=sandbox
DEFAULT_PAYER_EMAIL=seu-email@example.com

# Já deve estar presente
NEXTAUTH_URL=http://localhost:3000
```

**Substitua:**
- `APP_USR_xxxxxxxxxxxxxxxxxxx` pelo Access Token copiado do MercadoPago
- `seu-email@example.com` pelo seu email real

3. **NÃO faça commit** desse arquivo (já está em `.gitignore`)

---

## ✅ Etapa 4: Sincronizar Database (2 min)

No terminal, na pasta `saas-estoque/`:

```bash
npm run db:push
```

Você verá algo como:
```
✔ Database synced, created 1 table
```

Isso cria a tabela `Subscription` no seu banco de dados.

---

## ✅ Etapa 5: Iniciar o Servidor (1 min)

1. Abra um terminal
2. Navegue para a pasta: `cd saas-estoque`
3. Inicie o servidor:

```bash
npm run dev
```

Você verá:
```
  ▲ Next.js 16.2.3
  - ready started server on 0.0.0.0:3000
```

---

## ✅ Etapa 6: Testar o Sistema (5 min)

### Passo 1: Criar/Fazer Login na Conta

1. Abra: http://localhost:3000
2. Se não tiver conta:
   - Clique em **"Criar Conta"**
   - Preencha: Nome, Email, Senha
   - Clique em **"Criar"**
3. Se já tiver:
   - Clique em **"Login"**
   - Use seu email e senha

### Passo 2: Acessar Página de Planos

1. Após fazer login, acesse: http://localhost:3000/plans
2. Você verá dois planos:
   - **Mensal**: R$ 100
   - **Anual**: R$ 1.020 (15% desconto)

### Passo 3: Fazer um Pagamento de Teste

1. Clique em **"Começar Agora"** em qualquer plano
2. Você será redirecionado para o MercadoPago
3. Use um **cartão de teste**:

**Para Aprovação:**
- Número: `4111 1111 1111 1111`
- Nome: qualquer nome
- Data: qualquer data futura (ex: 12/25)
- CVV: qualquer 3 dígitos (ex: 123)

4. Complete o pagamento
5. Se tudo der certo:
   - Será redirecionado para **"/plans/success"**
   - Verá uma mensagem de sucesso
   - Será redirecionado automaticamente para o dashboard

---

## ✅ Etapa 7: Verificar Assinatura no Banco (2 min)

Para confirmar que funcionou:

1. Abra seu banco de dados (ex: DBeaver, pgAdmin)
2. Procure pela tabela **`Subscription`**
3. Você verá um registro com:
   - `status`: "ACTIVE"
   - `planType`: "MONTHLY" ou "ANNUAL"
   - `amount`: 100 ou 1020
   - `nextBillingDate`: data de renovação

---

## ✅ Etapa 8: Testar Webhook (Opcional, mas importante)

O webhook é como o MercadoPago avisa seu sistema sobre pagamentos.

### Configurar no MercadoPago:

1. Faça login no MercadoPago
2. Vá em: **Configurações > WebHooks**
3. Clique em **"Novo webhook"**
4. Coloque a URL:
   - **Para testes locais**: use `ngrok` ou `localhost.run` (veja abaixo)
   - **Para produção**: `https://seu-dominio.com/api/webhook/mercadopago`
5. Selecione os eventos:
   - ✅ `payment.created`
   - ✅ `payment.updated`
6. Clique em **"Criar"**

### Testar Webhook Localmente com ngrok:

1. Baixe ngrok: https://ngrok.com/download
2. No terminal, execute:
   ```bash
   ngrok http 3000
   ```
3. Você verá uma URL como: `https://xxxxxxx.ngrok.io`
4. Use essa URL no webhook do MercadoPago:
   ```
   https://xxxxxxx.ngrok.io/api/webhook/mercadopago
   ```

---

## 🔄 Fluxo Completo (O que acontece por baixo)

```
1. Usuário acessa /plans
   ↓
2. Escolhe um plano (MONTHLY ou ANNUAL)
   ↓
3. Clica em "Começar Agora"
   ↓
4. Frontend chama: POST /api/subscription/create-preference
   ↓
5. Backend cria preferência no MercadoPago
   ↓
6. MercadoPago retorna URL de checkout
   ↓
7. Usuário é redirecionado para checkout do MercadoPago
   ↓
8. Usuário preenche dados do cartão
   ↓
9. Pagamento é processado
   ↓
10. MercadoPago redireciona para /api/subscription/callback
   ↓
11. Backend atualiza status de "PENDING" para "ACTIVE"
   ↓
12. Usuário é redirecionado para /plans/success
   ↓
13. MercadoPago envia notificação via webhook
   ↓
14. Backend processa webhook e confirma assinatura
```

---

## 🧪 Testando Diferentes Cenários

### ✅ Pagamento Aprovado
- Cartão: `4111 1111 1111 1111`
- Data: qualquer futura
- CVV: qualquer 3 dígitos
- **Resultado**: Redirecionado para /plans/success

### ❌ Pagamento Recusado
- Cartão: `4002 1100 0000 0001`
- Data: qualquer futura
- CVV: qualquer 3 dígitos
- **Resultado**: Redirecionado para /plans/failure

### ⏳ Pagamento Pendente
- Cartão: `4000 0000 0000 0002`
- Data: qualquer futura
- CVV: qualquer 3 dígitos
- **Resultado**: Redirecionado para /plans/pending

---

## 🚀 Ir para Produção (quando pronto)

1. **Obter credenciais de Produção:**
   - No MercadoPago, vá em **Configurações > Credenciais de Produção**
   - Copie o **Access Token** de produção

2. **Atualizar `.env.local`:**
   ```env
   MERCADOPAGO_ACCESS_TOKEN=APP_USR_production_token
   NEXT_PUBLIC_MERCADOPAGO_ENV=production
   ```

3. **Deploy no Vercel:**
   ```bash
   git add .
   git commit -m "Add subscription system"
   git push origin main
   ```

4. **Configurar variáveis no Vercel:**
   - Vá em seu projeto no Vercel
   - Settings > Environment Variables
   - Adicione as mesmas variáveis do `.env.local`

5. **Configurar Webhook em Produção:**
   - MercadoPago > Configurações > WebHooks
   - URL: `https://seu-dominio.com/api/webhook/mercadopago`

---

## 🆘 Solução de Problemas

### "erro ao criar pagamento"
- ✅ Verifique se `MERCADOPAGO_ACCESS_TOKEN` está correto
- ✅ Verifique se o servidor foi reiniciado após mudar `.env.local`
- ✅ Verifique se está usando token de Sandbox com `NEXT_PUBLIC_MERCADOPAGO_ENV=sandbox`

### Webhook não funciona localmente
- ✅ Use `ngrok` para expor sua máquina
- ✅ Ou configure webhook apenas para produção

### Assinatura fica em "PENDING"
- ✅ Verifique os logs do servidor (terminal)
- ✅ MercadoPago pode estar enviando notificação com atraso
- ✅ Aguarde 5 minutos

### Cartão de teste recusado
- ✅ Use sempre os cartões listados acima
- ✅ Data deve ser futura (ex: 12/2025)
- ✅ CVV qualquer 3 dígitos

---

## 📚 Documentação Útil

- [MercadoPago API Docs](https://www.mercadopago.com.br/developers/pt/docs)
- [Cartões de Teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/landing)
- [Configurar WebHooks](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/integration-configuration/how-tos/configuring-webhooks)

---

## ✨ Próximos Passos Opcionais

Depois que funcionar, você pode adicionar:

1. **Cancelar assinatura** - página para cancelar plano
2. **Trocar plano** - fazer upgrade/downgrade
3. **Relatórios** - dashboard de faturamento
4. **Renovação automática** - cron job para renovar assinaturas
5. **Email de confirmação** - notificar usuário via email
6. **Integração com limites** - ex: mensagem se assinatura expirar

Quer que eu implemente algum desses? 🚀
