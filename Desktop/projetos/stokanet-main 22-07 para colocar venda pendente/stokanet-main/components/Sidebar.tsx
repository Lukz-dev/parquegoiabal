'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Package, LayoutDashboard, ArrowRightLeft, Box, Building2, UserRound, Settings, ScanLine, Truck, ClipboardList, BarChart3, ShieldCheck, LogOut, CalendarCheck2, Receipt, BadgeDollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { loadAvatarCached } from '@/lib/client-avatar'

const navItems = [
  { name: 'Visão geral', href: '/', icon: LayoutDashboard },
  { name: 'Produtos', href: '/estoque', icon: Package },
  { name: 'Caixa', href: '/caixa', icon: ScanLine },
  { name: 'Vendas', href: '/vendas', icon: Receipt },
  { name: 'Fornecedores', href: '/fornecedores', icon: Truck },
  { name: 'Compras', href: '/compras', icon: ClipboardList },
  { name: 'Fechamento', href: '/fechamento', icon: CalendarCheck2 },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3 },
  { name: 'Auditoria', href: '/auditoria', icon: ShieldCheck },
  { name: 'Reposições', href: '/movimentacoes', icon: ArrowRightLeft },
  { name: 'Perfil', href: '/perfil', icon: UserRound },
  { name: 'Assinatura', href: '/subscription', icon: BadgeDollarSign },
  { name: 'Configurações', href: '/configuracoes', icon: Settings, adminOnly: true },
  { name: 'Painel Admin', href: '/admin', icon: ShieldCheck, systemAdminOnly: true },
]

export function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const companyName = (session?.user as any)?.companyName ?? 'Minha Empresa'
  const role = (session?.user as any)?.role ?? 'OPERATOR'
  const isSystemAdmin = (session?.user as any)?.isSystemAdmin === true
  const userName = session?.user?.name ?? 'Usuário'
  const userEmail = session?.user?.email ?? ''
  const userId = (session?.user as any)?.id as string | undefined
  const avatarVersion = (session?.user as any)?.avatarVersion as number | null | undefined
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const initials = userName.split(' ').map((name) => name[0]).slice(0, 2).join('').toUpperCase()

  useEffect(() => {
    if (!userId) return

    const loadAvatar = async () => {
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

  return (
    <aside className="w-64 border-r border-border bg-card/80 backdrop-blur-md flex flex-col h-screen fixed top-0 left-0 z-20">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
        <div className="w-8 h-8 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center mr-3">
          <Box className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <span className="text-sm font-bold tracking-tight block">StokaNet</span>
          <span className="text-xs text-muted-foreground truncate block">Controle de estoque para qualquer loja</span>
        </div>
      </div>

      {/* Empresa badge */}
      <div className="mx-4 mt-4 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground truncate">{companyName}</span>
      </div>

      <div className="mx-4 mt-3 px-3 py-2 rounded-lg border border-primary/20 bg-primary/10 flex items-center gap-2">
        <Package className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs text-foreground font-medium truncate">Produtos, variações e reposição</span>
      </div>

      {/* Navegação */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <p className="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operação</p>
        <nav className="flex flex-col gap-1">
          {navItems
            .filter((item) => !item.adminOnly || role === 'ADMIN' || role === 'MANAGER')
            .filter((item) => !item.systemAdminOnly || isSystemAdmin)
            .map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("w-4 h-4 transition-transform", !isActive && "group-hover:scale-110")} />
                {item.name}
              </Link>
            )
            })}
        </nav>
      </div>

      {/* Usuário + Logout */}
      <div className="p-3 border-t border-border space-y-2 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0 overflow-hidden">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Foto de perfil"
                width={32}
                height={32}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
        </div>
        <button
          id="btn-logout"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10 group"
        >
          <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
          Sair da conta
        </button>
      </div>
    </aside>
  )
}
