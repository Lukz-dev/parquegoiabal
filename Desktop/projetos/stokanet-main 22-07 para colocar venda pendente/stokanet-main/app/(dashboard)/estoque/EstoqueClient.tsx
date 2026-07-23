'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { Plus, Search, Filter, Edit2, Package, ChevronLeft, ChevronRight, RotateCcw, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { archiveProduct, deleteProduct, unarchiveProduct } from '@/lib/actions'

const ProductModal = dynamic(() => import('@/components/ProductModal').then((module) => module.ProductModal))
const EditProductModal = dynamic(() => import('@/components/EditProductModal').then((module) => module.EditProductModal))

interface Category { id: string; name: string }
interface Product {
  id: string; name: string; sku: string; size: string | null; color: string | null; purchaseCost: number; price: number
  stockQty: number; minStock: number; status: string
  categoryId: string | null; category: Category | null
}

type ViewMode = 'ativos' | 'arquivados'

const STATUS_COLORS: Record<string, string> = {
  Normal: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  Baixo: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  Crítico: 'bg-destructive/10 text-destructive border-destructive/20',
  Esgotado: 'bg-destructive/10 text-destructive border-destructive/20',
  Arquivado: 'bg-muted text-muted-foreground border-border',
}

const STATUS_OPTIONS = ['todos', 'Normal', 'Baixo', 'Crítico', 'Esgotado']
const VIEW_OPTIONS: Array<{ label: string; value: ViewMode }> = [
  { label: 'Ativos', value: 'ativos' },
  { label: 'Arquivados', value: 'arquivados' },
]
const PAGE_SIZE = 10

export function EstoqueClient({ initialProducts, categories, defaultMinStock }: { initialProducts: Product[]; categories: Category[]; defaultMinStock: number }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [view, setView] = useState<ViewMode>('ativos')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [showCreate, setShowCreate] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [page, setPage] = useState(1)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [isUnarchiving, startUnarchiveTransition] = useTransition()
  const [isBulkDeleting, startBulkDeleteTransition] = useTransition()
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return initialProducts.filter(p => {
      const matchView = view === 'ativos' ? p.status !== 'Arquivado' : p.status === 'Arquivado'
      const matchSearch = !search || [p.name, p.sku, p.size ?? '', p.color ?? '', p.category?.name ?? ''].some(field => field.toLowerCase().includes(search.toLowerCase()))
      const matchStatus = view === 'ativos' ? (statusFilter === 'todos' || p.status === statusFilter) : true
      return matchView && matchSearch && matchStatus
    })
  }, [initialProducts, search, statusFilter, view])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const paginatedIds = paginated.map((product) => product.id)
  const selectedOnPageCount = paginatedIds.filter((id) => selectedProductIds.has(id)).length
  const allPageSelected = paginatedIds.length > 0 && selectedOnPageCount === paginatedIds.length

  const clearSelection = useCallback(() => {
    setSelectedProductIds(new Set())
  }, [])

  const togglePageSelection = useCallback(() => {
    setSelectedProductIds((current) => {
      const next = new Set(current)
      const shouldSelectAll = !paginatedIds.every((id) => next.has(id))

      for (const id of paginatedIds) {
        if (shouldSelectAll) {
          next.add(id)
        } else {
          next.delete(id)
        }
      }

      return next
    })
  }, [paginatedIds])

  const toggleProductSelection = useCallback((productId: string) => {
    setSelectedProductIds((current) => {
      const next = new Set(current)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }, [])

  const handleSuccess = useCallback(() => {
    router.refresh()
  }, [router])

  const handleBulkDelete = useCallback(() => {
    const selectedIds = [...selectedProductIds].filter((id) => paginatedIds.includes(id))

    if (selectedIds.length === 0) {
      return
    }

    const confirmed = window.confirm(
      `Excluir ${selectedIds.length} produto(s) selecionado(s)? Esta ação não pode ser desfeita.`
    )

    if (!confirmed) {
      return
    }

    startBulkDeleteTransition(async () => {
      try {
        let deletedCount = 0
        const blockedMessages: string[] = []

        for (const productId of selectedIds) {
          try {
            const result = await deleteProduct(productId)
            if (result?.ok) {
              deletedCount += 1
            } else if (result?.reason) {
              blockedMessages.push(result.reason)
            }
          } catch (error) {
            blockedMessages.push(error instanceof Error ? error.message : `Erro ao excluir ${productId}`)
          }
        }

        clearSelection()
        router.refresh()

        if (blockedMessages.length > 0) {
          window.alert(
            `Exclusão concluída com restrições. Excluídos: ${deletedCount}. Bloqueados: ${blockedMessages.length}.\n\n${blockedMessages.slice(0, 3).join('\n')}${blockedMessages.length > 3 ? '\n...' : ''}`
          )
        } else {
          window.alert(`Exclusão concluída. ${deletedCount} produto(s) removido(s).`)
        }
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Não foi possível excluir os produtos selecionados.')
      }
    })
  }, [clearSelection, paginatedIds, router, selectedProductIds, startBulkDeleteTransition])

  const handleBulkArchive = useCallback(() => {
    const selectedIds = [...selectedProductIds].filter((id) => paginatedIds.includes(id))

    if (selectedIds.length === 0) {
      return
    }

    const actionLabel = view === 'ativos' ? 'arquivar' : 'desarquivar'
    const confirmed = window.confirm(
      `${actionLabel === 'arquivar' ? 'Arquivar' : 'Desarquivar'} ${selectedIds.length} produto(s) selecionado(s)?`
    )

    if (!confirmed) {
      return
    }

    startBulkDeleteTransition(async () => {
      try {
        let processedCount = 0
        const blockedMessages: string[] = []

        for (const productId of selectedIds) {
          try {
            const result = view === 'ativos'
              ? await archiveProduct(productId)
              : await unarchiveProduct(productId)

            if (result?.ok) {
              processedCount += 1
            } else {
              blockedMessages.push(`Não foi possível ${actionLabel} o produto ${productId}.`)
            }
          } catch (error) {
            blockedMessages.push(error instanceof Error ? error.message : `Erro ao processar ${productId}`)
          }
        }

        clearSelection()
        router.refresh()

        if (blockedMessages.length > 0) {
          window.alert(
            `${actionLabel === 'arquivar' ? 'Arquivamento' : 'Desarquivamento'} concluído com restrições. Processados: ${processedCount}. Bloqueados: ${blockedMessages.length}.\n\n${blockedMessages.slice(0, 3).join('\n')}${blockedMessages.length > 3 ? '\n...' : ''}`
          )
        } else {
          window.alert(`${actionLabel === 'arquivar' ? 'Arquivamento' : 'Desarquivamento'} concluído. ${processedCount} produto(s) atualizado(s).`)
        }
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Não foi possível processar os produtos selecionados.')
      }
    })
  }, [clearSelection, paginatedIds, router, selectedProductIds, startBulkDeleteTransition, view])

  const handleUnarchive = useCallback((productId: string) => {
    startUnarchiveTransition(async () => {
      try {
        setUnarchivingId(productId)
        await unarchiveProduct(productId)
        router.refresh()
      } finally {
        setUnarchivingId(null)
      }
    })
  }, [router, startUnarchiveTransition])

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const duplicateEntries = useMemo(() => {
    const map = new Map<string, number>()
    initialProducts.forEach((p) => {
      const sku = (p.sku ?? '').trim()
      if (!sku) return
      map.set(sku, (map.get(sku) ?? 0) + 1)
    })
    return Array.from(map.entries()).filter(([, count]) => count > 1)
  }, [initialProducts])

  const duplicateSkus = duplicateEntries.map(([sku]) => sku)
  const duplicateCount = duplicateEntries.length

  return (
    <>
      {showCreate && (
        <ProductModal
          categories={categories}
          defaultMinStock={defaultMinStock}
          existingProducts={initialProducts.map((product) => ({ id: product.id, sku: product.sku }))}
          onClose={() => setShowCreate(false)}
          onSuccess={handleSuccess}
        />
      )}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          categories={categories}
          existingProducts={initialProducts.map((product) => ({ id: product.id, sku: product.sku }))}
          onClose={() => setEditingProduct(null)}
          onSuccess={handleSuccess}
        />
      )}

      <div className="flex flex-col gap-6 h-full">
        {duplicateCount > 0 ? (
          <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">Atenção: foram encontrados {duplicateCount} código(s) duplicado(s) no estoque.</p>
            <p className="text-sm text-amber-700 mt-1">SKUs duplicados: {duplicateSkus.slice(0, 5).join(', ')}{duplicateSkus.length > 5 ? ` e mais ${duplicateSkus.length - 5}...` : ''}</p>
          </div>
        ) : null}
        {/* Cabeçalho */}
        <div className="flex justify-between items-end gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Produtos e arquivados</h1>
            <p className="text-muted-foreground mt-1">
              {filtered.length} item{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''} na aba {view === 'ativos' ? 'ativa' : 'arquivada'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-1">
              {VIEW_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => { setView(option.value); setStatusFilter('todos'); setPage(1); clearSelection() }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    view === option.value
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {view === 'ativos' && (
              <button
                id="btn-novo-produto"
                onClick={() => setShowCreate(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                Novo Produto
              </button>
            )}
            {selectedOnPageCount > 0 && (
              <button
                type="button"
                onClick={handleBulkArchive}
                disabled={isBulkDeleting}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all shadow-lg shadow-slate-500/15 hover:shadow-slate-500/25 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                {isBulkDeleting
                  ? 'Processando...'
                  : view === 'ativos'
                    ? `Arquivar selecionados (${selectedOnPageCount})`
                    : `Desarquivar selecionados (${selectedOnPageCount})`}
              </button>
            )}
            {selectedOnPageCount > 0 && (
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                {isBulkDeleting ? 'Excluindo...' : `Excluir selecionados (${selectedOnPageCount})`}
              </button>
            )}
            <a
              href="/api/export/products"
              className="border border-border hover:bg-muted text-foreground px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors"
            >
              Exportar CSV
            </a>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col flex-1">
          {/* Filtros */}
          <div className="p-4 border-b border-border flex flex-wrap gap-3 bg-muted/10 rounded-t-xl">
            <div className="flex-1 min-w-48 flex items-center bg-background rounded-lg px-3 py-2 border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
              <input
                id="search-products"
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); clearSelection() }}
                placeholder="Buscar por nome, SKU ou categoria..."
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground"
              />
            </div>
            {view === 'ativos' && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setPage(1); clearSelection() }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                      statusFilter === s
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-background border border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {s === 'todos' ? 'Todos' : s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto flex-1">
            {paginated.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Package className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Nenhum produto encontrado</p>
                <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre um novo produto.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/30 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-4 font-semibold tracking-wider w-12">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={togglePageSelection}
                        aria-label="Selecionar todos os produtos desta página"
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                    </th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Produto</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">SKU interno</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Variação</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Cor</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Custo de compra</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Preço de venda</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Lucro/peça</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Qtd. em estoque</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Situação</th>
                    <th className="px-6 py-4 font-semibold tracking-wider text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((p) => (
                    <tr key={p.id} className="bg-transparent hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-4 align-top">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.has(p.id)}
                          onChange={() => toggleProductSelection(p.id)}
                          aria-label={`Selecionar produto ${p.name}`}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground max-w-[220px] truncate" title={p.name}>{p.name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{p.sku}</td>
                      <td className="px-6 py-4">
                        {p.size ? (
                          <span className="px-2 py-1 rounded-md border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">{p.size}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {p.color ? (
                          <span className="text-xs font-medium text-foreground">{p.color}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {p.category ? (
                          <span className="px-2 py-1 bg-secondary rounded-md text-xs font-medium text-secondary-foreground">{p.category.name}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-muted-foreground">{formatCurrency(p.purchaseCost)}</td>
                      <td className="px-6 py-4 font-medium text-muted-foreground">{formatCurrency(p.price)}</td>
                      <td className="px-6 py-4">
                        {p.purchaseCost ? (
                          <span className={`font-bold text-sm ${
                            p.price - p.purchaseCost > 0
                              ? 'text-emerald-500'
                              : p.price - p.purchaseCost === 0
                              ? 'text-muted-foreground'
                              : 'text-destructive'
                          }`}>
                            {formatCurrency(p.price - p.purchaseCost)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-bold text-base ${p.stockQty === 0 ? 'text-destructive' : p.stockQty <= p.minStock ? 'text-amber-500' : 'text-foreground'}`}>
                          {p.stockQty}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">/ mín {p.minStock}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[p.status] ?? ''}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {p.status === 'Arquivado' ? (
                            <button
                              onClick={() => handleUnarchive(p.id)}
                              disabled={isUnarchiving && unarchivingId === p.id}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/20 text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
                              title="Desarquivar produto"
                            >
                              <RotateCcw className="w-4 h-4" />
                              {isUnarchiving && unarchivingId === p.id ? 'Restaurando...' : 'Desarquivar'}
                            </button>
                          ) : (
                            <button
                              onClick={() => setEditingProduct(p)}
                              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Editar produto"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginação */}
          <div className="p-4 border-t border-border flex justify-between items-center text-sm text-muted-foreground bg-muted/10 rounded-b-xl">
            <span>
              Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} itens
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setPage(p => Math.max(1, p - 1)); clearSelection() }}
                disabled={page === 1}
                className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1).map((n, i, arr) => (
                <span key={n} className="flex items-center gap-2">
                  {i > 0 && arr[i - 1] !== n - 1 && <span className="px-1 text-muted-foreground">…</span>}
                  <button
                    onClick={() => { setPage(n); clearSelection() }}
                    className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                      page === n ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                    }`}
                  >
                    {n}
                  </button>
                </span>
              ))}
              <button
                onClick={() => { setPage(p => Math.min(totalPages, p + 1)); clearSelection() }}
                disabled={page === totalPages}
                className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
