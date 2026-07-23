export type AppRole = 'ADMIN' | 'MANAGER' | 'OPERATOR'

export function isBossRole(role?: string | null) {
  return role === 'ADMIN' || role === 'MANAGER'
}

export function getRoleLabel(role?: string | null) {
  return isBossRole(role) ? 'Chefe' : 'Funcionário'
}