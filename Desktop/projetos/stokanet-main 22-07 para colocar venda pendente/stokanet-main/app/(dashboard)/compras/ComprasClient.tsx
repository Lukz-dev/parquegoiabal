'use client'

import { useMemo, useState, useTransition } from 'react'
import { createPurchaseOrder, receivePurchaseOrder } from '@/lib/actions'
import { ClipboardList, CheckCircle2, ShoppingCart } from 'lucide-react'

type Supplier = { id: string; name: string }
type Product = { id: string; name: string; sku: string }
type Order = {
  id: string
  code: string
  status: string
  subtotal: number
  createdAt: string | Date
  supplier?: Supplier | null
  items: Array<{ id: string; productName: string; quantity: number; unitCost: number; total: number }>
}

export function ComprasClient({
  initialOrders,
  suppliers,
  products,
}: {
  initialOrders: Order[]
  suppliers: Supplier[]
  products: Product[]
}) {
  const [orders, setOrders] = useState(initialOrders)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const [supplierId, setSupplierId] = useState('')
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [unitCost, setUnitCost] = useState(0)
  const [draftItems, setDraftItems] = useState<Array<{ productId: string; label: string; quantity: number; unitCost: number }>>([])

  const draftTotal = useMemo(
    () => draftItems.reduce((acc, item) => acc + item.quantity * item.unitCost, 0),
    [draftItems]
  )

  function addItem() {
    const product = products.find((p) => p.id === selectedProductId)
    if (!product || quantity <= 0 || unitCost < 0) return

    setDraftItems((prev) => [
      ...prev,
      {
        productId: product.id,
        label: `${product.name} (${product.sku})`,
        quantity,
        unitCost,
      },
    ])
  }

  function handleCreateOrder() {
    if (draftItems.length === 0) {
      setMessage('Adicione itens ao pedido antes de criar.')
      return
    }

    setMessage(null)
    startTransition(async () => {
      try {
        const created = await createPurchaseOrder({
          supplierId: supplierId || undefined,
          items: draftItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        })

        setOrders((prev) => [created as Order, ...prev])
        setDraftItems([])
        setMessage('Pedido criado com sucesso.')
      } catch (error: any) {
        setMessage(error?.message || 'Nao foi possivel criar pedido.')
      }
    })
  }

  function handleReceive(orderId: string) {
    setMessage(null)
    startTransition(async () => {
      try {
        await receivePurchaseOrder(orderId)
        setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: 'RECEBIDO' } : order)))
        setMessage('Pedido recebido e estoque atualizado.')
      } catch (error: any) {
        setMessage(error?.message || 'Nao foi possivel receber pedido.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compras</h1>
          <p className="text-sm text-muted-foreground">Crie pedidos de compra e receba mercadorias com baixa automatica no estoque.</p>
        </div>
        <a
          href="/api/export/purchase-orders"
          className="border border-border hover:bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Exportar pedidos CSV
        </a>
      </div>

      <div className="border border-border rounded-xl bg-card p-4 space-y-3">
        <div className="font-medium flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Novo pedido</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Fornecedor opcional</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>

          <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>
            ))}
          </select>

          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="Quantidade" />
          <input type="number" min={0} step="0.01" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="Custo unitario" />
        </div>

        <div className="flex gap-2">
          <button onClick={addItem} type="button" className="h-10 px-4 rounded-md border border-border text-sm">Adicionar item</button>
          <button onClick={handleCreateOrder} type="button" disabled={isPending} className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">Criar pedido</button>
        </div>

        <div className="text-sm text-muted-foreground">Total parcial: R$ {draftTotal.toFixed(2)}</div>
        <div className="space-y-1">
          {draftItems.map((item, idx) => (
            <div key={`${item.productId}-${idx}`} className="text-sm">{item.label} - {item.quantity} x R$ {item.unitCost.toFixed(2)}</div>
          ))}
        </div>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="px-4 py-3 border-b border-border font-medium flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Pedidos recentes</div>
        <div className="divide-y divide-border">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido de compra criado.</div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="p-4 flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <div className="font-medium">{order.code}</div>
                    <div className="text-sm text-muted-foreground">{order.supplier?.name || 'Sem fornecedor'} | {new Date(order.createdAt).toLocaleString('pt-BR')}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">R$ {order.subtotal.toFixed(2)}</span>
                    <span className="text-xs px-2 py-1 rounded-full border border-border">{order.status}</span>
                    {order.status === 'PENDENTE' ? (
                      <button onClick={() => handleReceive(order.id)} disabled={isPending} className="inline-flex items-center gap-1 text-sm text-primary hover:underline disabled:opacity-50">
                        <CheckCircle2 className="w-4 h-4" />
                        Receber
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {order.items.map((item) => `${item.productName} (${item.quantity})`).join(', ')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
