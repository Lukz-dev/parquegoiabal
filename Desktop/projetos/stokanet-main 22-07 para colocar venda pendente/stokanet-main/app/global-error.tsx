'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-lg rounded-3xl border border-border bg-card p-8 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-destructive">Erro fatal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">O sistema não conseguiu carregar</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Houve uma falha na renderização da aplicação. Recarregue a página; se persistir, a sessão ou o banco precisa ser verificado.
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
              Ir para login
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}