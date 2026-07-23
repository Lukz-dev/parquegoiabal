'use client'

import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminResetPasswordButton } from '@/components/AdminResetPasswordButton'
import { CheckCircle2, PencilLine, Plus, Search, Trash2, X } from 'lucide-react'

type Employee = {
  id: string
  name: string | null
  email: string
  role: string
  isApproved: boolean
  createdAt: string
}

export function ChefeEmployeesClient({ employees: initialEmployees }: { employees: Employee[] }) {
  const router = useRouter()
  const [employees, setEmployees] = useState(initialEmployees)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [editForm, setEditForm] = useState({ id: '', name: '', email: '' })
  const [editOpen, setEditOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((employee) => {
      return (
        (employee.name ?? '').toLowerCase().includes(q) ||
        employee.email.toLowerCase().includes(q) ||
        employee.role.toLowerCase().includes(q)
      )
    })
  }, [employees, query])

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    } catch {
      return value
    }
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/chefe/funcionarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível criar o funcionário.')
      }

      setForm({ name: '', email: '', password: '' })
      setMessage(payload.tempPassword ? `Funcionário criado. Senha temporária: ${payload.tempPassword}` : 'Funcionário criado com sucesso.')
      router.refresh()
      const refreshed = await fetch('/api/chefe/funcionarios', { cache: 'no-store' }).then((res) => res.json())
      if (Array.isArray(refreshed.employees)) {
        setEmployees(refreshed.employees.map((employee: any) => ({
          id: employee.id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          isApproved: employee.isApproved,
          createdAt: employee.createdAt,
        })))
      }
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Erro ao criar funcionário.')
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (employee: Employee) => {
    setEditForm({ id: employee.id, name: employee.name ?? '', email: employee.email })
    setError('')
    setMessage('')
    setEditOpen(true)
  }

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setEditLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch(`/api/chefe/funcionarios/${editForm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editForm.name, email: editForm.email }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível editar o funcionário.')
      }

      setEmployees((current) => current.map((employee) => employee.id === editForm.id ? {
        ...employee,
        name: payload.employee.name,
        email: payload.employee.email,
      } : employee))
      setEditOpen(false)
      setMessage('Funcionário atualizado com sucesso.')
      router.refresh()
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Erro ao editar funcionário.')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async (employee: Employee) => {
    const confirmed = window.confirm(`Excluir ${employee.name ?? employee.email}? Esta ação não pode ser desfeita.`)
    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      const response = await fetch(`/api/chefe/funcionarios/${employee.id}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível excluir o funcionário.')
      }

      setEmployees((current) => current.filter((item) => item.id !== employee.id))
      setMessage('Funcionário excluído com sucesso.')
      router.refresh()
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Erro ao excluir funcionário.')
    }
  }

  const toggleApproval = async (userId: string) => {
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/chefe/funcionarios/${userId}/approval`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível alterar o acesso.')
      }

      setEmployees((current) => current.map((employee) => employee.id === userId ? { ...employee, isApproved: payload.isApproved } : employee))
      setMessage(payload.isApproved ? 'Acesso liberado.' : 'Acesso revogado.')
      router.refresh()
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Erro ao alterar acesso.')
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border px-6 py-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Equipe</p>
          <h2 className="mt-2 text-xl font-bold">Funcionários da empresa</h2>
          <p className="text-sm text-muted-foreground">Crie contas de funcionários, redefina senhas e libere ou revogue o acesso.</p>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar funcionário"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[380px_1fr]">
        <form onSubmit={handleCreate} className="border-b border-border p-6 lg:border-b-0 lg:border-r space-y-4 bg-muted/10">
          <div>
            <h3 className="text-lg font-semibold">Adicionar funcionário</h3>
            <p className="text-sm text-muted-foreground">O funcionário será vinculado à sua empresa e terá acesso operacional.</p>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nome</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Maria Silva"
              required
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">E-mail</span>
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="maria@suaempresa.com"
              type="email"
              required
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Senha temporária</span>
            <input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Deixe em branco para gerar"
              minLength={8}
              type="password"
            />
          </label>

          {error && <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">{error}</p>}
          {message && (
            <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" />
              <span>{message}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {loading ? 'Criando...' : 'Adicionar funcionário'}
          </button>
        </form>

        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Lista de funcionários</h3>
            <span className="text-sm text-muted-foreground">{filtered.length} encontrados</span>
          </div>

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhum funcionário encontrado.
              </div>
            ) : (
              filtered.map((employee) => (
                <div key={employee.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/25 transition-colors">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{employee.name ?? 'Sem nome'}</p>
                      <p className="text-sm text-muted-foreground">{employee.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Criado em {formatDate(employee.createdAt)}</p>
                    </div>

                    <div className="flex flex-col gap-2 lg:items-end">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${employee.isApproved ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700' : 'border-amber-500/20 bg-amber-500/10 text-amber-700'}`}>
                        {employee.isApproved ? 'Acesso liberado' : 'Pendente'}
                      </span>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleApproval(employee.id)}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${employee.isApproved ? 'bg-rose-500/10 text-rose-700 hover:bg-rose-500/20' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                        >
                          {employee.isApproved ? 'Revogar acesso' : 'Liberar acesso'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(employee)}
                          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted transition-colors"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <AdminResetPasswordButton
                          userId={employee.id}
                          userEmail={employee.email}
                          endpoint={`/api/chefe/funcionarios/${employee.id}/reset-password`}
                        />
                        <button
                          type="button"
                          onClick={() => handleDelete(employee)}
                          className="inline-flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-500/20 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Editar funcionário</p>
                <h3 className="mt-1 text-xl font-bold">Atualizar dados de acesso</h3>
              </div>
              <button type="button" onClick={() => setEditOpen(false)} className="rounded-full border border-border p-2 hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Nome</span>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  required
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">E-mail</span>
                <input
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  type="email"
                  required
                />
              </label>

              {error && <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">{error}</p>}
              {message && <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">{message}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={editLoading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                  {editLoading ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
