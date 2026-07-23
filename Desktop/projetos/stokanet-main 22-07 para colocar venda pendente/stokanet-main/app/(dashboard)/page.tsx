import Link from 'next/link'
import { createElement } from 'react'
import { getDashboardStats } from '@/lib/actions'
import { PackageSearch, TrendingUp, AlertTriangle, Package, ArrowUpRight, ArrowDownRight, BadgePercent } from "lucide-react"

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function DashboardContent({ stats }: { stats: Awaited<ReturnType<typeof getDashboardStats>> }) {
  const attentionItems = stats.lowStockProducts + stats.criticalProducts
  const stockHealth = stats.totalProducts === 0
    ? 100
    : Math.max(0, Math.round(100 - (attentionItems / stats.totalProducts) * 100))

  const cards = [
    {
      label: 'Produtos ativos',
      value: stats.totalProducts.toString(),
      sub: `${stats.totalQty.toLocaleString('pt-BR')} unidades somadas no estoque ativo`,
      icon: Package,
      color: 'primary',
      trend: '+',
    },
    {
      label: 'Valor em estoque',
      value: formatCurrency(stats.totalValue),
      sub: 'Considera apenas produtos ativos',
      icon: TrendingUp,
      color: 'indigo',
      trend: '+',
    },
    {
      label: 'Produtos com atenção',
      value: stats.lowStockProducts.toString(),
      sub: 'Itens abaixo do ponto ideal',
      icon: AlertTriangle,
      color: 'amber',
      trend: stats.lowStockProducts > 0 ? '!' : '✓',
    },
    {
      label: 'Reposição urgente',
      value: stats.criticalProducts.toString(),
      sub: 'Itens críticos ou zerados',
      icon: PackageSearch,
      color: 'destructive',
      trend: stats.criticalProducts > 0 ? '!' : '✓',
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Visão geral da operação</h1>
        <p className="text-muted-foreground mt-1 text-lg">Acompanhe produtos, reposição e giro do seu mix em tempo real. Arquivados não entram no estoque ativo.</p>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon
          const colorMap: Record<string, string> = {
            primary: 'bg-primary/10 text-primary',
            indigo: 'bg-indigo-500/10 text-indigo-500',
            amber: 'bg-amber-500/10 text-amber-500',
            destructive: 'bg-destructive/10 text-destructive',
          }
          const subColorMap: Record<string, string> = {
            primary: 'text-emerald-500',
            indigo: 'text-emerald-500',
            amber: 'text-amber-500',
            destructive: 'text-destructive',
          }
          return (
            <div key={card.label} className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col gap-4 hover:border-primary/30 transition-colors group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start z-10">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                  <h2 className="text-2xl font-bold mt-1 truncate">{card.value}</h2>
                </div>
                <div className={`p-3 rounded-lg ${colorMap[card.color]} shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className={`flex items-center text-sm font-medium z-10 ${subColorMap[card.color]}`}>
                {card.color === 'primary' || card.color === 'indigo' ? (
                  <ArrowUpRight className="w-4 h-4 mr-1" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 mr-1" />
                )}
                <span>{card.sub}</span>
              </div>
            </div>
          )
        })}
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm p-6 min-h-[340px] flex flex-col hover:border-primary/30 transition-colors">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Resumo operacional</h3>
              <p className="text-sm text-muted-foreground">Uma leitura rápida do que pede atenção na loja.</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-right">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Saúde do estoque</p>
              <p className="text-2xl font-bold text-primary">{stockHealth}%</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 flex-1">
            {[
              { label: 'Produtos com atenção', value: attentionItems.toString(), hint: 'Abaixo do nível ideal' },
              { label: 'Movimentação total', value: stats.totalQty.toLocaleString('pt-BR'), hint: 'Unidades somadas no estoque ativo' },
              { label: 'Categorias ativas', value: '—', hint: 'Organize por linha de produto' },
              { label: 'Cobertura saudável', value: `${stockHealth}%`, hint: 'Maior é melhor' },
            ].map((item) => (
              <div key={item.label} className="bg-muted/30 rounded-lg p-4 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className="text-xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm p-6 min-h-[340px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Alertas de reposição</h3>
            <BadgePercent className="w-4 h-4 text-primary" />
          </div>
          {stats.criticalList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
              <Package className="w-10 h-10 mb-3 opacity-30" />
              <p>Nenhum item urgente no momento.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {stats.criticalList.map((p) => (
                <li key={p.id} className="flex justify-between items-center p-3 hover:bg-muted/50 rounded-lg transition-colors border border-transparent hover:border-border group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                      <PackageSearch className="w-4 h-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm truncate max-w-[120px]" title={p.name}>{p.name}</h4>
                      <p className="text-xs text-muted-foreground font-mono">
                        {p.sku}
                        {p.size ? ` • ${p.size}` : ''}
                        {p.color ? ` • ${p.color}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-sm ${p.stockQty === 0 ? 'text-destructive' : 'text-amber-500'}`}>
                      {p.stockQty} unds
                    </p>
                    <p className="text-xs text-muted-foreground">{p.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
    </div>
    </div>
  )
}

export default async function Dashboard() {
  try {
    const stats = await getDashboardStats()
    return createElement(DashboardContent, { stats })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível carregar os dados da conta.'

    return (
      <div className="max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-destructive">Conta com problema</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Não foi possível abrir o painel</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {message}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Se a conta foi criada antes da última atualização, ela pode estar sem empresa vinculada ou o banco pode estar fora de sincronia.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login" className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Voltar ao login
          </Link>
          <Link href="/perfil" className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted">
            Ver perfil
          </Link>
        </div>
      </div>
    )
  }
}
