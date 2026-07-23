import { getDashboardReport } from '@/lib/actions'
import { BarChart3, AlertTriangle, Package2, ShoppingBag, ReceiptText, Clock3 } from 'lucide-react'

export default async function RelatoriosPage() {
  const report = await getDashboardReport()

  const marginColor = report.grossProfitMonth >= 0 ? 'text-emerald-600' : 'text-destructive'
  const marginBadge = `${report.grossMarginMonth.toFixed(1)}%`

  const cards = [
    { label: 'Produtos cadastrados', value: report.productsCount, icon: Package2 },
    { label: 'Estoque baixo/critico', value: report.lowStockCount, icon: AlertTriangle },
    { label: 'Produtos esgotados', value: report.outOfStockCount, icon: Clock3 },
    { label: 'Pedidos pendentes', value: report.pendingPurchaseOrders, icon: ReceiptText },
    { label: 'Lotes vencendo em 30 dias', value: report.expiringBatches, icon: AlertTriangle },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatorios</h1>
        <p className="text-sm text-muted-foreground">Visao consolidada para tomada de decisao operacional.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="border border-border rounded-xl bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{card.label}</span>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-2xl font-bold">{card.value}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><ShoppingBag className="w-4 h-4" /> Faturamento</div>
          <div className="mt-3 text-3xl font-bold">R$ {report.salesMonth.toFixed(2)}</div>
          <p className="text-sm text-muted-foreground mt-1">No mes atual</p>
        </div>

        <div className="border border-border rounded-xl bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><BarChart3 className="w-4 h-4" /> Vendas de hoje</div>
          <div className="mt-3 text-3xl font-bold">R$ {report.salesToday.toFixed(2)}</div>
          <p className="text-sm text-muted-foreground mt-1">Atualizado em tempo real</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded-xl bg-card p-5">
          <div className="text-sm text-muted-foreground">Custo das mercadorias vendidas</div>
          <div className="mt-3 text-3xl font-bold">R$ {report.goodsCostMonth.toFixed(2)}</div>
          <p className="text-sm text-muted-foreground mt-1">Gasto estimado nas vendas do mes</p>
        </div>

        <div className="border border-border rounded-xl bg-card p-5">
          <div className="text-sm text-muted-foreground">Lucro bruto</div>
          <div className={`mt-3 text-3xl font-bold ${marginColor}`}>R$ {report.grossProfitMonth.toFixed(2)}</div>
          <p className="text-sm text-muted-foreground mt-1">Margem bruta {marginBadge}</p>
        </div>

        <div className="border border-border rounded-xl bg-card p-5">
          <div className="text-sm text-muted-foreground">Leitura rápida</div>
          <div className="mt-3 text-2xl font-bold">{report.grossProfitMonth >= 0 ? 'Venda gerando caixa' : 'Atenção ao custo'}</div>
          <p className="text-sm text-muted-foreground mt-1">Use este bloco para decidir reposição e precificação.</p>
        </div>
      </div>
    </div>
  )
}
