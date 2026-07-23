'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { Pencil, X } from 'lucide-react'
import { updateSale } from '@/lib/actions'

type SaleItem = {
  id: string
  productName: string
  sku: string
  quantity: number
  unitPrice: number
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
  nfeStatus: string
  createdAt: string
  items: SaleItem[]
}

type Props = {
  sale: Sale
  onClose: () => void
  onSuccess: () => void
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function SaleEditModal({ sale, onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [paymentMethod, setPaymentMethod] = useState(sale.paymentMethod ?? '')
  const [discount, setDiscount] = useState(String(sale.discount ?? 0))
  const [notes, setNotes] = useState(sale.notes ?? '')
  const [items, setItems] = useState(
    sale.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      sku: item.sku,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })),
  )

  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + toNumber(item.quantity) * toNumber(item.unitPrice), 0)
  }, [items])

  const discountValue = Math.min(Math.max(0, toNumber(discount)), subtotal)
  const total = Math.max(0, subtotal - discountValue)

  const handleChangeItem = (index: number, field: 'productName' | 'sku' | 'quantity' | 'unitPrice', value: string) => {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')

    startTransition(async () => {
      try {
        await updateSale({
          saleId: sale.id,
          paymentMethod,
          discount: discountValue,
          notes,
          items: items.map((item) => ({
            id: item.id,
            productName: item.productName,
            sku: item.sku,
            quantity: Math.max(1, Math.floor(toNumber(item.quantity))),
            unitPrice: Math.max(0, toNumber(item.unitPrice)),
          })),
        })
        onSuccess()
      } catch (currentError: any) {
        setError(currentError?.message || 'Não foi possível editar a venda.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Editar venda {sale.code}</h2>
              <p className="text-xs text-muted-foreground">Edite pagamento, desconto, observações e os itens da venda.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          {error ? <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">{error}</p> : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Forma de pagamento
              <input
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                placeholder="PIX, dinheiro, cartão..."
                className="px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Desconto (R$)
              <input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                className="px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <div className="flex flex-col gap-2 text-sm font-medium">
              <span>Resumo</span>
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-sm">
                <div>Subtotal: {formatCurrency(subtotal)}</div>
                <div>Desconto: {formatCurrency(discountValue)}</div>
                <div className="font-semibold">Total: {formatCurrency(total)}</div>
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Observações
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20 text-sm font-semibold">Itens da venda</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left p-3 font-medium">Produto</th>
                    <th className="text-left p-3 font-medium">SKU</th>
                    <th className="text-right p-3 font-medium">Qtd</th>
                    <th className="text-right p-3 font-medium">Unitário</th>
                    <th className="text-right p-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const itemTotal = toNumber(item.quantity) * toNumber(item.unitPrice)
                    return (
                      <tr key={item.id} className="border-b last:border-b-0 border-border/60">
                        <td className="p-3 min-w-56">
                          <input
                            value={item.productName}
                            onChange={(event) => handleChangeItem(index, 'productName', event.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                          />
                        </td>
                        <td className="p-3 min-w-40">
                          <input
                            value={item.sku}
                            onChange={(event) => handleChangeItem(index, 'sku', event.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                          />
                        </td>
                        <td className="p-3 w-28">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(event) => handleChangeItem(index, 'quantity', event.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-right outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                          />
                        </td>
                        <td className="p-3 w-36">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(event) => handleChangeItem(index, 'unitPrice', event.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-right outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                          />
                        </td>
                        <td className="p-3 w-36 text-right font-medium">{formatCurrency(itemTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {isPending ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
