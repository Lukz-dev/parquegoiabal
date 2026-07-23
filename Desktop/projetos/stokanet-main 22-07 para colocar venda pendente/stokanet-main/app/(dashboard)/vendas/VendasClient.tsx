'use client'

import { useMemo, useState, useTransition } from 'react'
import { Ban, Pencil, Receipt, Search } from 'lucide-react'
import { cancelSale, completePendingSale } from '@/lib/actions'
import { useRouter } from 'next/navigation'
import { SaleEditModal } from '@/components/SaleEditModal'

type SaleItem = {
  id: string
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  unitCost: number
  total: number
}

type Sale = {
  id: string
  code: string
  subtotal: number
  discount: number
  total: number
  paymentMethod: string | null
  notes: string | null
  details: string | null
  isPending: boolean
  nfeStatus: string
  createdAt: string
  items: SaleItem[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function paymentLabel(paymentMethod: string | null) {
  const normalized = (paymentMethod ?? '').trim().toUpperCase()
  if (!normalized) return 'Não informado'

  const labels: Record<string, string> = {
    PIX: 'PIX',
    DINHEIRO: 'Dinheiro',
    CASH: 'Dinheiro',
    CARTAO_CREDITO: 'Cartão de crédito',
    CREDIT_CARD: 'Cartão de crédito',
    CARTAO_DEBITO: 'Cartão de débito',
    DEBIT_CARD: 'Cartão de débito',
  }

  return labels[normalized] ?? paymentMethod ?? 'Não informado'
}

function isCancelled(notes: string | null) {
  if (!notes) return false
  return notes.includes('[CANCELADA]')
}

export function VendasClient({ initialSales }: { initialSales: Sale[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return initialSales

    return initialSales.filter((sale) => {
      return (
        sale.code.toLowerCase().includes(q) ||
        (sale.paymentMethod ?? '').toLowerCase().includes(q) ||
        (sale.details ?? '').toLowerCase().includes(q) ||
        sale.items.some((item) => item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q))
      )
    })
  }, [initialSales, search])

  const saleCost = (sale: Sale) => sale.items.reduce((acc, item) => acc + item.quantity * item.unitCost, 0)
  const saleGrossProfit = (sale: Sale) => sale.total - saleCost(sale)
  const saleGrossMargin = (sale: Sale) => (sale.total > 0 ? (saleGrossProfit(sale) / sale.total) * 100 : 0)
  const editingSaleCode = editingSale?.code ?? ''

  const handleCancel = (sale: Sale) => {
    setError('')
    setFeedback('')

    startTransition(async () => {
      try {
        await cancelSale({ saleId: sale.id, reason: cancelReason })
        setFeedback(`Venda ${sale.code} cancelada com sucesso.`)
        router.refresh()
      } catch (currentError: any) {
        setError(currentError?.message || 'Não foi possível cancelar a venda.')
      }
    })
  }

  const handleCompletePending = (sale: Sale) => {
    setError('')
    setFeedback('')

    startTransition(async () => {
      try {
        await completePendingSale({ saleId: sale.id })
        setFeedback(`Venda ${sale.code} concluída com sucesso.`)
        router.refresh()
      } catch (currentError: any) {
        setError(currentError?.message || 'Não foi possível concluir a venda pendente.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendas realizadas</h1>
          <p className="text-muted-foreground mt-1">Consulte detalhes de cada venda e cancele quando permitido.</p>
        </div>
        <a
          href="/api/export/sales"
          className="border border-border hover:bg-muted text-foreground px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors"
        >
          Exportar CSV
        </a>
      </div>

      {error && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">{error}</p>}
      {feedback && <p className="text-sm text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">{feedback}</p>}

      <section className="border border-border rounded-xl bg-card p-4 md:p-5 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 flex items-center bg-background rounded-lg px-3 py-2 border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por código, forma de pagamento, produto ou SKU..."
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground"
            />
          </div>
          <input
            type="text"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Motivo padrão para cancelamento (opcional)"
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </section>

      <section className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-medium">Vendas encontradas ({filteredSales.length})</div>
        <div className="divide-y divide-border">
          {filteredSales.length === 0 ? (
            <div className="px-4 py-10 text-center text-muted-foreground">
              <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma venda encontrada para o filtro atual.</p>
            </div>
          ) : filteredSales.map((sale) => {
            const cancelled = isCancelled(sale.notes)
            const canCancel = !cancelled && sale.nfeStatus !== 'AUTORIZADO'

            return (
              <article key={sale.id} className={`p-4 ${sale.isPending ? 'bg-red-500/5' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{sale.code}</p>
                      {sale.isPending ? <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-700">Venda pendente</span> : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(sale.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pagamento: {paymentLabel(sale.paymentMethod)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">NF-e: {sale.nfeStatus}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">{formatCurrency(sale.total)}</p>
                    {sale.discount > 0 ? (
                      <p className="text-xs text-muted-foreground">Desconto: {formatCurrency(sale.discount)}</p>
                    ) : null}
                  </div>
                </div>

                {!cancelled ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                      <p className="text-muted-foreground text-xs">Custo</p>
                      <p className="font-semibold">{formatCurrency(saleCost(sale))}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                      <p className="text-muted-foreground text-xs">Lucro bruto</p>
                      <p className="font-semibold">{formatCurrency(saleGrossProfit(sale))}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                      <p className="text-muted-foreground text-xs">Margem bruta</p>
                      <p className="font-semibold">{saleGrossMargin(sale).toFixed(1)}%</p>
                    </div>
                  </div>
                ) : null}

                <details className="mt-3 rounded-lg border border-border/70 bg-muted/20">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">Ver detalhes dos itens ({sale.items.length})</summary>
                  <div className="px-3 pb-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-muted-foreground border-b border-border/70">
                          <tr>
                            <th className="text-left py-2 font-medium">Produto</th>
                            <th className="text-left py-2 font-medium">SKU</th>
                            <th className="text-right py-2 font-medium">Qtd</th>
                            <th className="text-right py-2 font-medium">Unitário</th>
                            <th className="text-right py-2 font-medium">Custo</th>
                            <th className="text-right py-2 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sale.items.map((item) => (
                            <tr key={item.id} className="border-b last:border-b-0 border-border/50">
                              <td className="py-2 pr-2">{item.productName}</td>
                              <td className="py-2 pr-2 text-muted-foreground font-mono text-xs">{item.sku}</td>
                              <td className="py-2 text-right">{item.quantity}</td>
                              <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                              <td className="py-2 text-right">{formatCurrency(item.unitCost)}</td>
                              <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>

                {sale.notes ? (
                  <p className="text-xs text-muted-foreground mt-3 whitespace-pre-line">Observações: {sale.notes}</p>
                ) : null}

                {sale.details ? (
                  <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line">Detalhes: {sale.details}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSale(sale)}
                    disabled={isPending || cancelled || sale.nfeStatus === 'AUTORIZADO'}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar venda
                  </button>
                  {sale.isPending ? (
                    <button
                      type="button"
                      onClick={() => handleCompletePending(sale)}
                      disabled={isPending || cancelled}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-sm font-semibold hover:bg-emerald-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Receipt className="w-3.5 h-3.5" /> Concluir venda
                    </button>
                  ) : null}

                  {cancelled ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-destructive/10 text-destructive">
                      <Ban className="w-3.5 h-3.5" /> Venda cancelada
                    </span>
                  ) : sale.nfeStatus === 'AUTORIZADO' ? (
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-muted text-muted-foreground">
                      NF-e autorizada: cancelamento bloqueado
                    </span>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => handleCancel(sale)}
                    disabled={isPending || !canCancel}
                    className="px-3 py-2 rounded-lg border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sale.isPending ? 'Cancelar pendente' : 'Cancelar venda'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {editingSale ? (
        <SaleEditModal
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSuccess={() => {
            setEditingSale(null)
            setFeedback(`Venda ${editingSaleCode} atualizada com sucesso.`)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}
