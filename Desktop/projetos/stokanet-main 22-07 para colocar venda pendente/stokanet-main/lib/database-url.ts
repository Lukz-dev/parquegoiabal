export function resolveDatabaseUrl() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    process.env.DIRECT_URL ??
    null

  return databaseUrl?.trim() || null
}
