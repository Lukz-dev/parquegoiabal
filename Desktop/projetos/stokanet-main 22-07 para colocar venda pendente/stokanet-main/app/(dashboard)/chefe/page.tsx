import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getActiveUser, isBossRole } from '@/lib/access'
import { getBossProfileStatsForRange } from '@/lib/actions'
import { CalendarDays, Filter, Coins, TrendingUp, ShoppingCart, Percent, ArrowRight, PackageSearch } from 'lucide-react'

type SearchParams = {
  period?: string
  from?: string
  to?: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(value)
}

function startOfUtcDay(date: Date) {
  const result = new Date(date)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

function endOfUtcDay(date: Date) {
  const result = new Date(date)
  result.setUTCHours(23, 59, 59, 999)
  return result
}

function parseIsoDay(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function resolvePeriod(searchParams: SearchParams | undefined) {
  const period = searchParams?.period ?? '30d'
  const now = new Date()

  if (period === '7d') {
    const from = startOfUtcDay(addUtcDays(now, -6))
    const to = endOfUtcDay(now)
    return { period, from, to, label: 'Últimos 7 dias' }
  }

  if (period === '90d') {
    const from = startOfUtcDay(addUtcDays(now, -89))
    const to = endOfUtcDay(now)
    return { period, from, to, label: 'Últimos 90 dias' }
  }

  if (period === 'month') {
    const from = startOfUtcDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
    const to = endOfUtcDay(now)
    return { period, from, to, label: 'Mês atual' }
  }

  if (period === 'custom') {
    const from = parseIsoDay(searchParams?.from)
    const to = parseIsoDay(searchParams?.to)

    if (from && to) {
      const normalizedFrom = from <= to ? startOfUtcDay(from) : startOfUtcDay(to)
      const normalizedTo = from <= to ? endOfUtcDay(to) : endOfUtcDay(from)
      return { period, from: normalizedFrom, to: normalizedTo, label: `${formatDate(normalizedFrom)} a ${formatDate(normalizedTo)}` }
    }
  }

  const from = startOfUtcDay(addUtcDays(now, -29))
  const to = endOfUtcDay(now)
  return { period: '30d', from, to, label: 'Últimos 30 dias' }
}

function buildHref(period: string, from?: string, to?: string) {
  const params = new URLSearchParams()
  params.set('period', period)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return `/chefe?${params.toString()}`
}

export default async function ChefePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const activeUser = await getActiveUser()

  if (!isBossRole(activeUser.role)) {
    redirect('/')
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const period = resolvePeriod(resolvedSearchParams)
  const stats = await getBossProfileStatsForRange(period.from, period.to)

  const periodLinks = [
    { label: '7 dias', period: '7d' },
    { label: '30 dias', period: '30d' },
    { label: '90 dias', period: '90d' },
    { label: 'Mês atual', period: 'month' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Painel do chefe</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Lucro, venda e investimento</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Acompanhe o valor vendido, o valor investido, o lucro por produto e o preço médio vendido.
          </p>
        </div>

        <Link href="/perfil" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
          Ver meu perfil
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5 text-primary" />
              Período selecionado: {period.label}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Os custos consideram pedidos de compra recebidos no intervalo selecionado.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {periodLinks.map((item) => {
              const isActive = period.period === item.period
              return (
                <Link
                  key={item.period}
                  href={buildHref(item.period)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'}`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>

        <form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]" action="/chefe" method="get">
          <input type="hidden" name="period" value="custom" />
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Data inicial</span>
            <input name="from" type="date" defaultValue={resolvedSearchParams?.from ?? ''} className="h-11 rounded-lg border border-border bg-background px-3 text-sm" />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Data final</span>
            <input name="to" type="date" defaultValue={resolvedSearchParams?.to ?? ''} className="h-11 rounded-lg border border-border bg-background px-3 text-sm" />
          </label>
          <div className="flex items-end">
            <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              <Filter className="w-4 h-4" />
              Aplicar filtro
            </button>
          </div>
        </form>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Valor vendido', value: formatCurrency(stats.totalSoldValue), icon: ShoppingCart, tone: 'text-primary' },
          { label: 'Valor investido', value: formatCurrency(stats.totalInvestedValue), icon: Coins, tone: 'text-amber-500' },
          { label: 'Lucro estimado', value: formatCurrency(stats.totalProfit), icon: TrendingUp, tone: stats.totalProfit >= 0 ? 'text-emerald-500' : 'text-destructive' },
          { label: 'Unidades vendidas', value: stats.totalSoldQty.toLocaleString('pt-BR'), icon: PackageSearch, tone: 'text-cyan-500' },
          { label: 'Média por unidade', value: formatCurrency(stats.averagePricePerUnit), icon: Percent, tone: 'text-violet-500' },
        ].map((card) => {
          const Icon = card.icon
          return (
            <article key={card.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{card.label}</p>
                <Icon className={`w-4 h-4 ${card.tone}`} />
              </div>
              <p className="mt-3 text-2xl font-bold">{card.value}</p>
            </article>
          )
        })}
      </section>

      <section className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Ranking detalhado de produtos</h2>
            <p className="text-sm text-muted-foreground">Ordenado por lucro no período selecionado.</p>
          </div>
          <div className="text-sm text-muted-foreground">
            {formatDate(period.from)} a {formatDate(period.to)}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Posição</th>
                <th className="px-6 py-3 font-medium">Produto</th>
                <th className="px-6 py-3 font-medium text-right">Qtd.</th>
                <th className="px-6 py-3 font-medium text-right">Vendido</th>
                <th className="px-6 py-3 font-medium text-right">Investido</th>
                <th className="px-6 py-3 font-medium text-right">Lucro</th>
                <th className="px-6 py-3 font-medium text-right">Média</th>
                <th className="px-6 py-3 font-medium text-right">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.products.length === 0 ? (
                <tr>
                  <td className="px-6 py-12 text-center text-muted-foreground" colSpan={8}>
                    Nenhum produto encontrado para o período selecionado.
                  </td>
                </tr>
              ) : (
                stats.products.map((product, index) => {
                  const margin = product.investedValue > 0 ? (product.profit / product.investedValue) * 100 : null

                  return (
                    <tr key={product.productId} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-semibold text-muted-foreground">#{index + 1}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{product.productName}</div>
                        <div className="text-xs text-muted-foreground">{product.sku || 'Sem SKU'}</div>
                      </td>
                      <td className="px-6 py-4 text-right">{product.soldQty}</td>
                      <td className="px-6 py-4 text-right font-medium">{formatCurrency(product.soldValue)}</td>
                      <td className="px-6 py-4 text-right font-medium">{formatCurrency(product.investedValue)}</td>
                      <td className={`px-6 py-4 text-right font-semibold ${product.profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                        {formatCurrency(product.profit)}
                      </td>
                      <td className="px-6 py-4 text-right font-medium">{formatCurrency(product.averagePrice)}</td>
                      <td className="px-6 py-4 text-right font-medium">{margin === null ? '—' : `${margin.toFixed(1)}%`}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}