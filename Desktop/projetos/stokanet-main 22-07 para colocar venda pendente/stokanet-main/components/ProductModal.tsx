'use client'

import { useState, useTransition } from 'react'
import { X, Package, Tag, DollarSign, Hash, Layers, Plus } from 'lucide-react'
import { createProduct, createCategory } from '@/lib/actions'

interface Category {
  id: string
  name: string
}

interface Props {
  categories: Category[]
  defaultMinStock: number
  existingProducts: Array<{ id: string; sku: string }>
  onClose: () => void
  onSuccess: () => void
}

function normalizeSku(sku: string) {
  return sku.trim()
}

export function ProductModal({ categories, defaultMinStock, existingProducts, onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isCreatingCategory, startCategoryTransition] = useTransition()
  const [error, setError] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [form, setForm] = useState({
    name: '',
    sku: '',
    ncm: '',
    cfop: '',
    cest: '',
    size: '',
    color: '',
    purchaseCost: '',
    price: '',
    stockQty: '',
    minStock: String(defaultMinStock ?? 5),
    categoryId: '',
    isBox: false,
    unitsPerBox: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement
    if (type === 'checkbox') {
      setForm({ ...form, [name]: (e.target as HTMLInputElement).checked })
      return
    }
    setForm({ ...form, [name]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const normalizedSku = normalizeSku(form.sku)
    const duplicateExists = existingProducts.some((product) => normalizeSku(product.sku) === normalizedSku)

    if (duplicateExists) {
      setError(`Não foi possível salvar: o código "${normalizedSku}" já está cadastrado em outro produto. Informe um código diferente.`)
      return
    }

    startTransition(async () => {
      try {
        await createProduct({
          name: form.name,
          sku: form.sku,
          ncm: form.ncm || undefined,
          cfop: form.cfop || undefined,
          cest: form.cest || undefined,
          size: form.size || undefined,
          color: form.color || undefined,
          purchaseCost: parseFloat(form.purchaseCost) || 0,
          price: parseFloat(form.price),
          stockQty: parseInt(form.stockQty),
          isBox: Boolean(form.isBox),
          unitsPerBox: form.unitsPerBox ? parseInt(form.unitsPerBox) : null,
          minStock: parseInt(form.minStock),
          categoryId: form.categoryId || undefined,
        })
        onSuccess()
        onClose()
      } catch (err: any) {
        const message = err?.message || ''
        if (message.includes('An error occurred in the Server Components render')) {
          setError(`Não foi possível salvar: o código "${normalizedSku}" já está cadastrado em outro produto. Informe um código diferente.`)
          return
        }
        setError(message || 'Erro ao criar produto.')
      }
    })
  }

  const handleCreateCategory = () => {
    const categoryName = newCategoryName.trim()
    if (!categoryName) {
      setError('Informe o nome da categoria.')
      return
    }

    setError('')
    startCategoryTransition(async () => {
      try {
        const category = await createCategory(categoryName)
        setForm(current => ({ ...current, categoryId: category.id }))
        setNewCategoryName('')
        onSuccess()
      } catch (err: any) {
        setError(err.message || 'Erro ao criar categoria.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Novo Produto</h2>
              <p className="text-xs text-muted-foreground">Cadastre o item com SKU, preço e ponto de reposição</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">{error}</p>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Nome do produto</label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                id="prod-name"
                name="name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="Ex: Suporte metálico para parede"
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">SKU / Código interno</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="prod-sku"
                  name="sku"
                  required
                  value={form.sku}
                  onChange={handleChange}
                  placeholder="CAM-001"
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Valor de compra (R$)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="prod-purchase-cost"
                  name="purchaseCost"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.purchaseCost}
                  onChange={handleChange}
                  placeholder="0,00"
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Preço (R$)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="prod-price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.price}
                  onChange={handleChange}
                  placeholder="0,00"
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Preço de compra (R$) - opcional</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  name="purchaseCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.purchaseCost}
                  onChange={handleChange}
                  placeholder="0,00"
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Estoque mínimo</label>
              <div className="relative">
                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  name="minStock"
                  type="number"
                  min="0"
                  required
                  value={form.minStock}
                  onChange={handleChange}
                  placeholder="0"
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">NCM</label>
              <input
                name="ncm"
                value={form.ncm}
                onChange={handleChange}
                placeholder="Ex: 85044030"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">CFOP</label>
              <input
                name="cfop"
                value={form.cfop}
                onChange={handleChange}
                placeholder="Ex: 5102"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">CEST (opcional)</label>
            <input
              name="cest"
              value={form.cest}
              onChange={handleChange}
              placeholder="Ex: 0100100"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Variação</label>
              <input
                name="size"
                value={form.size}
                onChange={handleChange}
                placeholder="Ex: 500 ml, P, 50 cm, Único"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Cor</label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  name="color"
                  value={form.color}
                  onChange={handleChange}
                  placeholder="Ex: Preto, branco, azul"
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Qtd. em estoque</label>
              <div className="relative">
                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="prod-qty"
                  name="stockQty"
                  type="number"
                  min="0"
                  required
                  value={form.stockQty}
                  onChange={handleChange}
                  placeholder="0"
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Produto é caixa?</label>
              <div className="flex items-center gap-3">
                <input type="checkbox" name="isBox" checked={Boolean(form.isBox)} onChange={handleChange} className="h-4 w-4" />
                <input
                  name="unitsPerBox"
                  type="number"
                  min="1"
                  disabled={!form.isBox}
                  value={form.unitsPerBox}
                  onChange={handleChange}
                  placeholder="Quantidade por caixa"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Linha / categoria</label>
            <select
              id="prod-category"
              name="categoryId"
              value={form.categoryId}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="">Sem categoria</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Criar nova categoria</p>
                <p className="text-xs text-muted-foreground">Use isso quando a categoria ainda não existir na lista.</p>
              </div>
              <Plus className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="Ex: Eletrônicos, limpeza, escritório"
                className="flex-1 px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={isCreatingCategory || !newCategoryName.trim()}
                className="px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-60"
              >
                {isCreatingCategory ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              id="modal-save-product"
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 disabled:opacity-60"
            >
              {isPending ? 'Salvando...' : 'Salvar Produto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
