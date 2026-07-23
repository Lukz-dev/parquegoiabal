'use client'

import { useState, useTransition } from 'react'
import { X, ArrowUpCircle, ArrowDownCircle, SlidersHorizontal, AlertCircle } from 'lucide-react'
import { createMovement } from '@/lib/actions'

interface Product { id: string; name: string; sku: string; size: string | null; color: string | null; stockQty: number }

interface Props {
  products: Product[]
  defaultProductId?: string
  onClose: () => void
  onSuccess: () => void
}

const TYPE_OPTIONS = [
  { value: 'ENTRADA', label: 'Entrada', icon: ArrowUpCircle, color: 'text-emerald-500' },
  { value: 'SAIDA', label: 'Saída', icon: ArrowDownCircle, color: 'text-destructive' },
  { value: 'AJUSTE', label: 'Ajuste', icon: SlidersHorizontal, color: 'text-amber-500' },
]

export function MovementModal({ products, defaultProductId, onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [type, setType] = useState<'ENTRADA' | 'SAIDA' | 'AJUSTE'>('ENTRADA')
  const [form, setForm] = useState({
    productId: defaultProductId ?? '',
    quantity: '',
    reason: '',
  })

  const selectedProduct = products.find(p => p.id === form.productId)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.productId) { setError('Selecione um produto.'); return }
    if (!form.quantity || Number(form.quantity) <= 0) { setError('Quantidade deve ser maior que zero.'); return }

    startTransition(async () => {
      try {
        await createMovement({
          productId: form.productId,
          type,
          quantity: parseInt(form.quantity),
          reason: form.reason || undefined,
        })
        onSuccess()
        onClose()
      } catch (err: any) {
        setError(err.message || 'Erro ao registrar movimentação.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-semibold text-lg">Nova movimentação</h2>
            <p className="text-xs text-muted-foreground">Registre entrada, saída ou ajuste dos produtos</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tipo de movimentação */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Tipo de movimentação</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(opt => {
                const Icon = opt.icon
                const isSelected = type === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value as any)}
                    className={`flex flex-col items-center gap-2 py-3 px-2 rounded-xl border text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? opt.color : 'text-muted-foreground'}`} />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Produto */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Produto</label>
            <select
              id="mov-product"
              name="productId"
              value={form.productId}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="">Selecione um produto...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.size ? ` • ${p.size}` : ''}{p.color ? ` • ${p.color}` : ''} — {p.sku}
                </option>
              ))}
            </select>
            {selectedProduct && (
              <p className="text-xs text-muted-foreground px-1">
                Estoque atual: <span className="font-semibold text-foreground">{selectedProduct.stockQty} und(s)</span>
                {selectedProduct.size && <span className="ml-2">• Var. {selectedProduct.size}</span>}
                {selectedProduct.color && <span className="ml-2">• Cor {selectedProduct.color}</span>}
              </p>
            )}
          </div>

          {/* Quantidade */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              {type === 'AJUSTE' ? 'Novo total em estoque' : 'Quantidade'}
            </label>
            <input
              id="mov-quantity"
              name="quantity"
              type="number"
              min="1"
              required
              value={form.quantity}
              onChange={handleChange}
              placeholder={type === 'AJUSTE' ? 'Novo total em estoque' : 'Ex: 10'}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Motivo */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Motivo <span className="text-muted-foreground font-normal">(opcional)</span></label>
            <input
              id="mov-reason"
              name="reason"
              type="text"
              value={form.reason}
              onChange={handleChange}
              placeholder="Ex: reposição, venda, transferência entre unidades..."
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button
              id="mov-submit"
              type="submit"
              disabled={isPending}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 shadow-lg ${
                type === 'ENTRADA' ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/25' :
                type === 'SAIDA' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-destructive/25' :
                'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/25'
              }`}
            >
              {isPending ? 'Registrando...' : `Registrar ${type === 'ENTRADA' ? 'Entrada' : type === 'SAIDA' ? 'Saída' : 'Ajuste'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
