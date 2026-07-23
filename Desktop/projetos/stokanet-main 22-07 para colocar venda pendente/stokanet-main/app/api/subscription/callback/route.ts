import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const preferenceId = searchParams.get("preference_id");
    const preapprovalId = searchParams.get("preapproval_id");
    const paymentId = searchParams.get("payment_id");
    const externalReference = searchParams.get("external_reference");

    if (!externalReference) {
      return NextResponse.redirect(new URL("/plans/failure", request.url));
    }

    const subscription = await prisma.subscription.findUnique({
      where: { companyId: externalReference },
    });

    if (subscription) {
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(
        nextBillingDate.getMonth() + (subscription.planType === "MONTHLY" ? 1 : 12)
      );

      const mpReferenceId = preferenceId || preapprovalId || paymentId;

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          mercadopagoPreferenceId:
            subscription.billingMode === "RECURRING" ? subscription.mercadopagoPreferenceId : preferenceId,
          mercadopagoSubscriptionId:
            subscription.billingMode === "RECURRING"
              ? preapprovalId || subscription.mercadopagoSubscriptionId
              : subscription.mercadopagoSubscriptionId,
          mercadopagoPaymentId:
            subscription.billingMode === "RECURRING" ? paymentId || subscription.mercadopagoPaymentId : mpReferenceId,
          nextBillingDate,
          expiresAt: nextBillingDate,
        },
      });
    }

    return NextResponse.redirect(new URL("/plans/success", request.url));
  } catch (error) {
    console.error("Erro ao processar retorno:", error);
    return NextResponse.redirect(new URL("/plans/failure", request.url));
  }
}
