import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      role?: string
      isApproved?: boolean
      isSystemAdmin?: boolean
      companyId?: string | null
      companyName?: string | null
      rememberLogin?: boolean
      authExpiresAt?: number | null
      avatarVersion?: number | null
    } & DefaultSession['user']
  }

  interface User {
    id: string
    role?: string
    isApproved?: boolean
    isSystemAdmin?: boolean
    companyId?: string | null
    companyName?: string | null
    rememberLogin?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string
    isApproved?: boolean
    isSystemAdmin?: boolean
    companyId?: string | null
    companyName?: string | null
    rememberLogin?: boolean
    authExpiresAt?: number | null
    avatarVersion?: number | null
  }
}

export {}
