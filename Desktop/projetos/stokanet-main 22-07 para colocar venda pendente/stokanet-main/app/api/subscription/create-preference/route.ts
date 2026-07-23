import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { createPreference, formatMercadoPagoError, getMercadoPagoPayerEmail, PLANS } from "@/lib/mercadopago";

export async function POST(request: NextRequest) {
  try {
    const requestOrigin = new URL(request.url).origin;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const { planId, billingMode = "ONE_TIME" } = await request.json();

    if (!planId || !Object.keys(PLANS).includes(planId)) {
      return NextResponse.json(
        { error: "Plano inválido" },
        { status: 400 }
      );
    }

    if (!["ONE_TIME", "RECURRING"].includes(billingMode)) {
      return NextResponse.json(
        { error: "Modo de cobrança inválido" },
        { status: 400 }
      );
    }

    // Buscar usuário e sua empresa
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { company: true },
    });

    if (!user?.companyId || !user.company) {
      return NextResponse.json(
        { error: "Empresa não encontrada" },
        { status: 400 }
      );
    }

    // Verificar se já tem assinatura ativa
    const existingSubscription = await prisma.subscription.findUnique({
      where: { companyId: user.companyId },
    });

    if (existingSubscription?.status === "ACTIVE") {
      return NextResponse.json(
        { error: "Empresa já possui uma assinatura ativa" },
        { status: 400 }
      );
    }

    // Criar preferência no MercadoPago
    const preference = await createPreference(
      planId as keyof typeof PLANS,
      user.companyId,
      user.company.name,
      getMercadoPagoPayerEmail(session.user.email),
      requestOrigin,
      billingMode
    );

    const planType: "MONTHLY" | "ANNUAL" = planId === "MONTHLY" ? "MONTHLY" : "ANNUAL";
    const billingModeValue: "ONE_TIME" | "RECURRING" = billingMode;
    const preferenceId = String(preference.id ?? "");
    const subscriptionId = String(preference.id ?? "");
    const isRecurring = billingModeValue === "RECURRING";
    const subscriptionData: {
      companyId: string;
      planType: "MONTHLY" | "ANNUAL";
      billingMode: "ONE_TIME" | "RECURRING";
      amount: number;
      status: "PENDING";
      autoRenew: boolean;
      mercadopagoPreferenceId: string | null;
      mercadopagoSubscriptionId: string | null;
      mercadopagoPaymentId: string | null;
    } = {
      companyId: user.companyId,
      planType,
      billingMode: billingModeValue,
      amount: PLANS[planId as keyof typeof PLANS].price,
      status: "PENDING" as const,
      autoRenew: isRecurring,
      mercadopagoPreferenceId: isRecurring ? null : preferenceId,
      mercadopagoSubscriptionId: isRecurring ? subscriptionId : null,
      mercadopagoPaymentId: null,
    };

    // Salvar referência da preferência no BD
    if (!existingSubscription) {
      await prisma.subscription.create({
        data: subscriptionData,
      });
    } else {
      await prisma.subscription.update({
        where: { companyId: user.companyId },
        data: subscriptionData,
      });
    }

    return NextResponse.json({
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point ?? preference.init_point,
    });
  } catch (error) {
    console.error("Erro ao criar preferência:", formatMercadoPagoError(error));
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message
            ? error.message
            : "Erro interno do servidor",
      },
      { status: 500 }
    );
  }
}
