import { getBatches, getProducts } from '@/lib/actions'
import { LotesClient } from './LotesClient'

export default async function LotesPage() {
  const [batches, products] = await Promise.all([
    getBatches({ limit: 200 }),
    getProducts(),
  ])

  return <LotesClient initialBatches={batches as any} products={products as any} />
}
