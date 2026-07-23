import { getProducts, getSales } from '@/lib/actions'
import { CaixaClient } from './CaixaClient'

export default async function CaixaPage() {
  const [products, sales] = await Promise.all([
    getProducts(),
    getSales(30),
  ])

  return <CaixaClient products={products as any} initialSales={sales as any} />
}
