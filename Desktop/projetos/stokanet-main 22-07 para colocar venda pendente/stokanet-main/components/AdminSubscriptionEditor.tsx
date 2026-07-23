 'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateUserSubscription } from '@/lib/admin'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

type SubscriptionData = {
  id: string
  status: string
  planType: 'MONTHLY' | 'ANNUAL'
  amount: number
  autoRenew: boolean
} | null

type Props = {
  userId: string
  userEmail: string
  subscription: SubscriptionData
  userActivePlan?: 'MONTHLY' | 'ANNUAL' | null
}

export function AdminSubscriptionEditor({ userId, userEmail, subscription, userActivePlan: initialUserActivePlan }: Props) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
    // Keep hooks at top-level to avoid conditional hook calls
    const [newForm, setNewForm] = useState({
      planType: subscription?.planType || 'MONTHLY',
      billingMode: (subscription as any)?.billingMode || 'ONE_TIME',
      amount: subscription?.amount || 100,
      autoRenew: subscription?.autoRenew || false,
    })

    const [inlinePlan, setInlinePlan] = useState(subscription?.planType || 'MONTHLY')
    const [inlineBilling, setInlineBilling] = useState((subscription as any)?.billingMode || 'ONE_TIME')
    const [inlineAmount, setInlineAmount] = useState(subscription?.amount || 100)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    status: (subscription?.status || 'PENDING') as 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED',
    planType: subscription?.planType || 'MONTHLY',
    billingMode: (subscription as any)?.billingMode || 'ONE_TIME',
    amount: subscription?.amount || 100,
    autoRenew: subscription?.autoRenew || false,
  })

  const [userActivePlan, setUserActivePlan] = useState((initialUserActivePlan ?? (subscription as any)?.planType) || null)
  const [settingActivePlan, setSettingActivePlan] = useState(false)
  const [activePlanMessage, setActivePlanMessage] = useState('')

  const handleSave = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await updateUserSubscription(userId, formData)
      setSuccess('Assinatura atualizada com sucesso')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar assinatura')
    } finally {
      setLoading(false)
    }
  }
  let content = null

  const handleCreate = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const { createUserSubscription } = await import('@/lib/admin')
      await createUserSubscription(userId, {
        planType: newForm.planType as 'MONTHLY' | 'ANNUAL',
        billingMode: newForm.billingMode as 'ONE_TIME' | 'RECURRING',
        amount: newForm.amount,
        autoRenew: newForm.autoRenew,
      })
      setSuccess('Plano criado com sucesso')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar plano')
    } finally {
      setLoading(false)
    }
  }

  const handleSetUserActivePlan = async () => {
    setSettingActivePlan(true)
    setActivePlanMessage('')
    try {
      const { setUserActivePlan } = await import('@/lib/admin')
      await setUserActivePlan(userId, userActivePlan ?? null)
      setActivePlanMessage('Plano do usuário atualizado')
      try { router.refresh() } catch {}
      setTimeout(() => setActivePlanMessage(''), 3000)
    } catch (err) {
      setActivePlanMessage(err instanceof Error ? err.message : 'Erro ao definir plano do usuário')
    } finally {
      setSettingActivePlan(false)
    }
  }

  if (!subscription) {
    content = (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Plano do usuário</label>
          <select value={userActivePlan ?? ''} onChange={(e) => setUserActivePlan(e.target.value as any)} className="px-2 py-1 rounded border border-border bg-background text-sm">
            <option value="">Nenhum</option>
            <option value="MONTHLY">Mensal</option>
            <option value="ANNUAL">Anual</option>
          </select>
          <button onClick={handleSetUserActivePlan} disabled={settingActivePlan} className="text-xs rounded px-2 py-1 bg-primary text-primary-foreground">{settingActivePlan ? 'Salvando...' : 'Definir'}</button>
          {activePlanMessage && <p className="text-xs text-foreground">{activePlanMessage}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block text-muted-foreground mb-1">Plano</label>
            <select name="planType" value={newForm.planType} onChange={(e) => setNewForm({ ...newForm, planType: e.target.value as 'MONTHLY' | 'ANNUAL' })} className="w-full px-2 py-1 rounded border border-border bg-background text-sm">
              <option value="MONTHLY">Mensal</option>
              <option value="ANNUAL">Anual</option>
            </select>
          </div>

          <div>
            <label className="block text-muted-foreground mb-1">Cobrança</label>
            <select name="billingMode" value={newForm.billingMode} onChange={(e) => setNewForm({ ...newForm, billingMode: e.target.value })} className="w-full px-2 py-1 rounded border border-border bg-background text-sm">
              <option value="ONE_TIME">Cobrança única</option>
              <option value="RECURRING">Recorrente</option>
            </select>
          </div>

          <div>
            <label className="block text-muted-foreground mb-1">Valor (R$)</label>
            <input name="amount" type="number" step="0.01" value={newForm.amount} onChange={(e) => setNewForm({ ...newForm, amount: parseFloat(e.target.value || '0') })} className="w-full px-2 py-1 rounded border border-border bg-background text-sm" />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input name="autoRenew" type="checkbox" checked={newForm.autoRenew} onChange={(e) => setNewForm({ ...newForm, autoRenew: e.target.checked })} className="rounded" />
              <span className="text-muted-foreground">Renovação automática</span>
            </label>
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
        {success && <p className="text-xs text-emerald-600">{success}</p>}

        <div className="flex gap-2">
          <button onClick={handleCreate} disabled={loading} className="text-xs rounded px-2 py-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">{loading ? 'Criando...' : 'Criar plano'}</button>
        </div>
      </div>
    )
  } else if (!isEditing) {
    // re-use top-level inline state: inlinePlan, inlineBilling, inlineAmount
    const handleInlineSave = async () => {
      setLoading(true)
      setError('')
      setSuccess('')
      try {
        const payload: any = {
          planType: inlinePlan as 'MONTHLY' | 'ANNUAL',
          billingMode: inlineBilling as 'ONE_TIME' | 'RECURRING',
        }
        // If the admin kept the same plan type, send the explicit amount
        if (inlinePlan === subscription.planType) {
          payload.amount = inlineAmount
        }
        await updateUserSubscription(userId, payload)
        setSuccess('Assinatura atualizada com sucesso')
        setTimeout(() => setSuccess(''), 3000)
        try { router.refresh() } catch {}
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao atualizar assinatura')
      } finally {
        setLoading(false)
      }
    }
    content = (
      <div className="space-y-2">
        <div className="text-xs space-y-1">
          <p><span className="text-muted-foreground">Status:</span> <span className="font-medium">{subscription.status}</span></p>
          <p>Plano atual: <span className="font-medium">{subscription.planType === 'MONTHLY' ? 'Mensal' : 'Anual'}</span></p>
          <p><span className="text-muted-foreground">Cobrança:</span> <span className="font-medium">{(subscription as any).billingMode === 'RECURRING' ? 'Recorrente' : 'Cobrança única'}</span></p>
          <p><span className="text-muted-foreground">Valor:</span> <span className="font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subscription.amount)}</span></p>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="text-xs rounded px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          Editar
        </button>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <select name="planType" value={inlinePlan} onChange={(e) => setInlinePlan(e.target.value as 'MONTHLY' | 'ANNUAL')} className="px-2 py-1 rounded border border-border bg-background text-sm">
            <option value="MONTHLY">Mensal</option>
            <option value="ANNUAL">Anual</option>
          </select>
          <select name="billingMode" value={inlineBilling} onChange={(e) => setInlineBilling(e.target.value)} className="px-2 py-1 rounded border border-border bg-background text-sm">
            <option value="ONE_TIME">Cobrança única</option>
            <option value="RECURRING">Recorrente</option>
          </select>
          <button onClick={handleInlineSave} className="text-xs rounded px-2 py-1 bg-primary text-primary-foreground hover:bg-primary/90">Salvar plano</button>
        </div>
      </div>
    )
  }
  else {
    content = (
      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block text-muted-foreground mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' })}
              className="w-full px-2 py-1 rounded border border-border bg-background text-sm"
            >
              <option value="PENDING">Pendente</option>
              <option value="ACTIVE">Ativo</option>
              <option value="EXPIRED">Expirado</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="block text-muted-foreground mb-1">Plano</label>
            <select
              name="planType"
              value={formData.planType}
              onChange={(e) => setFormData({ ...formData, planType: e.target.value as 'MONTHLY' | 'ANNUAL' })}
              className="w-full px-2 py-1 rounded border border-border bg-background text-sm"
            >
              <option value="MONTHLY">Mensal</option>
              <option value="ANNUAL">Anual</option>
            </select>
          </div>

          <div>
            <label className="block text-muted-foreground mb-1">Valor (R$)</label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              step="0.01"
              className="w-full px-2 py-1 rounded border border-border bg-background text-sm"
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoRenew}
                onChange={(e) => setFormData({ ...formData, autoRenew: e.target.checked })}
                className="rounded"
              />
              <span className="text-muted-foreground">Renovação automática</span>
            </label>
          </div>
          <div>
            <label className="block text-muted-foreground mb-1">Cobrança</label>
            <select name="billingMode" value={formData.billingMode as 'ONE_TIME' | 'RECURRING'} onChange={(e) => setFormData({ ...formData, billingMode: e.target.value as 'ONE_TIME' | 'RECURRING' })} className="w-full px-2 py-1 rounded border border-border bg-background text-sm">
              <option value="ONE_TIME">Cobrança única</option>
              <option value="RECURRING">Recorrente</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1 flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            {error}
          </p>
        )}

        {success && (
          <p className="text-xs text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1 flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3" />
            {success}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 text-xs rounded px-2 py-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {loading ? 'Salvando...' : 'Salvar plano'}
          </button>
          <button
            onClick={() => setIsEditing(false)}
            disabled={loading}
            className="flex-1 text-xs rounded px-2 py-1 bg-muted text-foreground hover:bg-muted/80 transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Plano do usuário</label>
        <select value={userActivePlan ?? ''} onChange={(e) => setUserActivePlan(e.target.value as any)} className="px-2 py-1 rounded border border-border bg-background text-sm">
          <option value="">Nenhum</option>
          <option value="MONTHLY">Mensal</option>
          <option value="ANNUAL">Anual</option>
        </select>
        <button onClick={handleSetUserActivePlan} disabled={settingActivePlan} className="text-xs rounded px-2 py-1 bg-primary text-primary-foreground">{settingActivePlan ? 'Salvando...' : 'Definir'}</button>
        {activePlanMessage && <p className="text-xs text-foreground ml-2">{activePlanMessage}</p>}
      </div>

      {content}
    </div>
  )
}
