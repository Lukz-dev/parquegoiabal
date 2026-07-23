import NextAuth, { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'E-mail Corporativo',
      credentials: {
        email: { label: 'E-mail', type: 'email', placeholder: 'seu@email.com' },
        password: { label: 'Senha', type: 'password' },
        rememberLogin: { label: 'Manter conectado', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { company: true },
        })

        if (!user) return null

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
        if (!isPasswordValid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isApproved: user.isApproved,
          isSystemAdmin: user.isSystemAdmin,
          companyId: user.companyId,
          companyName: user.company?.name ?? null,
          rememberLogin: credentials.rememberLogin === 'true',
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
        token.isApproved = (user as any).isApproved
        token.isSystemAdmin = (user as any).isSystemAdmin
        token.companyId = (user as any).companyId
        token.companyName = (user as any).companyName
        ;(token as any).rememberLogin = (user as any).rememberLogin === true
        ;(token as any).authExpiresAt = Date.now() + ((user as any).rememberLogin === true ? 30 : 1) * 24 * 60 * 60 * 1000
        ;(token as any).avatarVersion = Date.now()
      }

      if (trigger === 'update' && session) {
        if (typeof (session as any).name === 'string') token.name = (session as any).name
        if (typeof (session as any).email === 'string') token.email = (session as any).email
        if (typeof (session as any).companyName === 'string') (token as any).companyName = (session as any).companyName
        if (typeof (session as any).avatarVersion === 'number') (token as any).avatarVersion = (session as any).avatarVersion
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = (token as any).id
        ;(session.user as any).role = (token as any).role
        ;(session.user as any).isApproved = (token as any).isApproved
        ;(session.user as any).isSystemAdmin = (token as any).isSystemAdmin
        ;(session.user as any).companyId = (token as any).companyId
        ;(session.user as any).companyName = (token as any).companyName
        ;(session.user as any).rememberLogin = (token as any).rememberLogin ?? false
        ;(session.user as any).authExpiresAt = (token as any).authExpiresAt ?? null
        ;(session.user as any).avatarVersion = (token as any).avatarVersion ?? null
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }