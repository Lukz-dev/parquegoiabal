import { getAdminUsers, setUserApproval } from '@/lib/admin'
import AdminUsersClient from '@/components/AdminUsersClient'
import { AdminResetPasswordButton } from '@/components/AdminResetPasswordButton'
import { AdminSubscriptionEditor } from '@/components/AdminSubscriptionEditor'
import prisma from '@/lib/prisma'

type AdminUser = Awaited<ReturnType<typeof getAdminUsers>>[number]

const formatDate = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export default async function AdminPage() {
  const users: AdminUser[] = await getAdminUsers()

  const usersWithSubscriptions = await Promise.all(
    users.map(async (user) => {
      if (!user.companyId) {
        return { ...user, subscription: null }
      }
      const subscription = await prisma.subscription.findUnique({
        where: { companyId: user.companyId },
      })
      return {
        ...user,
        subscription: subscription || null,
      }
    })
  )

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Painel restrito</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Aprovação de contas</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Libere ou revogue o acesso dos cadastros que chegam pelo site. Contas sem aprovação ficam bloqueadas fora do painel de espera.
        </p>
        <p className="text-xs text-muted-foreground max-w-2xl">
          Por segurança, a senha armazenada não pode ser exibida. Quando necessário, o administrador pode redefinir a senha e receber uma senha temporária.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total de contas</p>
          <p className="mt-2 text-3xl font-bold">{users.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Aprovadas</p>
          <p className="mt-2 text-3xl font-bold">{users.filter((user: AdminUser) => user.isApproved).length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Pendentes</p>
          <p className="mt-2 text-3xl font-bold">{users.filter((user: AdminUser) => !user.isApproved && !user.isSystemAdmin).length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Contas cadastradas</h2>
        </div>

          <div>
            {/* Client-side users list with search */}
            <AdminUsersClient
              users={usersWithSubscriptions.map((u) => ({
                id: u.id,
                name: u.name ?? null,
                email: u.email,
                companyName: u.company?.name ?? null,
                createdAt: u.createdAt.toISOString(),
                isApproved: u.isApproved,
                isSystemAdmin: u.isSystemAdmin,
                role: u.role,
                subscription: u.subscription
                  ? {
                      id: u.subscription.id,
                      status: u.subscription.status,
                      planType: u.subscription.planType,
                      amount: u.subscription.amount,
                      autoRenew: u.subscription.autoRenew,
                    }
                  : null,
                activePlan: (u as any).activePlan ?? null,
              }))}
            />
          </div>
      </div>
    </div>
  )
}