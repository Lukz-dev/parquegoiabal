#!/usr/bin/env node
const { execSync } = require('child_process')

const envVars = ['DATABASE_URL', 'TURSO_DATABASE_URL', 'LIBSQL_URL', 'DIRECT_URL']
const has = envVars.some((v) => Boolean(process.env[v]))

if (!has) {
  console.log('Skipping Prisma generate: no database URL env variable found.')
  process.exit(0)
}

console.log('Database URL found in environment, running `prisma generate`...')
try {
  execSync('npx prisma generate', { stdio: 'inherit' })
  console.log('Prisma generate completed')
} catch (err) {
  console.error('Prisma generate failed:', err)
  process.exit(1)
}
