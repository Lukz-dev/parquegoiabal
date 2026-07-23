'use client'

import { useMemo, useState, useTransition } from 'react'
import { CalendarCheck2, CalendarClock, CalendarRange, ChevronLeft, ChevronRight, Lock, LockOpen, RefreshCw } from 'lucide-react'
import {
  closeDailyClosure,
  closeMonthlyClosure,
  getMonthlyClosureCalendar,
  reopenDailyClosure,
  reopenMonthlyClosure,
} from '@/lib/actions'

type ClosureDay = {
  date: string
  day: number
  weekDay: number
  status: 'OPEN' | 'CLOSED'
  notes: string | null
  salesCount: number
  salesTotal: number
  purchaseOrdersCount: number
  purchaseTotal: number
  stockEntriesQty: number
  stockOutputsQty: number
  stockAdjustmentsQty: number
  stockBalanceQty: number
  cashExpected: number
  stockValue: number
  closedAt: string | null
}

type ClosureCalendar = {
  month: {
    year: number
    month: number
    monthKey: string
    status: 'OPEN' | 'CLOSED'
    notes: string | null
    closedAt: string | null
  }
  summary: {
    daysInMonth: number
    closedDays: number
    openDays: number
    salesTotal: number
    purchaseTotal: number
    cashExpected: number
  }
  days: ClosureDay[]
  prev: { year: number; month: number }
  next: { year: number; month: number }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatMonthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatMonthInputValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function getMonthRange(days: ClosureDay[]) {
  return {
    start: days[0]?.date ?? '',
    end: days[days.length - 1]?.date ?? '',
  }
}

function parsePaymentMethods(notes: string | null): { method: string; amount: number }[] {
  if (!notes) return []

  const paymentMethods = [
    { label: 'PIX', key: 'PIX' },
    { label: 'DINHEIRO', key: 'DINHEIRO' },
    { label: 'CARTAO_CREDITO', key: 'CARTÃO DE CRÉDITO' },
    { label: 'CARTAO_DEBITO', key: 'CARTÃO DE DÉBITO' },
  ]

  const parsed: { method: string; amount: number }[] = []

  for (const pm of paymentMethods) {
    // Try both the key name and common variations
    const patterns = [
      new RegExp(`${pm.key}:\\s*R\\$\\s*([\\d,]+(?:\\.\\d+)?)`, 'i'),
      new RegExp(`${pm.label}:\\s*R\\$\\s*([\\d,]+(?:\\.\\d+)?)`, 'i'),
    ]

    for (const pattern of patterns) {
      const match = notes.match(pattern)
      if (match) {
        // Parse the amount: "1.200,50" or "1200.50" → 1200.50
        let amountStr = match[1]
        amountStr = amountStr.replace('.', '').replace(',', '.')
        const amount = parseFloat(amountStr)
        if (!isNaN(amount)) {
          parsed.push({ method: pm.label, amount })
          break
        }
      }
    }
  }

  return parsed
}

export function FechamentoClient({ initialData }: { initialData: ClosureCalendar }) {
  const [data, setData] = useState<ClosureCalendar>(initialData)
  const [selectedDate, setSelectedDate] = useState(initialData.days[0]?.date ?? '')
  const [notes, setNotes] = useState(initialData.days[0]?.notes ?? '')
  const [monthNotes, setMonthNotes] = useState(initialData.month.notes ?? '')
  const [batchNotes, setBatchNotes] = useState('')
  const [rangeStart, setRangeStart] = useState(initialData.days[0]?.date ?? '')
  const [rangeEnd, setRangeEnd] = useState(initialData.days[initialData.days.length - 1]?.date ?? '')
  const [feedback, setFeedback] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  const selectedDay = useMemo(
    () => data.days.find((item) => item.date === selectedDate) ?? data.days[0],
    [data.days, selectedDate],
  )

  const firstWeekDay = data.days[0]?.weekDay ?? 1
  const leadingBlanks = (firstWeekDay + 6) % 7

  const calendarCells = useMemo(() => {
    const blanks = Array.from({ length: leadingBlanks }, () => null)
    return [...blanks, ...data.days]
  }, [leadingBlanks, data.days])

  const normalizedRange = useMemo(() => {
    if (!rangeStart || !rangeEnd) {
      return getMonthRange(data.days)
    }

    return rangeStart <= rangeEnd
      ? { start: rangeStart, end: rangeEnd }
      : { start: rangeEnd, end: rangeStart }
  }, [data.days, rangeEnd, rangeStart])

  const rangeDays = useMemo(() => {
    return data.days.filter((day) => day.date >= normalizedRange.start && day.date <= normalizedRange.end)
  }, [data.days, normalizedRange.end, normalizedRange.start])

  const rangeSummary = useMemo(() => {
    const closedDays = rangeDays.filter((item) => item.status === 'CLOSED')
    return {
      daysInRange: rangeDays.length,
      closedDays: closedDays.length,
      openDays: rangeDays.length - closedDays.length,
      salesTotal: Number(rangeDays.reduce((acc, item) => acc + item.salesTotal, 0).toFixed(2)),
      purchaseTotal: Number(rangeDays.reduce((acc, item) => acc + item.purchaseTotal, 0).toFixed(2)),
      cashExpected: Number(rangeDays.reduce((acc, item) => acc + item.cashExpected, 0).toFixed(2)),
    }
  }, [rangeDays])

  const refreshMonth = (year: number, month: number, keepSelectedDate?: string) => {
    startTransition(async () => {
      try {
        setError('')
        const nextData = (await getMonthlyClosureCalendar({ year, month })) as ClosureCalendar
        setData(nextData)
        setMonthNotes(nextData.month.notes ?? '')
        const nextRange = getMonthRange(nextData.days)
        setRangeStart(nextRange.start)
        setRangeEnd(nextRange.end)

        const nextSelected = keepSelectedDate && nextData.days.some((d) => d.date === keepSelectedDate)
          ? keepSelectedDate
          : nextData.days[0]?.date ?? ''

        setSelectedDate(nextSelected)
        const selectedFromData = nextData.days.find((d) => d.date === nextSelected)
        setNotes(selectedFromData?.notes ?? '')
      } catch (currentError: any) {
        setError(currentError?.message || 'Nao foi possivel atualizar o calendario.')
      }
    })
  }

  const handleSelectDay = (date: string) => {
    setSelectedDate(date)
    const day = data.days.find((item) => item.date === date)
    setNotes(day?.notes ?? '')
    setFeedback('')
    setError('')
  }

  const handleMonthChange = (value: string) => {
    if (!value) return

    const [yearPart, monthPart] = value.split('-').map(Number)
    if (!Number.isInteger(yearPart) || !Number.isInteger(monthPart)) return

    refreshMonth(yearPart, monthPart)
  }

  const handleCloseDay = () => {
    if (!selectedDay) return

    startTransition(async () => {
      try {
        setError('')
        setFeedback('')
        await closeDailyClosure({ day: selectedDay.date, notes })
        setFeedback(`Dia ${selectedDay.date} fechado com sucesso.`)
        refreshMonth(data.month.year, data.month.month, selectedDay.date)
      } catch (currentError: any) {
        setError(currentError?.message || 'Nao foi possivel fechar o dia.')
      }
    })
  }

  const handleCloseRange = () => {
    if (!rangeDays.length) return

    const daysToClose = rangeDays.filter((day) => day.status !== 'CLOSED')
    if (!daysToClose.length) {
      setFeedback('Todos os dias do intervalo já estão fechados.')
      setError('')
      return
    }

    startTransition(async () => {
      try {
        setError('')
        setFeedback('')

        for (const day of daysToClose) {
          await closeDailyClosure({ day: day.date, notes: batchNotes })
        }

        setFeedback(`Fechamento em lote concluído para ${daysToClose.length} dia(s).`)
        refreshMonth(data.month.year, data.month.month, daysToClose[0]?.date)
      } catch (currentError: any) {
        setError(currentError?.message || 'Nao foi possivel fechar o intervalo selecionado.')
      }
    })
  }

  const handleReopenDay = () => {
    if (!selectedDay) return

    startTransition(async () => {
      try {
        setError('')
        setFeedback('')
        await reopenDailyClosure({ day: selectedDay.date })
        setFeedback(`Dia ${selectedDay.date} reaberto com sucesso.`)
        refreshMonth(data.month.year, data.month.month, selectedDay.date)
      } catch (currentError: any) {
        setError(currentError?.message || 'Nao foi possivel reabrir o dia.')
      }
    })
  }

  const handleCloseMonth = () => {
    startTransition(async () => {
      try {
        setError('')
        setFeedback('')
        await closeMonthlyClosure({
          year: data.month.year,
          month: data.month.month,
          notes: monthNotes,
        })
        setFeedback(`Mes ${data.month.monthKey} fechado com sucesso.`)
        refreshMonth(data.month.year, data.month.month, selectedDay?.date)
      } catch (currentError: any) {
        setError(currentError?.message || 'Nao foi possivel fechar o mes.')
      }
    })
  }

  const handleReopenMonth = () => {
    startTransition(async () => {
      try {
        setError('')
        setFeedback('')
        await reopenMonthlyClosure({ year: data.month.year, month: data.month.month })
        setFeedback(`Mes ${data.month.monthKey} reaberto com sucesso.`)
        refreshMonth(data.month.year, data.month.month, selectedDay?.date)
      } catch (currentError: any) {
        setError(currentError?.message || 'Nao foi possivel reabrir o mes.')
      }
    })
  }

  const monthlyPaymentSummary = useMemo(() => {
    const sums: Record<string, number> = {}
    const closedDays = data.days.filter((d) => d.status === 'CLOSED')

    for (const day of closedDays) {
      const payments = parsePaymentMethods(day.notes)
      for (const p of payments) {
        sums[p.method] = (sums[p.method] || 0) + p.amount
      }
    }

    return Object.entries(sums).map(([method, amount]) => ({ method, amount }))
  }, [data.days])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fechamento mensal</h1>
          <p className="text-muted-foreground mt-1">Controle diario com calendario, snapshot por dia e fechamento consolidado do mes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm">
            <span className="text-muted-foreground">Mês</span>
            <input
              type="month"
              value={formatMonthInputValue(data.month.year, data.month.month)}
              onChange={(event) => handleMonthChange(event.target.value)}
              className="bg-transparent outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => refreshMonth(data.prev.year, data.prev.month)}
            className="px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm"
          >
            <span className="inline-flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Mes anterior</span>
          </button>
          <button
            type="button"
            onClick={() => refreshMonth(data.next.year, data.next.month)}
            className="px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm"
          >
            <span className="inline-flex items-center gap-1">Proximo mes <ChevronRight className="w-4 h-4" /></span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="border border-border rounded-xl bg-card p-4">
          <p className="text-xs text-muted-foreground">Mes selecionado</p>
          <p className="text-xl font-bold capitalize mt-1">{formatMonthLabel(data.month.year, data.month.month)}</p>
          <p className="text-xs text-muted-foreground mt-2">Chave: {data.month.monthKey}</p>
        </div>
        <div className="border border-border rounded-xl bg-card p-4">
          <p className="text-xs text-muted-foreground">Dias fechados</p>
          <p className="text-2xl font-bold mt-1">{data.summary.closedDays}/{data.summary.daysInMonth}</p>
          <p className="text-xs text-muted-foreground mt-2">Pendentes: {data.summary.openDays}</p>
        </div>
        <div className="border border-border rounded-xl bg-card p-4">
          <p className="text-xs text-muted-foreground">Vendas fechadas</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(data.summary.salesTotal)}</p>
          <p className="text-xs text-muted-foreground mt-2">Compras: {formatCurrency(data.summary.purchaseTotal)}</p>
        </div>
        <div className="border border-border rounded-xl bg-card p-4">
          <p className="text-xs text-muted-foreground">Caixa esperado</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(data.summary.cashExpected)}</p>
          <p className="text-xs text-muted-foreground mt-2">Status do mes: {data.month.status === 'CLOSED' ? 'Fechado' : 'Aberto'}</p>
        </div>
      </div>
      
      <section className="border border-border rounded-xl bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Formas de pagamento (resumo mensal)</h2>
        <div className="mb-4">
          {monthlyPaymentSummary.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {monthlyPaymentSummary.map((p) => (
                <div key={p.method} className="border rounded-md px-3 py-2">
                  <div className="text-xs text-muted-foreground">{p.method}</div>
                  <div className="font-semibold">{formatCurrency(p.amount)}</div>
                </div>
              ))}
              <div className="border rounded-md px-3 py-2">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="font-semibold text-emerald-600">{formatCurrency(monthlyPaymentSummary.reduce((s, x) => s + x.amount, 0))}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Nenhum registro de formas de pagamento encontradas para o mês.</div>
          )}
        </div>
      </section>

      <section className="border border-border rounded-xl bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold inline-flex items-center gap-2"><CalendarRange className="w-5 h-5 text-emerald-600" /> Recorte por periodo</h2>
            <p className="text-sm text-muted-foreground mt-1">Escolha um dia inicial e um dia final dentro do mes atual para filtrar os dados exibidos.</p>
          </div>
          <div className="text-xs text-muted-foreground">
            {normalizedRange.start && normalizedRange.end ? `${normalizedRange.start} até ${normalizedRange.end}` : 'Selecione um intervalo'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">Dia inicial</span>
            <input
              type="date"
              value={rangeStart}
              min={data.days[0]?.date}
              max={data.days[data.days.length - 1]?.date}
              onChange={(event) => setRangeStart(event.target.value)}
              className="calendar-picker-white bg-transparent outline-none text-sm"
            />
          </label>
          <label className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">Dia final</span>
            <input
              type="date"
              value={rangeEnd}
              min={data.days[0]?.date}
              max={data.days[data.days.length - 1]?.date}
              onChange={(event) => setRangeEnd(event.target.value)}
              className="calendar-picker-white bg-transparent outline-none text-sm"
            />
          </label>
          <div className="rounded-lg border border-border px-3 py-2 bg-muted/30">
            <p className="text-xs text-muted-foreground">Dias no recorte</p>
            <p className="text-xl font-bold mt-1">{rangeSummary.daysInRange}</p>
            <p className="text-xs text-muted-foreground mt-1">Fechados: {rangeSummary.closedDays} | Abertos: {rangeSummary.openDays}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="rounded-lg border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">Vendas no periodo</p>
            <p className="text-lg font-semibold mt-1">{formatCurrency(rangeSummary.salesTotal)}</p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">Compras no periodo</p>
            <p className="text-lg font-semibold mt-1">{formatCurrency(rangeSummary.purchaseTotal)}</p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">Caixa esperado no periodo</p>
            <p className="text-lg font-semibold mt-1">{formatCurrency(rangeSummary.cashExpected)}</p>
          </div>
        </div>

        <textarea
          value={batchNotes}
          onChange={(event) => setBatchNotes(event.target.value)}
          placeholder="Observacoes para o fechamento em lote"
          className="mt-4 w-full min-h-20 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCloseRange}
            disabled={isPending || data.month.status === 'CLOSED' || !rangeDays.length}
            className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-1"><CalendarCheck2 className="w-4 h-4" /> Fechar periodo selecionado</span>
          </button>
          <span className="text-xs text-muted-foreground">Fecha apenas os dias abertos dentro do intervalo escolhido.</span>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <div className="max-h-72 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-muted/95 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Data</th>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                  <th className="text-right font-medium px-3 py-2">Vendas</th>
                  <th className="text-right font-medium px-3 py-2">Compras</th>
                  <th className="text-right font-medium px-3 py-2">Caixa</th>
                </tr>
              </thead>
              <tbody>
                {rangeDays.map((day) => (
                  <tr key={day.date} className="border-t border-border/70">
                    <td className="px-3 py-2">{day.date}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs ${day.status === 'CLOSED' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                        {day.status === 'CLOSED' ? 'Fechado' : 'Aberto'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(day.salesTotal)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(day.purchaseTotal)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(day.cashExpected)}</td>
                  </tr>
                ))}
                {!rangeDays.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      Nenhum dia encontrado no intervalo selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">{error}</p>}
      {feedback && <p className="text-sm text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">{feedback}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 border border-border rounded-xl bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold inline-flex items-center gap-2"><CalendarRange className="w-5 h-5" /> Calendario do mes</h2>
            <span className="text-xs text-muted-foreground">Clique em um dia para ver detalhes</span>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground mb-2">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map((label) => (
              <div key={label} className="py-1">{label}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map((cell, index) => {
              if (!cell) {
                return <div key={`blank-${index}`} className="h-20 rounded-lg border border-transparent" />
              }

              const isSelected = selectedDay?.date === cell.date
              const isClosed = cell.status === 'CLOSED'

              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => handleSelectDay(cell.date)}
                  className={`h-20 rounded-lg border px-2 py-1 text-left transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : isClosed
                        ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15'
                        : 'border-border hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="font-semibold text-sm">{cell.day}</span>
                    <span className={`inline-flex items-center justify-center rounded-full p-1 ${isClosed ? 'bg-emerald-500/15' : 'bg-sky-500/15'}`}>
                      {isClosed ? <CalendarCheck2 className="w-4 h-4 text-emerald-700 drop-shadow-sm" /> : <CalendarClock className="w-4 h-4 text-sky-700 drop-shadow-sm" />}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">{formatCurrency(cell.salesTotal)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{cell.salesCount} venda(s)</p>
                </button>
              )
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="border border-border rounded-xl bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Dia selecionado</h3>
              <span className={`text-xs px-2 py-1 rounded-full ${selectedDay?.status === 'CLOSED' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                {selectedDay?.status === 'CLOSED' ? 'Fechado' : 'Aberto'}
              </span>
            </div>

            {selectedDay ? (
              <>
                <p className="text-sm text-muted-foreground">Data: {selectedDay.date}</p>
                <div className="mt-3 space-y-1 text-sm">
                  <p>Vendas: <strong>{selectedDay.salesCount}</strong> ({formatCurrency(selectedDay.salesTotal)})</p>
                  <p>Compras recebidas: <strong>{selectedDay.purchaseOrdersCount}</strong> ({formatCurrency(selectedDay.purchaseTotal)})</p>
                  <p>Movimento estoque: <strong>{selectedDay.stockBalanceQty}</strong> un.</p>
                  <p>Caixa esperado: <strong>{formatCurrency(selectedDay.cashExpected)}</strong></p>
                </div>

                {(() => {
                  const payments = parsePaymentMethods(selectedDay.notes)
                  if (payments.length > 0) {
                    const total = payments.reduce((sum, p) => sum + p.amount, 0)
                    const paymentLabels: { [key: string]: string } = {
                      'PIX': 'PIX',
                      'DINHEIRO': 'Dinheiro',
                      'CARTÃO DE CRÉDITO': 'Cartão de Crédito',
                      'CARTÃO DE DÉBITO': 'Cartão de Débito',
                    }

                    return (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">FORMAS DE PAGAMENTO</p>
                        <div className="space-y-2">
                          {payments.map((payment) => (
                            <div key={payment.method} className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">{paymentLabels[payment.method] || payment.method}</span>
                              <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center text-sm pt-2 border-t border-border/50 font-semibold">
                            <span>Total</span>
                            <span className="text-emerald-600">{formatCurrency(total)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Observacoes do fechamento diario"
                  className="mt-4 w-full min-h-24 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCloseDay}
                    disabled={isPending || data.month.status === 'CLOSED'}
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-1"><Lock className="w-4 h-4" /> Fechar dia</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleReopenDay}
                    disabled={isPending || data.month.status === 'CLOSED'}
                    className="px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-1"><LockOpen className="w-4 h-4" /> Reabrir dia</span>
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum dia disponivel neste mes.</p>
            )}
          </div>

          <div className="border border-border rounded-xl bg-card p-5 shadow-sm">
            <h3 className="font-semibold mb-2">Fechamento do mes</h3>
            <p className="text-sm text-muted-foreground">Feche o mes somente quando todos os dias estiverem fechados.</p>

            <textarea
              value={monthNotes}
              onChange={(event) => setMonthNotes(event.target.value)}
              placeholder="Observacoes do fechamento mensal"
              className="mt-3 w-full min-h-24 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />

            {monthlyPaymentSummary.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-2">FORMAS DE PAGAMENTO (Mensal)</p>
                <div className="space-y-2">
                  {monthlyPaymentSummary.map((payment) => {
                    const paymentLabels: { [key: string]: string } = {
                      'PIX': 'PIX',
                      'DINHEIRO': 'Dinheiro',
                      'CARTÃO DE CRÉDITO': 'Cartão de Crédito',
                      'CARTÃO DE DÉBITO': 'Cartão de Débito',
                    }
                    return (
                      <div key={payment.method} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{paymentLabels[payment.method] || payment.method}</span>
                        <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                      </div>
                    )
                  })}
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-border/50 font-semibold">
                    <span>Total</span>
                    <span className="text-emerald-600">{formatCurrency(monthlyPaymentSummary.reduce((s, p) => s + p.amount, 0))}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCloseMonth}
                disabled={isPending}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-1"><CalendarCheck2 className="w-4 h-4" /> Fechar mes</span>
              </button>
              <button
                type="button"
                onClick={handleReopenMonth}
                disabled={isPending}
                className="px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Reabrir mes</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
