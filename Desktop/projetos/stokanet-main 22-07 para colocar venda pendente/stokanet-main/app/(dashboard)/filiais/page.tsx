import { getProducts, getWarehouses, getWarehouseTransfers } from '@/lib/actions'
import { FiliaisClient } from './FiliaisClient'

export default async function FiliaisPage() {
  const [warehouses, transfers, products] = await Promise.all([
    getWarehouses(),
    getWarehouseTransfers(80),
    getProducts(),
  ])

  return (
    <FiliaisClient
      initialWarehouses={warehouses as any}
      initialTransfers={transfers as any}
      products={products as any}
    />
  )
}
