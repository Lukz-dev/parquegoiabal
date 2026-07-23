import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const companyName = body.name || 'Test Company'
  const timestamp = Date.now()
  const email = body.email || `e2e-${timestamp}@example.com`
  const password = body.password || `Test1234!${String(timestamp).slice(-4)}`

  const hashedPassword = await bcrypt.hash(password, 12)

  const company = await prisma.company.create({ data: { name: companyName } })
  const user = await prisma.user.create({
    data: {
      name: body.userName || 'E2E Admin',
      email,
      password: hashedPassword,
      role: 'ADMIN',
      isApproved: true,
      isSystemAdmin: true,
      companyId: company.id,
    },
  })

  return new Response(JSON.stringify({ companyId: company.id, email: user.email, password }), {
    status: 201,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}