import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { PlansClient } from "@/components/PlansClient";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function PlansPage({
  searchParams,
}: {
  searchParams?: Promise<{ source?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { isSystemAdmin?: boolean } | undefined;

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (sessionUser?.isSystemAdmin === true) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { company: true },
  });

  if (!user?.companyId) {
    redirect("/signup");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const checkoutAfterSignup = cookieStore.get("stokanet.checkout_after_signup")?.value === "1";
  const allowedSource = resolvedSearchParams?.source === "signup" || resolvedSearchParams?.source === "manage";

  if (!checkoutAfterSignup && !allowedSource) {
    redirect("/subscription");
  }

  const subscription = await prisma.subscription.findUnique({
    where: { companyId: user.companyId },
  });

  const hasActiveSubscription = subscription?.status === "ACTIVE";

  return (
    <PlansClient
      hasActiveSubscription={hasActiveSubscription}
    />
  );
}
