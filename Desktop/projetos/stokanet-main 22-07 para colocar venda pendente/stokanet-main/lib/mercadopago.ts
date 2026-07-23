import "dotenv/config";

export const mercadopagoClient = null;

export const PLANS = {
  MONTHLY: {
    id: "monthly",
    name: "Plano Mensal",
    price: 100,
    currency: "BRL",
    description: "Acesso mensal ao sistema de estoque",
    billingCycle: "month",
  },
  ANNUAL: {
    id: "annual",
    name: "Plano Anual",
    price: 1020, // R$ 100/mês com 15% de desconto = R$ 1.020/ano
    currency: "BRL",
    description: "Acesso anual ao sistema de estoque com 15% de desconto",
    billingCycle: "year",
  },
};

export async function createPreference(
  planId: keyof typeof PLANS,
  companyId: string,
  companyName: string,
  payerEmail: string,
  appUrl?: string,
  billingMode: "ONE_TIME" | "RECURRING" = "ONE_TIME"
) {
  const plan = PLANS[planId];

  const accessToken = getMercadoPagoAccessToken();
  const baseUrl = appUrl || process.env.NEXTAUTH_URL || "http://localhost:3000";

  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  }

  if (!payerEmail) {
    throw new Error("E-mail do pagador não informado");
  }

  if (billingMode === "RECURRING") {
    return createRecurringPreference(plan, companyId, companyName, baseUrl, payerEmail, accessToken);
  }

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          id: plan.id,
          title: plan.name,
          description: plan.description,
          picture_url:
            "https://via.placeholder.com/180x180?text=" +
            encodeURIComponent(plan.name),
          category_id: "subscription",
          quantity: 1,
          unit_price: plan.price,
          currency_id: plan.currency,
        },
      ],
      payer: {
        name: companyName,
        email: payerEmail,
      },
      back_urls: {
        success: `${baseUrl}/plans/success`,
        failure: `${baseUrl}/plans/failure`,
        pending: `${baseUrl}/plans/pending`,
      },
      notification_url: `${baseUrl}/api/webhook/mercadopago`,
      external_reference: companyId,
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),
  });

  const responseBody = await response.json().catch(async () => ({
    raw: await response.text(),
  }));

  if (!response.ok) {
    throw new Error(
      `MercadoPago API error (${response.status}): ${JSON.stringify(responseBody)}`
    );
  }

  return responseBody;
}

function getMercadoPagoAccessToken() {
  return (
    process.env.MERCADOPAGO_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    ""
  );
}

export function getMercadoPagoPayerEmail(sessionEmail: string) {
  const isSandbox = process.env.NEXT_PUBLIC_MERCADOPAGO_ENV === "sandbox";
  const testBuyerEmail = process.env.MERCADOPAGO_TEST_BUYER_EMAIL?.trim();

  if (isSandbox && testBuyerEmail) {
    return testBuyerEmail;
  }

  return sessionEmail;
}

async function createRecurringPreference(
  plan: (typeof PLANS)[keyof typeof PLANS],
  companyId: string,
  companyName: string,
  baseUrl: string,
  payerEmail: string,
  accessToken: string
) {
  const frequency = plan.billingCycle === "month" ? 1 : 12;

  const response = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: `${companyName} - ${plan.name}`,
      external_reference: companyId,
      payer_email: payerEmail,
      back_url: new URL("/plans/success", baseUrl).toString(),
      notification_url: `${baseUrl}/api/webhook/mercadopago`,
      status: "pending",
      auto_recurring: {
        frequency,
        frequency_type: "months",
        transaction_amount: plan.price,
        currency_id: plan.currency,
      },
    }),
  });

  const responseBody = await response.json().catch(async () => ({
    raw: await response.text(),
  }));

  if (!response.ok) {
    throw new Error(
      `MercadoPago API error (${response.status}): ${JSON.stringify(responseBody)}`
    );
  }

  return responseBody;
}

export function calculateNextBillingDate(planType: "MONTHLY" | "ANNUAL") {
  const now = new Date();
  if (planType === "MONTHLY") {
    return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  } else {
    return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  }
}

export function getExpirationDate(planType: "MONTHLY" | "ANNUAL") {
  const now = new Date();
  if (planType === "MONTHLY") {
    return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  } else {
    return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  }
}

export function formatMercadoPagoError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "object" && error !== null) {
    return {
      ...error,
      json: JSON.stringify(error),
    };
  }

  return { message: String(error) };
}
