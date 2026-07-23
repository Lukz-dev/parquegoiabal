import { getProducts, getPurchaseOrders, getSuppliers } from '@/lib/actions'
import { ComprasClient } from './ComprasClient'

export default async function ComprasPage() {
  const [orders, suppliers, products] = await Promise.all([
    getPurchaseOrders(80),
    getSuppliers(),
    getProducts(),
  ])

  return <ComprasClient initialOrders={orders as any} suppliers={suppliers as any} products={products as any} />
}
