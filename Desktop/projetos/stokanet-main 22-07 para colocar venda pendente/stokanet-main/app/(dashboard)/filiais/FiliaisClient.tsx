'use client'

import { useState, useTransition } from 'react'
import { adjustWarehouseStock, createWarehouse, transferWarehouseStock } from '@/lib/actions'

type Warehouse = { id: string; name: string; code: string; isDefault: boolean }
type Product = { id: string; name: string; sku: string }
type Transfer = {
  id: string
  code: string
  createdAt: string | Date
  fromWarehouse: { id: string; name: string; code: string }
  toWarehouse: { id: string; name: string; code: string }
  items: Array<{ id: string; productName: string; quantity: number }>
}

export function FiliaisClient({
  initialWarehouses,
  initialTransfers,
  products,
}: {
  initialWarehouses: Warehouse[]
  initialTransfers: Transfer[]
  products: Product[]
}) {
  const [warehouses, setWarehouses] = useState(initialWarehouses)
  const [transfers, setTransfers] = useState(initialTransfers)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const [newWarehouse, setNewWarehouse] = useState({ name: '', code: '', address: '' })

  const [adjustForm, setAdjustForm] = useState({
    warehouseId: initialWarehouses[0]?.id ?? '',
    productId: products[0]?.id ?? '',
    quantity: 0,
  })

  const [transferForm, setTransferForm] = useState({
    fromWarehouseId: initialWarehouses[0]?.id ?? '',
    toWarehouseId: initialWarehouses[1]?.id ?? initialWarehouses[0]?.id ?? '',
    productId: products[0]?.id ?? '',
    quantity: 1,
  })

  function handleCreateWarehouse(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      try {
        const created = await createWarehouse(newWarehouse)
        setWarehouses((prev) => [...prev, created as Warehouse])
        setNewWarehouse({ name: '', code: '', address: '' })
        setMessage('Deposito criado com sucesso.')
      } catch (error: any) {
        setMessage(error?.message || 'Nao foi possivel criar deposito.')
      }
    })
  }

  function handleAdjustStock() {
    setMessage(null)
    startTransition(async () => {
      try {
        await adjustWarehouseStock(adjustForm)
        setMessage('Estoque do deposito ajustado.')
      } catch (error: any) {
        setMessage(error?.message || 'Nao foi possivel ajustar estoque.')
      }
    })
  }

  function handleTransfer() {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await transferWarehouseStock({
          fromWarehouseId: transferForm.fromWarehouseId,
          toWarehouseId: transferForm.toWarehouseId,
          items: [{ productId: transferForm.productId, quantity: transferForm.quantity }],
        })

        if (result) {
          setTransfers((prev) => [result as Transfer, ...prev])
        }
        setMessage('Transferencia registrada.')
      } catch (error: any) {
        setMessage(error?.message || 'Nao foi possivel transferir.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Filiais e Depositos</h1>
          <p className="text-sm text-muted-foreground">Gerencie unidades de estoque e transfira produtos entre elas.</p>
        </div>
        <a
          href="/api/export/transfers"
          className="border border-border hover:bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Exportar transferencias CSV
        </a>
      </div>

      <form onSubmit={handleCreateWarehouse} className="border border-border rounded-xl bg-card p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input value={newWarehouse.name} onChange={(e) => setNewWarehouse((p) => ({ ...p, name: e.target.value }))} placeholder="Nome" className="h-10 rounded-md border border-input bg-background px-3 text-sm" required />
        <input value={newWarehouse.code} onChange={(e) => setNewWarehouse((p) => ({ ...p, code: e.target.value }))} placeholder="Codigo" className="h-10 rounded-md border border-input bg-background px-3 text-sm" required />
        <input value={newWarehouse.address} onChange={(e) => setNewWarehouse((p) => ({ ...p, address: e.target.value }))} placeholder="Endereco" className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
        <button disabled={isPending} className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">Criar deposito</button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl bg-card p-4 space-y-3">
          <h2 className="font-medium">Ajuste de estoque por deposito</h2>
          <select value={adjustForm.warehouseId} onChange={(e) => setAdjustForm((p) => ({ ...p, warehouseId: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
          </select>
          <select value={adjustForm.productId} onChange={(e) => setAdjustForm((p) => ({ ...p, productId: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}
          </select>
          <input type="number" min={0} value={adjustForm.quantity} onChange={(e) => setAdjustForm((p) => ({ ...p, quantity: Number(e.target.value) }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
          <button type="button" onClick={handleAdjustStock} disabled={isPending} className="h-10 rounded-md border border-border text-sm disabled:opacity-50">Aplicar ajuste</button>
        </div>

        <div className="border border-border rounded-xl bg-card p-4 space-y-3">
          <h2 className="font-medium">Transferencia entre depositos</h2>
          <select value={transferForm.fromWarehouseId} onChange={(e) => setTransferForm((p) => ({ ...p, fromWarehouseId: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>Origem: {warehouse.name}</option>)}
          </select>
          <select value={transferForm.toWarehouseId} onChange={(e) => setTransferForm((p) => ({ ...p, toWarehouseId: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>Destino: {warehouse.name}</option>)}
          </select>
          <select value={transferForm.productId} onChange={(e) => setTransferForm((p) => ({ ...p, productId: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}
          </select>
          <input type="number" min={1} value={transferForm.quantity} onChange={(e) => setTransferForm((p) => ({ ...p, quantity: Number(e.target.value) }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
          <button type="button" onClick={handleTransfer} disabled={isPending} className="h-10 rounded-md border border-border text-sm disabled:opacity-50">Transferir</button>
        </div>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="px-4 py-3 border-b border-border text-sm font-medium">Transferencias recentes ({transfers.length})</div>
        <div className="divide-y divide-border">
          {transfers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma transferencia registrada.</div>
          ) : (
            transfers.map((transfer) => (
              <div key={transfer.id} className="p-4 text-sm">
                <div className="font-medium">{transfer.code}</div>
                <div className="text-muted-foreground">{transfer.fromWarehouse.name}{' -> '}{transfer.toWarehouse.name}</div>
                <div className="text-xs text-muted-foreground">{transfer.items.map((item) => `${item.productName} (${item.quantity})`).join(', ')}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
