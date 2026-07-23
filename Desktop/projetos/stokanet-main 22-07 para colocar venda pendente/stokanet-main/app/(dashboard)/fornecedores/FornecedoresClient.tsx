'use client'

import { useState, useTransition } from 'react'
import { createSupplier, deleteSupplier } from '@/lib/actions'
import { Building2, Plus, Trash2 } from 'lucide-react'

type Supplier = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  contactName?: string | null
  notes?: string | null
}

export function FornecedoresClient({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    contactName: '',
    notes: '',
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    startTransition(async () => {
      try {
        const created = await createSupplier(form)
        setSuppliers((prev) => [created as Supplier, ...prev])
        setForm({ name: '', email: '', phone: '', contactName: '', notes: '' })
        setMessage('Fornecedor criado com sucesso.')
      } catch (error: any) {
        setMessage(error?.message || 'Nao foi possivel criar fornecedor.')
      }
    })
  }

  function handleDelete(id: string) {
    setMessage(null)
    startTransition(async () => {
      try {
        await deleteSupplier(id)
        setSuppliers((prev) => prev.filter((supplier) => supplier.id !== id))
        setMessage('Fornecedor removido.')
      } catch (error: any) {
        setMessage(error?.message || 'Nao foi possivel remover fornecedor.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">Cadastre parceiros para reposicao e compras.</p>
        </div>
        <a
          href="/api/export/suppliers"
          className="border border-border hover:bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Exportar fornecedores CSV
        </a>
      </div>

      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 p-4 border border-border rounded-xl bg-card">
        <input
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Nome do fornecedor"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          required
        />
        <input
          value={form.contactName}
          onChange={(e) => setForm((prev) => ({ ...prev, contactName: e.target.value }))}
          placeholder="Contato"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="Email"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          value={form.phone}
          onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          placeholder="Telefone"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="h-10 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Novo fornecedor
        </button>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder="Observacoes"
          className="md:col-span-2 xl:col-span-5 min-h-[84px] rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </form>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="px-4 py-3 border-b border-border text-sm font-medium">Lista de fornecedores ({suppliers.length})</div>
        <div className="divide-y divide-border">
          {suppliers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum fornecedor cadastrado.</div>
          ) : (
            suppliers.map((supplier) => (
              <div key={supplier.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium flex items-center gap-2"><Building2 className="w-4 h-4" />{supplier.name}</div>
                  <div className="text-sm text-muted-foreground">{supplier.contactName || 'Sem contato definido'}</div>
                  <div className="text-xs text-muted-foreground">{supplier.email || '-'} | {supplier.phone || '-'}</div>
                </div>
                <button
                  onClick={() => handleDelete(supplier.id)}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 text-sm text-destructive hover:underline disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
