import { getSales } from '@/lib/actions'
import { VendasClient } from './VendasClient'

export default async function VendasPage() {
  const sales = await getSales(200)

  return <VendasClient initialSales={sales as any} />
}
