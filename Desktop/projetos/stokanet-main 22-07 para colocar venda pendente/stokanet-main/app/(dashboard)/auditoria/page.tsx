import { getAuditLogs } from '@/lib/actions'

export default async function AuditoriaPage() {
  const logs = await getAuditLogs(300)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auditoria</h1>
          <p className="text-sm text-muted-foreground">Historico de eventos sensiveis para seguranca e rastreabilidade.</p>
        </div>
        <a
          href="/api/export/audit"
          className="border border-border hover:bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Exportar auditoria CSV
        </a>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="px-4 py-3 border-b border-border text-sm font-medium">Eventos ({logs.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3">Data</th>
                <th className="p-3">Acao</th>
                <th className="p-3">Entidade</th>
                <th className="p-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                  <td className="p-3">{log.action}</td>
                  <td className="p-3">{log.entity}</td>
                  <td className="p-3 text-muted-foreground">{log.details || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
