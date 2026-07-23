const fs = require('fs')
const path = require('path')
const envPath = path.resolve(__dirname, '..', '.env')
const env = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).reduce((acc, l) => {
  const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m) {
    acc[m[1]] = m[2].replace(/^\"|\"$/g, '').replace(/^'|'$/g, '')
  }
  return acc
}, {})

if (!env.DATABASE_URL) {
  console.error('DATABASE_URL not found in .env')
  process.exit(1)
}
process.env.DATABASE_URL = env.DATABASE_URL

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

;(async () => {
  try {
    const res = await prisma.$queryRawUnsafe("SELECT DISTINCT t.typname FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname ILIKE 'plan%';")
    console.log('ENUM_CHECK_RESULT:', JSON.stringify(res, null, 2))
  } catch (e) {
    console.error('ERROR', e.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
})()
