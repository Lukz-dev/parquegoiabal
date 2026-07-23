'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Building2, Clock3, KeyRound, Mail, Shield, Store, UserRound, ArrowRight, LockKeyhole, Camera, Trash2, Palette, Check } from 'lucide-react'
import { changePassword, updateAccountProfile, updateThemePreference } from '@/lib/actions'
import { THEME_ATTRIBUTE_MAP, type ThemePreference } from '@/lib/theme'

type UserData = {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  themePreference: ThemePreference
  role: string
  createdAt: string
  updatedAt: string
}

type CompanyData = {
  id: string
  name: string
  defaultMinStock: number
  createdAt: string
}

type SubscriptionData = {
  planType: 'MONTHLY' | 'ANNUAL'
  billingMode: 'ONE_TIME' | 'RECURRING'
  status: string
  nextBillingDate: string | null
  expiresAt: string | null
  autoRenew: boolean
} | null

interface Props {
  user: UserData
  company: CompanyData
  subscription: SubscriptionData
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function PerfilClient({ user, company, subscription }: Props) {
  const router = useRouter()
  const { update: updateSession } = useSession()
  const [profilePending, startProfileTransition] = useTransition()
  const [passwordPending, startPasswordTransition] = useTransition()
  const [avatarPending, startAvatarTransition] = useTransition()
  const [themePending, startThemeTransition] = useTransition()
  const [profileError, setProfileError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [themePreference, setThemePreference] = useState<ThemePreference>(user.themePreference)
  const [profileForm, setProfileForm] = useState({
    name: user.name ?? '',
    email: user.email,
    companyName: company.name,
    avatarUrl: user.avatarUrl ?? '',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const handleProfileSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setProfileError('')
    setProfileSuccess('')

    startProfileTransition(async () => {
      try {
        await updateAccountProfile(profileForm)
        await updateSession({
          name: profileForm.name,
          email: profileForm.email,
          companyName: profileForm.companyName,
        })
        setProfileSuccess('Perfil atualizado. Faça login novamente se o e-mail foi alterado.')
        router.refresh()
      } catch (error: any) {
        setProfileError(error.message || 'Não foi possível atualizar o perfil.')
      }
    })
  }

  const handlePasswordSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('A confirmação da nova senha não confere.')
      return
    }

    startPasswordTransition(async () => {
      try {
        await changePassword({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        })
        setPasswordSuccess('Senha alterada com sucesso.')
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } catch (error: any) {
        setPasswordError(error.message || 'Não foi possível alterar a senha.')
      }
    })
  }

  const saveAvatarUrl = (avatarUrl: string | null, successMessage: string) => {
    setProfileError('')
    setProfileSuccess('')
    startAvatarTransition(async () => {
      try {
        await updateAccountProfile({
          name: profileForm.name,
          email: profileForm.email,
          companyName: profileForm.companyName,
          avatarUrl,
        })
        setProfileForm((current) => ({ ...current, avatarUrl: avatarUrl ?? '' }))
        await updateSession({
          name: profileForm.name,
          email: profileForm.email,
          companyName: profileForm.companyName,
          avatarVersion: Date.now(),
        })
        setProfileSuccess(successMessage)
        router.refresh()
      } catch (error: any) {
        setProfileError(error.message || 'Não foi possível atualizar a foto.')
      }
    })
  }

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setProfileError('Selecione uma imagem válida.')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setProfileError('A imagem deve ter no máximo 2 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result) {
        saveAvatarUrl(reader.result, 'Foto de perfil atualizada com sucesso.')
      }
    }
    reader.readAsDataURL(file)
  }

  const handleAvatarRemove = () => {
    saveAvatarUrl(null, 'Foto de perfil removida.')
  }

  const themeOptions: Array<{ value: ThemePreference; label: string; description: string; swatch: string }> = [
    { value: 'SUNSET', label: 'Sunset', description: 'Laranja quente (padrão)', swatch: 'bg-[#e0a15f]' },
    { value: 'OCEAN', label: 'Ocean', description: 'Azul profundo e frio', swatch: 'bg-[#3f8fbf]' },
    { value: 'FOREST', label: 'Forest', description: 'Verde sóbrio', swatch: 'bg-[#5f9a58]' },
    { value: 'ROSE', label: 'Rose', description: 'Rosa elegante', swatch: 'bg-[#cf6f7a]' },
  ]

  const applyThemeToDocument = (value: ThemePreference) => {
    document.documentElement.setAttribute('data-theme-color', THEME_ATTRIBUTE_MAP[value])
  }

  const handleThemePreferenceChange = (nextTheme: ThemePreference) => {
    if (nextTheme === themePreference || themePending) return

    const previousTheme = themePreference
    setProfileError('')
    setProfileSuccess('')
    setThemePreference(nextTheme)
    applyThemeToDocument(nextTheme)

    startThemeTransition(async () => {
      try {
        await updateThemePreference(nextTheme)
        setProfileSuccess('Tema do layout atualizado com sucesso.')
        router.refresh()
      } catch (error: any) {
        setThemePreference(previousTheme)
        applyThemeToDocument(previousTheme)
        setProfileError(error.message || 'Não foi possível atualizar o tema.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
            <UserRound className="w-3.5 h-3.5 text-primary" />
            Área da conta
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Perfil e segurança</h1>
          <p className="text-muted-foreground mt-1 text-lg">Edite seus dados, o nome da empresa e a senha de acesso.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/estoque" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
            <Store className="w-4 h-4" />
            Ir para o estoque
          </Link>
          <Link href="/configuracoes" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            Configurações da loja
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-card border border-border rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold">Dados da conta</h2>
                <p className="text-sm text-muted-foreground">Nome, e-mail e identidade da empresa.</p>
              </div>
              <Shield className="w-5 h-5 text-primary" />
            </div>

            <div className="mb-6 rounded-2xl border border-border bg-muted/20 p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-2xl border border-border bg-background overflow-hidden flex items-center justify-center shrink-0">
                  {profileForm.avatarUrl ? (
                    <Image
                      src={profileForm.avatarUrl}
                      alt="Foto de perfil"
                      width={80}
                      height={80}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-semibold text-xl">
                      {user.name ? user.name.split(' ').map((item) => item[0]).slice(0, 2).join('').toUpperCase() : 'U'}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium">Foto de perfil</p>
                  <p className="text-sm text-muted-foreground">Envie uma imagem do seu computador para personalizar sua conta.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
                  <Camera className="w-4 h-4" />
                  Escolher imagem
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={avatarPending}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  disabled={avatarPending || !profileForm.avatarUrl}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-60"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover
                </button>
              </div>
            </div>

            <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleProfileSubmit}>
              {profileError && <p className="md:col-span-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">{profileError}</p>}
              {profileSuccess && <p className="md:col-span-2 text-sm text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">{profileSuccess}</p>}

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Nome</span>
                <span className="relative">
                  <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={profileForm.name}
                    onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="Seu nome"
                  />
                </span>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">E-mail</span>
                <span className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="seu@email.com"
                  />
                </span>
              </label>

              <label className="flex flex-col gap-2 md:col-span-2">
                <span className="text-sm font-medium">Nome da empresa</span>
                <span className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={profileForm.companyName}
                    onChange={(event) => setProfileForm((current) => ({ ...current, companyName: event.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="Nome da loja"
                  />
                </span>
              </label>

              <input type="hidden" value={profileForm.avatarUrl} readOnly />

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={profilePending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {profilePending ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </section>

          <section className="bg-card border border-border rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold">Segurança</h2>
                <p className="text-sm text-muted-foreground">Troque a senha de acesso quando precisar.</p>
              </div>
              <LockKeyhole className="w-5 h-5 text-primary" />
            </div>

            <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={handlePasswordSubmit}>
              {passwordError && <p className="md:col-span-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">{passwordError}</p>}
              {passwordSuccess && <p className="md:col-span-3 text-sm text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">{passwordSuccess}</p>}

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Senha atual</span>
                <span className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="Senha atual"
                  />
                </span>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Nova senha</span>
                <span className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="Nova senha"
                  />
                </span>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Confirmar nova senha</span>
                <span className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="Confirme a senha"
                  />
                </span>
              </label>

              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={passwordPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-60"
                >
                  {passwordPending ? 'Alterando...' : 'Alterar senha'}
                </button>
              </div>
            </form>
          </section>

          <section className="bg-card border border-border rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold">Aparência</h2>
                <p className="text-sm text-muted-foreground">Escolha a cor principal do layout para a sua conta.</p>
              </div>
              <Palette className="w-5 h-5 text-primary" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {themeOptions.map((option) => {
                const isActive = option.value === themePreference

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={themePending}
                    onClick={() => handleThemePreferenceChange(option.value)}
                    className={`w-full rounded-xl border p-4 text-left transition-all disabled:opacity-60 ${
                      isActive
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                        : 'border-border bg-background hover:border-primary/40 hover:bg-muted/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`h-8 w-8 rounded-full border border-white/15 ${option.swatch}`} />
                        <span>
                          <p className="text-sm font-semibold">{option.label}</p>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </span>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-primary mt-0.5" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-card border border-border rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold">Plano atual</h2>
                <p className="text-sm text-muted-foreground">Resumo da assinatura da empresa.</p>
              </div>
              <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {subscription?.status ?? 'SEM PLANO'}
              </div>
            </div>

            {subscription ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Plano</p>
                  <p className="mt-1 text-lg font-semibold">
                    {subscription.planType === 'MONTHLY' ? 'Mensal' : 'Anual'}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 border border-border/50 p-3">
                    <span className="text-muted-foreground">Cobrança</span>
                    <span className="font-medium">
                      {subscription.billingMode === 'RECURRING' ? 'Recorrente' : 'Única'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 border border-border/50 p-3">
                    <span className="text-muted-foreground">Próxima cobrança</span>
                    <span className="font-medium">{formatDate(subscription.nextBillingDate)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 border border-border/50 p-3">
                    <span className="text-muted-foreground">Expira em</span>
                    <span className="font-medium">{formatDate(subscription.expiresAt)}</span>
                  </div>
                </div>

                <Link
                  href="/plans?source=manage"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Trocar plano
                </Link>

                <Link
                  href="/subscription"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
                >
                  Gerenciar assinatura
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Nenhum plano ativo encontrado para esta empresa.
                </p>
                <Link
                  href="/plans?source=manage"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Ver planos
                </Link>
              </div>
            )}
          </section>

          <section className="bg-card border border-border rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Resumo</h2>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 border border-border/50 p-3">
                <span className="text-muted-foreground">Função</span>
                <span className="font-semibold uppercase text-xs tracking-wide">{user.role}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 border border-border/50 p-3">
                <span className="text-muted-foreground">Criado em</span>
                <span className="font-medium">{new Intl.DateTimeFormat('pt-BR').format(new Date(user.createdAt))}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 border border-border/50 p-3">
                <span className="text-muted-foreground">Empresa</span>
                <span className="font-medium truncate max-w-[140px] text-right">{company.name}</span>
              </div>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Acesso rápido</h2>
            <div className="space-y-2">
              <Link href="/estoque" className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm hover:bg-muted transition-colors">
                <span>Ver produtos e variações</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </Link>
              <Link href="/movimentacoes" className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm hover:bg-muted transition-colors">
                <span>Ver reposições</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </Link>
              <Link href="/configuracoes" className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm hover:bg-muted transition-colors">
                <span>Configurações da loja</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Última atualização</h2>
            <div className="flex items-center gap-3 rounded-lg bg-muted/20 border border-border/50 p-3 text-sm">
              <Clock3 className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(user.updatedAt))}</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}