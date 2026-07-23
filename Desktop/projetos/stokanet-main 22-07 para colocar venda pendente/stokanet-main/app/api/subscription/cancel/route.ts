import { NextRequest, NextResponse } from "next/server";
import { getActiveCompanyId } from "@/lib/access";
import prisma from "@/lib/prisma";

function getMercadoPagoAccessToken() {
  return (
    process.env.MERCADOPAGO_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    ""
  );
}

async function cancelMercadoPagoPreapproval(preapprovalId: string) {
  const accessToken = getMercadoPagoAccessToken();
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  }

  const response = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "cancelled" }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao cancelar recorrência no MercadoPago (${response.status}): ${body}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await getActiveCompanyId();
    const currentSubscription = await prisma.subscription.findUnique({
      where: { companyId },
    });

    if (!currentSubscription) {
      return NextResponse.redirect(new URL("/subscription", request.url));
    }

    if (currentSubscription.billingMode === "RECURRING" && currentSubscription.mercadopagoSubscriptionId) {
      await cancelMercadoPagoPreapproval(currentSubscription.mercadopagoSubscriptionId);
    }

    await prisma.subscription.update({
      where: { companyId },
      data: {
        status: "CANCELLED",
        autoRenew: false,
        cancelledAt: new Date(),
        expiresAt: new Date(),
      },
    });

    return NextResponse.redirect(new URL("/subscription", request.url));
  } catch (error) {
    console.error("Erro ao cancelar assinatura:", error);
    return NextResponse.json(
      { error: "Não foi possível cancelar a assinatura" },
      { status: 500 }
    );
  }
}