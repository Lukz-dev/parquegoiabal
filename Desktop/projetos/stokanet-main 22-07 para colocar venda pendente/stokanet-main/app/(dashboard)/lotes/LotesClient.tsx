'use client'

import { useState, useTransition } from 'react'
import { createBatch } from '@/lib/actions'

type Product = { id: string; name: string; sku: string }
type Batch = {
  id: string
  code: string
  quantity: number
  expiresAt: string
  product: { id: string; name: string; sku: string }
}

export function LotesClient({ initialBatches, products }: { initialBatches: Batch[]; products: Product[] }) {
  const [batches, setBatches] = useState(initialBatches)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const [form, setForm] = useState({
    productId: products[0]?.id ?? '',
    code: '',
    quantity: 1,
    expiresAt: '',
    notes: '',
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    startTransition(async () => {
      try {
        const created = await createBatch(form)
        const product = products.find((p) => p.id === form.productId)
        const newBatch: Batch = {
          id: (created as any).id,
          code: (created as any).code,
          quantity: (created as any).quantity,
          expiresAt: String((created as any).expiresAt),
          product: {
            id: product?.id || form.productId,
            name: product?.name || 'Produto',
            sku: product?.sku || '-',
          },
        }
        setBatches((prev) => [newBatch, ...prev])
        setForm((prev) => ({ ...prev, code: '', quantity: 1, expiresAt: '', notes: '' }))
        setMessage('Lote criado e estoque atualizado.')
      } catch (error: any) {
        setMessage(error?.message || 'Nao foi possivel criar lote.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lotes e Validades</h1>
          <p className="text-sm text-muted-foreground">Controle de vencimento para reduzir perdas.</p>
        </div>
        <a
          href="/api/export/batches"
          className="border border-border hover:bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Exportar lotes CSV
        </a>
      </div>

      <form onSubmit={handleCreate} className="border border-border rounded-xl bg-card p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <select value={form.productId} onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          {products.map((product) => (
            <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>
          ))}
        </select>
        <input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder="Codigo do lote" className="h-10 rounded-md border border-input bg-background px-3 text-sm" required />
        <input type="number" min={1} value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value) }))} className="h-10 rounded-md border border-input bg-background px-3 text-sm" required />
        <input type="date" value={form.expiresAt} onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} className="h-10 rounded-md border border-input bg-background px-3 text-sm" required />
        <button disabled={isPending} className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">Criar lote</button>
        <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Observacoes" className="md:col-span-5 min-h-[84px] rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </form>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="px-4 py-3 border-b border-border text-sm font-medium">Lotes cadastrados ({batches.length})</div>
        <div className="divide-y divide-border">
          {batches.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum lote cadastrado.</div>
          ) : (
            batches.map((batch) => (
              <div key={batch.id} className="p-4 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <div className="font-medium">{batch.code} - {batch.product.name}</div>
                  <div className="text-muted-foreground">SKU {batch.product.sku} | Quantidade {batch.quantity}</div>
                </div>
                <div className="text-xs px-2 py-1 rounded-full border border-border">Validade: {new Date(batch.expiresAt).toLocaleDateString('pt-BR')}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
