import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export default async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const pathname = req.nextUrl.pathname

  if (process.env.NODE_ENV !== 'production' && pathname === '/api/test/setup') {
    return NextResponse.next()
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const isApproved = token.isApproved === true || token.isSystemAdmin === true
  const isSystemAdmin = token.isSystemAdmin === true
  const isAdmin = isSystemAdmin || String(token.role ?? 'OPERATOR') === 'ADMIN'

  // Allow non-approved users to access public subscription and plans pages
  const allowedForPending = pathname.startsWith('/plans') || pathname.startsWith('/subscription') || pathname.startsWith('/api/subscription')

  if (!isApproved && !allowedForPending && pathname !== '/pending') {
    return NextResponse.redirect(new URL('/pending', req.url))
  }

  if (pathname.startsWith('/admin') && !isAdmin) {
    return NextResponse.redirect(new URL('/pending', req.url))
  }

  if (pathname.startsWith('/configuracoes')) {
    const role = String(token.role ?? 'OPERATOR')
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api/auth|login|signup|_next/static|_next/image|favicon.ico).*)',
  ],
}

