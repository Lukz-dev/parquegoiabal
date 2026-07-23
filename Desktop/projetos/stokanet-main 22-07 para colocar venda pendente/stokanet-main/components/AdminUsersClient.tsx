'use client'

import { useMemo, useState } from 'react'
import { AdminResetPasswordButton } from '@/components/AdminResetPasswordButton'
import { AdminSubscriptionEditor } from '@/components/AdminSubscriptionEditor'
import { setUserApproval } from '@/lib/admin'

type SubscriptionData = {
  id: string
  status: string | null
  planType?: string | null
  amount?: number | null
  autoRenew?: boolean | null
} | null

type UserItem = {
  id: string
  name?: string | null
  email: string
  companyName?: string | null
  createdAt: string
  isApproved: boolean
  isSystemAdmin: boolean
  role?: string
  subscription: SubscriptionData
}

export default function AdminUsersClient({ users }: { users: UserItem[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      return (
        (u.name ?? '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.companyName ?? '').toLowerCase().includes(q)
      )
    })
  }, [query, users])

  const formatDate = (iso?: string) => {
    if (!iso) return ''
    try {
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  return (
    <div>
      <div className="px-6 py-4 flex items-center gap-4">
        <input
          placeholder="Buscar por nome, email ou empresa"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-md px-3 py-2 rounded border border-border bg-background text-sm"
        />
        <div className="text-sm text-muted-foreground">Resultados: {filtered.length}</div>
      </div>

      <div className="divide-y divide-border">
        {filtered.map((user) => {
          const statusLabel = user.isSystemAdmin ? 'Administrador do sistema' : user.isApproved ? 'Aprovado' : 'Pendente'
          const statusClass = user.isSystemAdmin
            ? 'bg-primary/10 text-primary border-primary/20'
            : user.isApproved
              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-700 border-amber-500/20'

          return (
            <div key={user.id} data-testid={`admin-user-row-${user.email}`} className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_0.9fr_0.8fr_0.9fr_auto] md:items-start">
              <div>
                <p className="font-semibold text-foreground">{user.name ?? 'Sem nome'}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{user.companyName ?? 'Sem empresa'}</p>
                <p>{formatDate(user.createdAt)}</p>
              </div>

              <div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClass}`}>
                  {statusLabel}
                </span>
              </div>

              <div>
                <AdminSubscriptionEditor userId={user.id} userEmail={user.email} subscription={user.subscription as any} userActivePlan={(user as any).activePlan ?? null} />
              </div>

              <div className="flex justify-start md:justify-end">
                <div className="flex flex-col gap-2">
                  {user.isSystemAdmin ? (
                    <span className="text-xs text-muted-foreground">Protegido</span>
                  ) : (
                    <form action={setUserApproval.bind(null, user.id, !user.isApproved)}>
                      <button
                        type="submit"
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${user.isApproved ? 'bg-rose-500/10 text-rose-700 hover:bg-rose-500/20' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                      >
                        {user.isApproved ? 'Revogar acesso' : 'Liberar acesso'}
                      </button>
                    </form>
                  )}

                  {!user.isSystemAdmin && (
                    <AdminResetPasswordButton userId={user.id} userEmail={user.email} />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
