'use client'

import { useState, useCallback, useEffect, useMemo, useRef, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { Plus, ArrowUpCircle, ArrowDownCircle, SlidersHorizontal, Package, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { createSaleByCode } from '@/lib/actions'
import { useRouter } from 'next/navigation'

const MovementModal = dynamic(() => import('@/components/MovementModal').then((module) => module.MovementModal))

interface Product { id: string; name: string; sku: string; size: string | null; color: string | null; stockQty: number }
interface Movement {
  id: string
  type: string
  quantity: number
  reason: string | null
  createdAt: string
  product: { id: string; name: string; sku: string; size: string | null; color: string | null }
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  ENTRADA: { label: 'Entrada', icon: ArrowUpCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  SAIDA:   { label: 'Saída', icon: ArrowDownCircle, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' },
  AJUSTE:  { label: 'Ajuste', icon: SlidersHorizontal, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
}

const PAGE_SIZE = 15

export function MovimentacoesClient({
  initialMovements, products
}: { initialMovements: Movement[]; products: Product[] }) {
  const router = useRouter()
  const [isScanPending, startScanTransition] = useTransition()
  const scanInputRef = useRef<HTMLInputElement>(null)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('todos')
  const [page, setPage] = useState(1)
  const [scanCode, setScanCode] = useState('')
  const [scanQty, setScanQty] = useState('1')
  const [scannerModeEnabled, setScannerModeEnabled] = useState(true)
  const [scanError, setScanError] = useState('')
  const [scanSuccess, setScanSuccess] = useState('')
  const scannerBufferRef = useRef('')
  const lastKeyAtRef = useRef(0)

  const filtered = useMemo(() => {
    return initialMovements.filter(m => {
      const matchType = typeFilter === 'todos' || m.type === typeFilter
      const matchSearch = !search ||
        m.product.name.toLowerCase().includes(search.toLowerCase()) ||
        m.product.sku.toLowerCase().includes(search.toLowerCase()) ||
        (m.reason ?? '').toLowerCase().includes(search.toLowerCase())
      return matchType && matchSearch
    })
  }, [initialMovements, typeFilter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSuccess = useCallback(() => router.refresh(), [router])

  useEffect(() => {
    if (!scannerModeEnabled) {
      scannerBufferRef.current = ''
      return
    }

    scanInputRef.current?.focus()
  }, [scannerModeEnabled])

  useEffect(() => {
    if (!scannerModeEnabled) return

    const isEditableElement = (element: Element | null) => {
      if (!element) return false
      if (element instanceof HTMLInputElement) return true
      if (element instanceof HTMLTextAreaElement) return true
      if (element instanceof HTMLSelectElement) return true
      return (element as HTMLElement).isContentEditable
    }

    const handleGlobalScannerInput = (event: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isScannerInputFocused = activeElement === scanInputRef.current
      const shouldCapture = !isEditableElement(activeElement) || isScannerInputFocused

      if (!shouldCapture || event.ctrlKey || event.metaKey || event.altKey) return

      if (event.key === 'Enter') {
        const scannedCode = scannerBufferRef.current.trim()
        if (scannedCode.length > 0) {
          event.preventDefault()
          scannerBufferRef.current = ''
          setScanError('')
          setScanSuccess('')
          setScanCode(scannedCode)
          scanInputRef.current?.form?.requestSubmit()
        }
        return
      }

      if (event.key.length !== 1) return

      const now = Date.now()
      const elapsed = now - lastKeyAtRef.current
      lastKeyAtRef.current = now

      if (elapsed > 120) {
        scannerBufferRef.current = event.key
      } else {
        scannerBufferRef.current += event.key
      }
    }

    window.addEventListener('keydown', handleGlobalScannerInput)
    return () => {
      window.removeEventListener('keydown', handleGlobalScannerInput)
    }
  }, [scannerModeEnabled])

  const handleScannerSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const code = scanCode.trim()
    if (!code) {
      setScanSuccess('')
      setScanError('Leia ou digite um codigo valido.')
      scanInputRef.current?.focus()
      return
    }

    const qty = parseInt(scanQty, 10)
    if (!scanQty || Number.isNaN(qty) || qty <= 0) {
      setScanSuccess('')
      setScanError('Quantidade deve ser maior que zero.')
      return
    }

    setScanError('')
    setScanSuccess('')

    startScanTransition(async () => {
      try {
        const sale = await createSaleByCode({
          code,
          quantity: qty,
        })

        setScanSuccess(`${sale.productName} (${sale.sku}) - baixa de ${sale.quantity} un.`)
        setScanCode('')
        setPage(1)
        router.refresh()
      } catch (err: any) {
        setScanError(err?.message || 'Nao foi possivel registrar a venda pelo codigo.')
      } finally {
        scanInputRef.current?.focus()
      }
    })
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  // Totais por tipo
  const totals = useMemo(() => ({
    ENTRADA: initialMovements.filter(m => m.type === 'ENTRADA').reduce((a, m) => a + m.quantity, 0),
    SAIDA: initialMovements.filter(m => m.type === 'SAIDA').reduce((a, m) => a + m.quantity, 0),
    AJUSTE: initialMovements.filter(m => m.type === 'AJUSTE').length,
  }), [initialMovements])

  return (
    <>
      {showModal && (
        <MovementModal
          products={products}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}

      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Movimentações de estoque</h1>
            <p className="text-muted-foreground mt-1">Histórico das entradas, saídas e ajustes dos produtos.</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/export/movements"
              className="border border-border hover:bg-muted text-foreground px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors"
            >
              Exportar CSV
            </a>
            <button
              id="btn-nova-movimentacao"
              onClick={() => setShowModal(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Nova movimentação
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm p-4 md:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Leitura no caixa</h2>
                <p className="text-sm text-muted-foreground mt-1">Leia o codigo no leitor e pressione Enter para registrar automaticamente a saida no estoque.</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                    scannerModeEnabled
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-600'
                  }`}
                >
                  Modo scanner: {scannerModeEnabled ? 'Ligado' : 'Desligado'}
                </span>
                <button
                  type="button"
                  onClick={() => setScannerModeEnabled((current) => !current)}
                  className="border border-border hover:bg-muted text-foreground px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  {scannerModeEnabled ? 'Desativar scanner' : 'Ativar scanner'}
                </button>
              </div>
            </div>

            <form onSubmit={handleScannerSubmit} className="grid grid-cols-1 md:grid-cols-[1fr_120px_140px] gap-3">
              <input
                ref={scanInputRef}
                type="text"
                value={scanCode}
                onChange={e => setScanCode(e.target.value)}
                placeholder="Codigo lido no caixa"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <input
                type="number"
                min="1"
                value={scanQty}
                onChange={e => setScanQty(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button
                type="submit"
                disabled={isScanPending}
                className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 disabled:opacity-60"
              >
                {isScanPending ? 'Registrando...' : 'Registrar leitura'}
              </button>
            </form>

            {scanError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">{scanError}</p>
            )}
            {scanSuccess && (
              <p className="text-sm text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2.5">{scanSuccess}</p>
            )}
          </div>
        </div>

        {/* Cards Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { type: 'ENTRADA', label: 'Total de entradas', value: `+${totals.ENTRADA} unds` },
            { type: 'SAIDA', label: 'Total de saídas', value: `-${totals.SAIDA} unds` },
            { type: 'AJUSTE', label: 'Ajustes realizados', value: `${totals.AJUSTE} eventos` },
          ].map(card => {
            const cfg = TYPE_CONFIG[card.type]
            const Icon = cfg.icon
            return (
              <div key={card.type} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm hover:border-primary/30 transition-colors">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${cfg.bg}`}>
                  <Icon className={`w-6 h-6 ${cfg.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className={`text-xl font-bold ${cfg.color}`}>{card.value}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Tabela */}
        <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col">
          {/* Filtros */}
          <div className="p-4 border-b border-border flex flex-wrap gap-3 bg-muted/10 rounded-t-xl">
            <div className="flex-1 min-w-48 flex items-center bg-background rounded-lg px-3 py-2 border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Buscar por produto, SKU ou motivo..."
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              {['todos', 'ENTRADA', 'SAIDA', 'AJUSTE'].map(t => (
                <button
                  key={t}
                  onClick={() => { setTypeFilter(t); setPage(1) }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    typeFilter === t
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-background border border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t === 'todos' ? 'Todos' : TYPE_CONFIG[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-x-auto flex-1">
            {paginated.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Package className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Nenhuma movimentação encontrada</p>
                <p className="text-sm mt-1">Registre uma movimentação clicando em &quot;Nova movimentação&quot;.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/30 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-semibold tracking-wider">Tipo</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Produto</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Quantidade</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Motivo</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map(mov => {
                    const cfg = TYPE_CONFIG[mov.type]
                    const Icon = cfg.icon
                    return (
                      <tr key={mov.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground truncate max-w-[200px]" title={mov.product.name}>{mov.product.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {mov.product.sku}
                            {mov.product.size ? ` • ${mov.product.size}` : ''}
                            {mov.product.color ? ` • ${mov.product.color}` : ''}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-bold text-base ${
                            mov.type === 'ENTRADA' ? 'text-emerald-500' :
                            mov.type === 'SAIDA' ? 'text-destructive' : 'text-amber-500'
                          }`}>
                            {mov.type === 'ENTRADA' ? '+' : mov.type === 'SAIDA' ? '-' : '='}{mov.quantity}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">unds</span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground max-w-[180px] truncate" title={mov.reason ?? ''}>
                          {mov.reason || <span className="opacity-40 italic">—</span>}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground text-xs">
                          {formatDate(mov.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-border flex justify-between items-center text-sm text-muted-foreground bg-muted/10 rounded-b-xl">
              <span>
                {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} registros
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 text-xs font-medium">
                  {page} / {totalPages}
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
