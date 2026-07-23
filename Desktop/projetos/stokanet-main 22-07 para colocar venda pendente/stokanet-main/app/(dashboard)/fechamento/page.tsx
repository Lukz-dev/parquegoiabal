import { getMonthlyClosureCalendar } from '@/lib/actions'
import { FechamentoClient } from './FechamentoClient'

export default async function FechamentoPage() {
  const data = await getMonthlyClosureCalendar()

  return <FechamentoClient initialData={data as any} />
}
