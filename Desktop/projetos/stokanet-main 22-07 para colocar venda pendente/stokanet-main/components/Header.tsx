'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { Bell, ChevronDown, LogOut, Search, Settings, UserRound } from 'lucide-react'
import { loadAvatarCached } from '@/lib/client-avatar'

type NotificationLevel = 'critical' | 'warning' | 'info'

type NotificationItem = {
  id: string
  level: NotificationLevel
  title: string
  description: string
  href: string
}

type NotificationsPayload = {
  notifications: NotificationItem[]
  counts: {
    critical: number
    warning: number
    info: number
    total: number
  }
}

const EMPTY_NOTIFICATIONS: NotificationsPayload = {
  notifications: [],
  counts: {
    critical: 0,
    warning: 0,
    info: 0,
    total: 0,
  },
}

export function Header() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [notificationsError, setNotificationsError] = useState('')
  const [notificationsData, setNotificationsData] = useState<NotificationsPayload>(EMPTY_NOTIFICATIONS)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const notificationsRef = useRef<HTMLDivElement | null>(null)
  const userName = session?.user?.name ?? 'Usuário'
  const initials = userName.split(' ').map((name) => name[0]).slice(0, 2).join('').toUpperCase()
  const companyName = (session?.user as any)?.companyName ?? ''
  const userId = (session?.user as any)?.id as string | undefined
  const avatarVersion = (session?.user as any)?.avatarVersion as number | null | undefined
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const loadNotifications = async () => {
    try {
      setNotificationsError('')
      const response = await fetch('/api/notifications', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Falha ao carregar notificações.')
      }
      const payload = (await response.json()) as NotificationsPayload
      setNotificationsData(payload)
    } catch {
      setNotificationsError('Não foi possível carregar os alertas agora.')
    } finally {
      setNotificationsLoading(false)
    }
  }

  useEffect(() => {
    const loadAvatar = async () => {
      if (!userId) return

      try {
        const key = `${userId}:${avatarVersion ?? 0}`
        const nextAvatarUrl = await loadAvatarCached(key)
        setAvatarUrl(nextAvatarUrl)
      } catch {
        setAvatarUrl(null)
      }
    }

    void loadAvatar()
  }, [userId, avatarVersion])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    void loadNotifications()

    const intervalId = setInterval(() => {
      void loadNotifications()
    }, 60_000)

    return () => clearInterval(intervalId)
  }, [])

  const hasNotifications = notificationsData.counts.total > 0
  const notificationCountLabel = notificationsData.counts.total > 99 ? '99+' : String(notificationsData.counts.total)
  const levelClasses: Record<NotificationLevel, string> = {
    critical: 'border-destructive/30 bg-destructive/10 text-destructive',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
    info: 'border-primary/30 bg-primary/10 text-primary',
  }

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between px-8">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center text-lg font-bold">
          StokaNet
        </Link>
        <div className="flex items-center bg-muted/50 rounded-full px-3 py-1.5 w-80 border border-border/50 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
        <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
        <input
          type="text"
          placeholder="Busque por SKU, produto, variação ou categoria..."
          className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground"
        />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen((value) => !value)}
            className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
            aria-label="Abrir notificações"
          >
            <Bell className="w-5 h-5" />
            {hasNotifications && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-5 font-semibold text-center border border-background">
                {notificationCountLabel}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-[calc(100%+0.75rem)] w-[360px] rounded-xl border border-border bg-card shadow-xl shadow-black/10 overflow-hidden z-30">
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <p className="text-sm font-semibold">Notificações</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {notificationsData.counts.critical} críticas • {notificationsData.counts.warning} alertas • {notificationsData.counts.info} informativas
                </p>
              </div>

              <div className="max-h-[420px] overflow-y-auto p-2">
                {notificationsLoading ? (
                  <p className="text-sm text-muted-foreground px-2 py-3">Carregando alertas...</p>
                ) : notificationsError ? (
                  <p className="text-sm text-destructive px-2 py-3">{notificationsError}</p>
                ) : notificationsData.notifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2 py-3">Nenhum aviso no momento.</p>
                ) : (
                  notificationsData.notifications.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setNotificationsOpen(false)}
                      className="block rounded-lg p-3 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold leading-tight">{item.title}</p>
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 border rounded-full ${levelClasses[item.level]}`}>
                          {item.level === 'critical' ? 'Crítico' : item.level === 'warning' ? 'Alerta' : 'Info'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="flex items-center gap-3 pl-3 border-l border-border text-left"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none">{userName}</p>
              {companyName && <p className="text-xs text-muted-foreground mt-0.5">{companyName}</p>}
            </div>
            <div className="w-9 h-9 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-primary font-bold text-sm cursor-pointer hover:bg-primary/30 transition-colors overflow-hidden">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Foto de perfil"
                  width={36}
                  height={36}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <ChevronDown className="hidden sm:block w-4 h-4 text-muted-foreground" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+0.75rem)] w-64 rounded-xl border border-border bg-card shadow-xl shadow-black/10 overflow-hidden z-30">
              <div className="p-4 border-b border-border bg-muted/20">
                <p className="text-sm font-semibold truncate">{userName}</p>
                {companyName && <p className="text-xs text-primary mt-1 font-medium truncate">{companyName}</p>}
              </div>
              <div className="p-2 flex flex-col gap-1">
                <Link
                  href="/perfil"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
                >
                  <UserRound className="w-4 h-4 text-muted-foreground" />
                  Perfil da conta
                </Link>
                <Link
                  href="/configuracoes"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
                >
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  Configurações
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da conta
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
