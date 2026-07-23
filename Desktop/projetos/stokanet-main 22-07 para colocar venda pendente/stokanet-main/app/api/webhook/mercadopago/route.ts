import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function getMercadoPagoAccessToken() {
  return (
    process.env.MERCADOPAGO_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    ""
  );
}

function normalizeMercadoPagoResourceId(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value === "object" && value !== null && "id" in value) {
    return normalizeMercadoPagoResourceId((value as { id?: unknown }).id);
  }

  const rawValue = String(value).trim();
  const trailingId = rawValue.match(/(\d+)$/)?.[1];
  return trailingId || rawValue || null;
}

function getNextBillingDate(planType: "MONTHLY" | "ANNUAL") {
  const nextBillingDate = new Date();
  nextBillingDate.setMonth(nextBillingDate.getMonth() + (planType === "MONTHLY" ? 1 : 12));
  return nextBillingDate;
}

async function fetchMercadoPagoResource(path: string) {
  const accessToken = getMercadoPagoAccessToken();
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  }

  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao consultar MercadoPago (${response.status}): ${body}`);
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(async () => ({ raw: await request.text() }));
    const topic = body.topic ?? body.type ?? body.action ?? body?.data?.type;
    const resourceId = normalizeMercadoPagoResourceId(
      body?.data?.id ?? body?.resource?.id ?? body?.id ?? body?.resource
    );

    console.log("Webhook MercadoPago recebido:", { topic, resourceId, body });

    if (!topic || !resourceId) {
      return NextResponse.json({ success: true, ignored: true });
    }

    if (String(topic).includes("payment")) {
      const payment = await fetchMercadoPagoResource(`/v1/payments/${resourceId}`);
      const paymentId = payment.id?.toString?.() ?? String(resourceId);
      const externalReference = payment.external_reference?.toString?.() || body.external_reference?.toString?.();

      const subscription = externalReference
        ? await prisma.subscription.findUnique({
            where: { companyId: externalReference },
          })
        : await prisma.subscription.findFirst({
            where: {
              OR: [
                { mercadopagoPaymentId: paymentId },
                { mercadopagoPreferenceId: payment.preference_id?.toString?.() ?? undefined },
                { mercadopagoSubscriptionId: payment.preapproval_id?.toString?.() ?? undefined },
              ].filter((item) => Object.values(item).some((value) => value !== undefined)) as any,
            },
          });

      if (subscription) {
        const status = payment.status;

        let subscriptionStatus = "PENDING";
        if (status === "approved") {
          subscriptionStatus = "ACTIVE";
        } else if (status === "rejected" || status === "cancelled" || status === "refunded") {
          subscriptionStatus = "CANCELLED";
        } else if (status === "pending" || status === "in_process" || status === "in_mediation") {
          subscriptionStatus = "PENDING";
        }

        const nextBillingDate = getNextBillingDate(subscription.planType);

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: subscriptionStatus as any,
            mercadopagoPreferenceId: payment.preference_id?.toString?.() ?? subscription.mercadopagoPreferenceId,
            mercadopagoPaymentId: paymentId,
            mercadopagoSubscriptionId:
              payment.preapproval_id?.toString?.() ?? subscription.mercadopagoSubscriptionId,
            nextBillingDate:
              subscriptionStatus === "ACTIVE" ? nextBillingDate : null,
            expiresAt:
              subscriptionStatus === "ACTIVE"
                ? nextBillingDate
                : subscription.expiresAt,
          },
        });

        console.log(`Assinatura ${subscription.id} atualizada para ${subscriptionStatus}`);
      }
    } else if (String(topic).includes("preapproval")) {
      const preapproval = await fetchMercadoPagoResource(`/preapproval/${resourceId}`);
      const externalReference = preapproval.external_reference?.toString?.() || body.external_reference?.toString?.();

      const subscription = externalReference
        ? await prisma.subscription.findUnique({
            where: { companyId: externalReference },
          })
        : await prisma.subscription.findFirst({
            where: {
              mercadopagoSubscriptionId: preapproval.id?.toString?.() ?? String(resourceId),
            },
          });

      if (subscription) {
        let subscriptionStatus = "PENDING";
        if (preapproval.status === "authorized") {
          subscriptionStatus = "ACTIVE";
        } else if (preapproval.status === "cancelled" || preapproval.status === "paused") {
          subscriptionStatus = "CANCELLED";
        }

        const nextBillingDate = getNextBillingDate(subscription.planType);

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: subscriptionStatus as any,
            mercadopagoSubscriptionId: preapproval.id?.toString?.() ?? subscription.mercadopagoSubscriptionId,
            nextBillingDate:
              subscriptionStatus === "ACTIVE" ? nextBillingDate : null,
            expiresAt:
              subscriptionStatus === "ACTIVE"
                ? nextBillingDate
                : subscription.expiresAt,
            autoRenew: subscriptionStatus === "ACTIVE" ? true : subscription.autoRenew,
          },
        });

        console.log(`Assinatura recorrente ${subscription.id} atualizada para ${subscriptionStatus}`);
      }
    }

    // Responder ao MercadoPago
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao processar webhook:", error);
    return NextResponse.json(
      { error: "Erro ao processar webhook" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // MercadoPago às vezes testa com GET
  return NextResponse.json({ status: "webhook ativo" });
}
