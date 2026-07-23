import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { getSubscriptionInfo } from "@/lib/subscription";

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function SubscriptionPage() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { isSystemAdmin?: boolean } | undefined;

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (sessionUser?.isSystemAdmin === true) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assinatura</h1>
          <p className="mt-2 text-muted-foreground">
            Conta administrativa do sistema isenta de cobrança.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 shadow-sm">
          <p className="text-sm text-emerald-800">
            Você está autenticado como administrador do sistema. O checkout e a cobrança de planos não se aplicam a esta conta.
          </p>
          <div className="mt-4">
            <Link
              href="/admin"
              className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Ir para o painel admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { company: true },
  });

  if (!user?.companyId) {
    redirect("/signup");
  }

  const subscription = await getSubscriptionInfo(user.companyId);

  if (!subscription) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assinatura</h1>
          <p className="mt-2 text-muted-foreground">
            Sua empresa ainda não possui uma assinatura ativa.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Escolha um plano para liberar o acesso ao sistema.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/plans?source=manage"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Ver planos
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Voltar ao painel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isRecurring = subscription.billingMode === "RECURRING";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assinatura</h1>
          <p className="mt-2 text-muted-foreground">
            Acompanhe o ciclo do plano, o status atual e as próximas cobranças.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/plans?source=manage"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Trocar plano
          </Link>
          {subscription.status === 'ACTIVE' && (
            <Link
              href="/"
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Voltar ao sistema
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Plano atual</p>
              <h2 className="mt-1 text-2xl font-bold">
                {subscription.planType === "MONTHLY" ? "Mensal" : "Anual"}
              </h2>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {subscription.status}
            </span>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Valor</dt>
              <dd className="mt-1 text-lg font-semibold">R$ {subscription.amount.toFixed(2)}</dd>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Modo de cobrança</dt>
              <dd className="mt-1 text-lg font-semibold">
                {isRecurring ? "Recorrente" : "Cobrança única"}
              </dd>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Próxima cobrança</dt>
              <dd className="mt-1 text-lg font-semibold">{formatDate(subscription.nextBillingDate)}</dd>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Expira em</dt>
              <dd className="mt-1 text-lg font-semibold">{formatDate(subscription.expiresAt)}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/plans?source=manage"
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
            >
              Renovar ou trocar plano
            </Link>
            <form action="/api/subscription/cancel" method="post">
              <button
                type="submit"
                className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-600"
              >
                Cancelar assinatura
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Resumo</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>Status atual: <span className="font-medium text-foreground">{subscription.status}</span></li>
            <li>Renovação automática: <span className="font-medium text-foreground">{subscription.autoRenew ? "Ativa" : "Desativada"}</span></li>
            <li>Cancelada em: <span className="font-medium text-foreground">{formatDate(subscription.cancelledAt)}</span></li>
            <li>ID interno: <span className="font-mono text-xs text-foreground">{subscription.id}</span></li>
          </ul>

          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-900">
            {isRecurring
              ? "A renovação recorrente está marcada no cadastro. Para cobrança automática real no cartão, a próxima etapa é registrar o cartão em um perfil de pagamento do MercadoPago e processar as orders recorrentes pelo webhook/cron."
              : "Esse plano está em cobrança única. Para voltar a cobrar automaticamente, reative no checkout e selecione recorrente."}
          </div>
        </div>
      </div>
    </div>
  );
}