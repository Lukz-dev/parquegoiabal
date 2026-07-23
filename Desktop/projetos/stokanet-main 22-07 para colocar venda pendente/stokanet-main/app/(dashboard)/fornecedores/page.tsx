import { getSuppliers } from '@/lib/actions'
import { FornecedoresClient } from './FornecedoresClient'

export default async function FornecedoresPage() {
  const suppliers = await getSuppliers()
  return <FornecedoresClient initialSuppliers={suppliers as any} />
}
