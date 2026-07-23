import { getMovements, getProducts } from '@/lib/actions'
import { MovimentacoesClient } from './MovimentacoesClient'

export default async function MovimentacoesPage() {
  const [movements, products] = await Promise.all([
    getMovements(),
    getProducts(),
  ])

  return <MovimentacoesClient initialMovements={movements as any} products={products as any} />
}
