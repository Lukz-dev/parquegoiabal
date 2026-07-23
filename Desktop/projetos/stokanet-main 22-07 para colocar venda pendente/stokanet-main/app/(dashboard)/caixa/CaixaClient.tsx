'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { CreditCard, Plus, ScanLine, Trash2 } from 'lucide-react'
import { completeSale, findProductByCode } from '@/lib/actions'
import { useRouter } from 'next/navigation'

type Product = {
  id: string
  name: string
  sku: string
  price: number
  stockQty: number
  size: string | null
  color: string | null
}

type Sale = {
  id: string
  code: string
  subtotal: number
  discount: number
  total: number
  paymentMethod: string | null
  details: string | null
  isPending: boolean
  createdAt: string
  items: Array<{
    id: string
    productName: string
    sku: string
    quantity: number
    unitPrice: number
    total: number
  }>
}

type CartItem = {
  productId: string
  sku: string
  name: string
  unitPrice: number
  stockQty: number
  quantity: number
}

type PaymentMode = 'UNICO' | 'MISTO'

type SplitPayment = {
  method: string
  amount: string
}

const DISCOUNT_PERCENT_PRESETS = ['0', '5', '10', '15', '20'] as const
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
  PIX: 'PIX',
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de crédito' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de débito' },
  { value: 'PIX', label: 'PIX' },
]

function paymentMethodLabel(method: string) {
  return PAYMENT_METHOD_LABELS[method] ?? method
}

function rankProductMatches(products: Product[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  return products
    .map((product) => {
      const sku = product.sku.toLowerCase()
      const name = product.name.toLowerCase()

      const exactSku = sku === normalizedQuery
      const exactName = name === normalizedQuery
      const startsSku = sku.startsWith(normalizedQuery)
      const startsName = name.startsWith(normalizedQuery)
      const includesSku = sku.includes(normalizedQuery)
      const includesName = name.includes(normalizedQuery)

      let score = 99
      if (exactSku) score = 0
      else if (exactName) score = 1
      else if (startsSku) score = 2
      else if (startsName) score = 3
      else if (includesSku) score = 4
      else if (includesName) score = 5

      return score === 99 ? null : { product, score, exactSku, exactName }
    })
    .filter((item): item is { product: Product; score: number; exactSku: boolean; exactName: boolean } => item !== null)
    .sort((left, right) => left.score - right.score || left.product.name.localeCompare(right.product.name, 'pt-BR'))
    .slice(0, 8)
}

export function CaixaClient({ products, initialSales }: { products: Product[]; initialSales: Sale[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [code, setCode] = useState('')
  const [discountPercent, setDiscountPercent] = useState('0')
  const [discountPreset, setDiscountPreset] = useState<string>('0')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UNICO')
  const [paymentMethod, setPaymentMethod] = useState('DINHEIRO')
  const [amountReceived, setAmountReceived] = useState('')
  const [saleDetails, setSaleDetails] = useState('')
  const [isPendingSale, setIsPendingSale] = useState(false)
  const [amountReceivedTouched, setAmountReceivedTouched] = useState(false)
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([
    { method: 'CARTAO_CREDITO', amount: '' },
    { method: 'DINHEIRO', amount: '' },
  ])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [scannerModeEnabled, setScannerModeEnabled] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showOnlyDiscountedSales, setShowOnlyDiscountedSales] = useState(false)
  const [lastSaleId, setLastSaleId] = useState<string | null>(null)
  const [lastSaleCode, setLastSaleCode] = useState<string | null>(null)
  const scannerInputRef = useRef<HTMLInputElement | null>(null)
  const paymentMethodSelectRef = useRef<HTMLSelectElement | null>(null)
  const amountReceivedRef = useRef<HTMLInputElement | null>(null)
  const discountInputRef = useRef<HTMLInputElement | null>(null)
  const firstSplitAmountRef = useRef<HTMLInputElement | null>(null)
  const scannerBufferRef = useRef('')
  const lastKeyAtRef = useRef(0)

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0), [cart])
  const parsedDiscountPercent = Math.min(100, Math.max(0, Number(discountPercent) || 0))
  const boundedDiscount = Number(((subtotal * parsedDiscountPercent) / 100).toFixed(2))
  const total = Math.max(0, subtotal - boundedDiscount)
  const isCashPayment = paymentMethod === 'DINHEIRO'
  const effectiveAmountReceived = isCashPayment && !amountReceivedTouched ? total.toFixed(2) : amountReceived
  const parsedAmountReceived = Math.max(0, Number(effectiveAmountReceived) || 0)
  const change = isCashPayment ? Number(Math.max(0, parsedAmountReceived - total).toFixed(2)) : 0
  const splitPaymentValues = useMemo(
    () => splitPayments.map((item) => ({ ...item, amountValue: Math.max(0, Number(item.amount) || 0) })),
    [splitPayments],
  )
  const splitPaymentTotal = Number(splitPaymentValues.reduce((acc, item) => acc + item.amountValue, 0).toFixed(2))
  const splitPaymentDifference = Number((splitPaymentTotal - total).toFixed(2))
  const splitPaymentRowsFilled = splitPaymentValues.every((item) => item.amountValue > 0)
  const splitPaymentMethodsValid = new Set(splitPaymentValues.map((item) => item.method)).size === splitPaymentValues.length
  const splitPaymentMissing = paymentMode === 'MISTO' && (!splitPaymentRowsFilled || !splitPaymentMethodsValid || splitPaymentDifference !== 0)
  const paymentMissing = paymentMode === 'UNICO' && isCashPayment && total > 0 && parsedAmountReceived < total
  const searchResults = useMemo(() => rankProductMatches(products, code), [code, products])
  const hasSearchResults = searchResults.length > 0
  const recentSales = useMemo(
    () => (showOnlyDiscountedSales ? initialSales.filter((sale) => sale.discount > 0) : initialSales),
    [initialSales, showOnlyDiscountedSales],
  )

  const formatCurrency = useCallback(
    (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
    [],
  )

  const normalizePercentInput = (value: string) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return 0
    return Math.min(100, Math.max(0, numeric))
  }

  const handlePresetChange = (value: string) => {
    setDiscountPreset(value)
    if (value === 'custom') return
    setDiscountPercent(value)
  }

  const handlePercentChange = (value: string) => {
    setDiscountPercent(value)
    const normalized = String(normalizePercentInput(value))
    if (DISCOUNT_PERCENT_PRESETS.includes(normalized as (typeof DISCOUNT_PERCENT_PRESETS)[number])) {
      setDiscountPreset(normalized)
      return
    }
    setDiscountPreset('custom')
  }

  const handlePaymentMethodChange = (value: string) => {
    setPaymentMethod(value)
    if (value !== 'DINHEIRO') {
      setAmountReceived('')
      setAmountReceivedTouched(false)
      return
    }

    setAmountReceivedTouched(false)
    setAmountReceived(total.toFixed(2))
  }

  const handlePaymentModeChange = (value: PaymentMode) => {
    setPaymentMode(value)

    if (value === 'MISTO') {
      const secondaryMethod = paymentMethod === 'DINHEIRO' ? 'CARTAO_CREDITO' : 'DINHEIRO'
      setSplitPayments([
        { method: paymentMethod, amount: total > 0 ? total.toFixed(2) : '' },
        { method: secondaryMethod, amount: '' },
      ])
      setAmountReceived('')
      setAmountReceivedTouched(false)
      setError('')
      return
    }

    setSplitPayments([
      { method: 'CARTAO_CREDITO', amount: '' },
      { method: 'DINHEIRO', amount: '' },
    ])
    setAmountReceivedTouched(false)
    setAmountReceived(paymentMethod === 'DINHEIRO' ? total.toFixed(2) : '')
    setError('')
  }

  const handleSplitPaymentChange = (index: number, field: keyof SplitPayment, value: string) => {
    setSplitPayments((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, [field]: value } : item)))
  }

  const addProductToCart = useCallback((product: Product) => {
    let added = false

    if (product.stockQty <= 0) {
      setError('Este produto está sem estoque.')
      return false
    }

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id)
      if (!existing) {
        added = true
        return [...current, {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unitPrice: product.price,
          stockQty: product.stockQty,
          quantity: 1,
        }]
      }

      if (existing.quantity >= existing.stockQty) {
        setError(`Estoque máximo atingido para ${existing.name}.`)
        return current
      }

      added = true
      return current.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)
    })
    return added
  }, [])

  const handleSelectSearchResult = useCallback((product: Product) => {
    const added = addProductToCart(product)
    setCode('')
    if (!added) {
      setSuccess('')
      return
    }

    setError('')
    setSuccess(`Produto ${product.name} adicionado ao carrinho.`)
    scannerInputRef.current?.focus()
  }, [addProductToCart])

  const readCodeAndAddToCart = useCallback((rawCode: string) => {
    const value = rawCode.trim()
    if (!value) {
      setError('Digite um SKU ou nome para buscar.')
      return
    }

    startTransition(async () => {
      try {
        const product = await findProductByCode(value)
        const added = addProductToCart(product as Product)
        if (!added) {
          return
        }
        setCode('')
      } catch (currentError: any) {
        const localMatches = rankProductMatches(products, value)

        if (localMatches.length === 0) {
          setError(currentError?.message || `Nenhum produto encontrado para "${value}".`)
          setSuccess('')
          return
        }

        if (localMatches.length === 1) {
          const added = addProductToCart(localMatches[0].product)
          if (!added) {
            setSuccess('')
            return
          }
          setCode('')
          setError('')
          setSuccess('')
          return
        }

        setError(`Encontramos ${localMatches.length} produtos para "${value}". Escolha um da lista abaixo.`)
        setSuccess('')
      }
    })
  }, [addProductToCart, products])

  const handleReadCode = (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    readCodeAndAddToCart(code)
  }

  const finalizeSale = useCallback(() => {
    setError('')
    setSuccess('')

    if (cart.length === 0) {
      setError('Adicione itens no carrinho antes de finalizar.')
      return
    }

    if (paymentMode === 'MISTO' && splitPaymentMissing) {
      setError('Preencha os dois meios de pagamento para fechar o valor total.')
      return
    }

    startTransition(async () => {
      try {
        const result = await completeSale({
          items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          paymentMethod: paymentMode === 'UNICO' ? paymentMethod : undefined,
          paymentBreakdown: paymentMode === 'MISTO'
            ? splitPaymentValues
                .filter((item) => item.amountValue > 0)
                .map((item) => ({ method: item.method, amount: item.amountValue }))
            : undefined,
          discount: boundedDiscount,
          amountReceived: paymentMode === 'UNICO' && isCashPayment ? parsedAmountReceived : undefined,
          details: saleDetails.trim() || undefined,
          isPending: isPendingSale,
        })
        const changeMessage = result.change > 0 ? ` Troco: ${formatCurrency(result.change)}.` : ''
        setSuccess(
          isPendingSale
            ? `Venda ${result.code} registrada como pendente com sucesso.${changeMessage}`
            : `Venda ${result.code} finalizada com sucesso.${changeMessage}`,
        )
        setLastSaleId(result.id)
        setLastSaleCode(result.code)
        setCart([])
        setDiscountPercent('0')
        setDiscountPreset('0')
        setAmountReceived('')
        setSaleDetails('')
        setIsPendingSale(false)
        setAmountReceivedTouched(false)
        setPaymentMode('UNICO')
        setSplitPayments([
          { method: 'CARTAO_CREDITO', amount: '' },
          { method: 'DINHEIRO', amount: '' },
        ])
        router.refresh()
      } catch (currentError: any) {
        setError(currentError?.message || 'Não foi possível finalizar a venda.')
      }
    })
  }, [
    boundedDiscount,
    cart,
    formatCurrency,
    isCashPayment,
    parsedAmountReceived,
    paymentMethod,
    paymentMode,
    router,
    splitPaymentMissing,
    splitPaymentValues,
    startTransition,
  ])

  useEffect(() => {
    if (!scannerModeEnabled) return
    scannerInputRef.current?.focus()
  }, [scannerModeEnabled])

  useEffect(() => {
    if (!scannerModeEnabled) {
      scannerBufferRef.current = ''
      return
    }

    const isEditableElement = (element: Element | null) => {
      if (!element) return false
      if (element instanceof HTMLInputElement) return true
      if (element instanceof HTMLTextAreaElement) return true
      if (element instanceof HTMLSelectElement) return true
      return (element as HTMLElement).isContentEditable
    }

    const handleGlobalScannerInput = (event: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isScannerInputFocused = activeElement === scannerInputRef.current
      const shouldCapture = !isEditableElement(activeElement) || isScannerInputFocused

      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault()
        finalizeSale()
        return
      }

      if (event.key === 'F2') {
        event.preventDefault()
        scannerInputRef.current?.focus()
        scannerInputRef.current?.select()
        return
      }

      if (event.key === 'F4') {
        event.preventDefault()
        setScannerModeEnabled((current) => !current)
        return
      }

      if (event.key === 'F6') {
        event.preventDefault()
        if (paymentMode === 'MISTO') {
          firstSplitAmountRef.current?.focus()
          firstSplitAmountRef.current?.select()
        } else if (paymentMethod === 'DINHEIRO') {
          amountReceivedRef.current?.focus()
          amountReceivedRef.current?.select()
        } else {
          paymentMethodSelectRef.current?.focus()
        }
        return
      }

      if (event.key === 'F7') {
        event.preventDefault()
        discountInputRef.current?.focus()
        discountInputRef.current?.select()
        return
      }

      if (!shouldCapture || event.ctrlKey || event.metaKey || event.altKey) return

      if (event.key === 'Enter') {
        const scannedCode = scannerBufferRef.current.trim()
        if (scannedCode.length > 0) {
          event.preventDefault()
          scannerBufferRef.current = ''
          setError('')
          setSuccess('')
          setCode(scannedCode)
          readCodeAndAddToCart(scannedCode)
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
  }, [finalizeSale, paymentMethod, paymentMode, readCodeAndAddToCart, scannerModeEnabled])

  const updateQuantity = (productId: string, quantity: number) => {
    setCart((current) => {
      if (quantity <= 0) return current.filter((item) => item.productId !== productId)
      return current.map((item) => {
        if (item.productId !== productId) return item
        return { ...item, quantity: Math.min(item.stockQty, quantity) }
      })
    })
  }

  const removeItem = (productId: string) => {
    setCart((current) => current.filter((item) => item.productId !== productId))
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Caixa e vendas</h1>
          <div className="flex flex-wrap items-center gap-2">
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
              className="border border-border hover:bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {scannerModeEnabled ? 'Desativar scanner' : 'Ativar scanner'}
            </button>
            <a
              href="/api/export/sales"
              className="border border-border hover:bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Exportar vendas CSV
            </a>
            {lastSaleId ? (
              <Link
                href={`/api/export/nfse/${lastSaleId}`}
                target="_blank"
                rel="noreferrer"
                className="border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Gerar NFS-e{lastSaleCode ? ` ${lastSaleCode}` : ''}
              </Link>
            ) : null}
          </div>
        </div>
        <p className="text-muted-foreground mt-1">Registre vendas, aplique desconto e atualize o estoque automaticamente.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full border border-border bg-muted/30 px-2.5 py-1">F2: foco no SKU</span>
          <span className="rounded-full border border-border bg-muted/30 px-2.5 py-1">F4: alternar scanner</span>
          <span className="rounded-full border border-border bg-muted/30 px-2.5 py-1">F6: pagamento</span>
          <span className="rounded-full border border-border bg-muted/30 px-2.5 py-1">F7: desconto</span>
          <span className="rounded-full border border-border bg-muted/30 px-2.5 py-1">Ctrl+Enter: finalizar</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm">
          <form onSubmit={handleReadCode} className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3 mb-4">
            <div className="relative">
              <ScanLine className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={scannerInputRef}
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Leia o SKU ou digite o nome do produto"
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {isPending ? 'Lendo...' : 'Adicionar'}
            </button>
          </form>

          {code.trim() && hasSearchResults ? (
            <div className="mb-4 rounded-lg border border-border bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Resultados encontrados</p>
                  <p className="text-xs text-muted-foreground">Selecione um produto para adicioná-lo ao carrinho.</p>
                </div>
                <span className="text-xs text-muted-foreground">{searchResults.length} opção(ões)</span>
              </div>
              <div className="grid gap-2">
                {searchResults.map(({ product }) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelectSearchResult(product)}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.sku}
                          {product.size ? ` • ${product.size}` : ''}
                          {product.color ? ` • ${product.color}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="block text-xs font-semibold text-muted-foreground">{formatCurrency(product.price)}</span>
                        <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          Adicionar
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <div className="space-y-3">
              <select
                value={paymentMode}
                onChange={e => handlePaymentModeChange(e.target.value as PaymentMode)}
                className="px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              >
                <option value="UNICO">Pagamento único</option>
                <option value="MISTO">Dois meios de pagamento</option>
              </select>

              {paymentMode === 'UNICO' ? (
                <div className="space-y-3">
                  <select
                    ref={paymentMethodSelectRef}
                    value={paymentMethod}
                    onChange={e => handlePaymentMethodChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>

                  {isCashPayment ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Valor recebido
                        </label>
                        <input
                          ref={amountReceivedRef}
                          type="number"
                          min="0"
                          step="0.01"
                          value={amountReceived}
                          onChange={e => {
                            setAmountReceivedTouched(true)
                            setAmountReceived(e.target.value)
                          }}
                          placeholder="0,00"
                          className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Troco</p>
                        <p className="mt-1 text-lg font-bold">{formatCurrency(change)}</p>
                        {paymentMissing ? (
                          <p className="mt-1 text-xs text-amber-600">Informe um valor igual ou maior que o total para calcular o troco.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Pagamento dividido</p>
                      <p className="text-xs text-muted-foreground">Use dois meios e feche exatamente o valor total.</p>
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">Total: {formatCurrency(splitPaymentTotal)}</span>
                  </div>

                  <div className="grid gap-3">
                    {splitPayments.map((item, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-3">
                        <select
                          value={item.method}
                          onChange={e => handleSplitPaymentChange(index, 'method', e.target.value)}
                          className="px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                        >
                          {PAYMENT_METHOD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <input
                          ref={index === 0 ? firstSplitAmountRef : undefined}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.amount}
                          onChange={e => handleSplitPaymentChange(index, 'amount', e.target.value)}
                          placeholder="0,00"
                          className="px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Soma dos pagamentos</span>
                      <span className="font-semibold">{formatCurrency(splitPaymentTotal)}</span>
                    </div>
                    {splitPaymentDifference !== 0 ? (
                      <p className="mt-1 text-xs text-amber-600">
                        A soma precisa fechar {formatCurrency(total)} para finalizar.
                      </p>
                    ) : splitPaymentTotal > 0 ? (
                      <p className="mt-1 text-xs text-emerald-600">
                        Pagamento fechado com {splitPaymentValues.map((item) => `${paymentMethodLabel(item.method)} ${formatCurrency(item.amountValue)}`).join(' + ')}.
                      </p>
                    ) : null}
                    {!splitPaymentMethodsValid ? (
                      <p className="mt-1 text-xs text-amber-600">Escolha meios diferentes para cada parcela.</p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={discountPreset}
                onChange={e => handlePresetChange(e.target.value)}
                className="px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="10">10%</option>
                <option value="15">15%</option>
                <option value="20">20%</option>
                <option value="custom">Personalizado</option>
              </select>
              <input
                ref={discountInputRef}
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPercent}
                onChange={e => handlePercentChange(e.target.value)}
                placeholder="Desconto %"
                className="px-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-muted/10 p-4 md:grid-cols-[auto_1fr] md:items-start">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={isPendingSale}
                onChange={(event) => setIsPendingSale(event.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
              />
              Marcar como venda pendente
            </label>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Detalhes da venda
              </label>
              <textarea
                value={saleDetails}
                onChange={(event) => setSaleDetails(event.target.value)}
                rows={3}
                placeholder="Informações adicionais, combinação com o cliente, observações do atendimento..."
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1 text-xs text-muted-foreground">A venda pendente não baixa o estoque e aparece destacada em vermelho na lista de vendas.</p>
            </div>
          </div>

          {error && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-4">{error}</p>}
          {success && <p className="text-sm text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 mb-4">{success}</p>}

          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Produto</th>
                  <th className="px-4 py-3 text-left">Qtd</th>
                  <th className="px-4 py-3 text-left">Preço</th>
                  <th className="px-4 py-3 text-left">Total</th>
                  <th className="px-4 py-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-muted-foreground" colSpan={5}>Carrinho vazio. Leia um código para começar.</td>
                  </tr>
                ) : cart.map((item) => (
                  <tr key={item.productId} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        max={item.stockQty}
                        value={item.quantity}
                        onChange={e => updateQuantity(item.productId, Number(e.target.value) || 1)}
                        className="w-20 px-2 py-1.5 bg-background border border-border rounded text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(item.unitPrice * item.quantity)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-lg mb-4">Resumo da venda</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Desconto ({parsedDiscountPercent.toFixed(2)}%)</span><span>- {formatCurrency(boundedDiscount)}</span></div>
              <div className="h-px bg-border my-2" />
              <div className="flex items-center justify-between text-base font-bold"><span>Total</span><span>{formatCurrency(total)}</span></div>
            </div>
            <button
              type="button"
              onClick={finalizeSale}
              disabled={isPending || cart.length === 0 || paymentMissing}
              className="mt-4 w-full px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-2"><CreditCard className="w-4 h-4" /> {isPending ? 'Finalizando...' : 'Finalizar venda'}</span>
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-semibold text-lg">Vendas recentes</h2>
              <button
                type="button"
                onClick={() => setShowOnlyDiscountedSales((current) => !current)}
                className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                  showOnlyDiscountedSales
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {showOnlyDiscountedSales ? 'Somente com desconto' : 'Mostrar todos'}
              </button>
            </div>
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {recentSales.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {showOnlyDiscountedSales ? 'Nenhuma venda com desconto encontrada.' : 'Nenhuma venda registrada ainda.'}
                </p>
              ) : recentSales.map((sale) => (
                <div key={sale.id} className={`rounded-lg border p-3 ${sale.isPending ? 'border-red-500/30 bg-red-500/5' : 'border-border'}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{sale.code}</p>
                    <div className="flex items-center gap-2">
                      {sale.isPending ? <span className="rounded-full bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-700">Pendente</span> : null}
                      <Link
                        href={`/api/export/nfse/${sale.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-700 hover:bg-emerald-500/15 transition-colors"
                      >
                        NFS-e
                      </Link>
                      <span className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{sale.items.reduce((acc, item) => acc + item.quantity, 0)} item(ns)</p>
                  {sale.details ? <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">Detalhes: {sale.details}</p> : null}
                  {sale.discount > 0 && sale.subtotal > 0 ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Desconto: {((sale.discount / sale.subtotal) * 100).toFixed(2)}% ({formatCurrency(sale.discount)})
                    </p>
                  ) : null}
                  <p className="font-bold text-sm mt-2">{formatCurrency(sale.total)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-base mb-3">Atalhos de caixa</h2>
            <div className="space-y-2 text-sm">
              {products.slice(0, 5).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProductToCart(product)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    {product.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
