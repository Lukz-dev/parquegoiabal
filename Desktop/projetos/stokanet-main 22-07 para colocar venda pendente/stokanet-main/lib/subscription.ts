import prisma from "@/lib/prisma";

export async function getSubscriptionStatus(companyId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { companyId },
  });

  if (!subscription) {
    return {
      status: "NO_SUBSCRIPTION",
      isActive: false,
      planType: null,
      nextBillingDate: null,
    };
  }

  const now = new Date();
  const isExpired = subscription.expiresAt && now > subscription.expiresAt;

  if (isExpired && subscription.status === "ACTIVE") {
    await prisma.subscription.update({
      where: { companyId },
      data: {
        status: "EXPIRED",
        autoRenew: false,
      },
    });
  }

  return {
    status: isExpired && subscription.status === "ACTIVE" ? "EXPIRED" : subscription.status,
    isActive: subscription.status === "ACTIVE" && !isExpired,
    planType: subscription.planType,
    billingMode: subscription.billingMode,
    nextBillingDate: subscription.nextBillingDate,
    cancelledAt: subscription.cancelledAt,
    expiresAt: subscription.expiresAt,
  };
}

export async function requireActiveSubscription(companyId: string) {
  const subscription = await getSubscriptionStatus(companyId);

  if (!subscription.isActive) {
    throw new Error("Assinatura não ativa. Por favor, contrate um plano.");
  }

  return subscription;
}

export async function getSubscriptionInfo(companyId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { companyId },
  });

  if (!subscription) {
    return null;
  }

  return {
    id: subscription.id,
    planType: subscription.planType,
    billingMode: subscription.billingMode,
    status: subscription.status,
    amount: subscription.amount,
    nextBillingDate: subscription.nextBillingDate,
    cancelledAt: subscription.cancelledAt,
    expiresAt: subscription.expiresAt,
    autoRenew: subscription.autoRenew,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}
