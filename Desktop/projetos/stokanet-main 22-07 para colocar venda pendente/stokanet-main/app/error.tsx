'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-lg rounded-3xl border border-border bg-card p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-destructive">Erro ao carregar</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Não foi possível abrir esta página</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          O sistema encontrou um problema ao carregar sua conta. Tente recarregar a página; se o erro continuar, é preciso verificar a sessão ou o banco de dados.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Recarregar
          </button>
          <Link
            href="/login"
            className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  )
}