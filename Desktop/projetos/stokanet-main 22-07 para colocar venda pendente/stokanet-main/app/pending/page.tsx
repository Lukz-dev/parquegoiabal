'use client'

import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { Clock3, LogOut, RefreshCw, ShieldAlert } from 'lucide-react'

export default function PendingPage() {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.12),_transparent_40%)]" />

      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border bg-card/80 backdrop-blur-xl p-8 shadow-2xl shadow-black/10">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-600">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600">Acesso pendente</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Sua conta ainda não foi liberada</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {session?.user?.email ? (
            <>
              A conta <span className="font-medium text-foreground">{session.user.email}</span> está salva no banco de dados, mas ainda aguarda aprovação do administrador.
            </>
          ) : (
            'Seu cadastro está salvo no banco de dados, mas ainda aguarda aprovação do administrador.'
          )}
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 text-primary" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">O que acontece agora</p>
              <p>Quando o acesso for liberado, você poderá entrar normalmente no sistema sem refazer o cadastro.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Link>
        </div>
      </div>
    </div>
  )
}