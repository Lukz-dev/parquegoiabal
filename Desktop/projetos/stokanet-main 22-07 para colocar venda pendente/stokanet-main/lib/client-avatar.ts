type AvatarCacheEntry = {
  key: string
  value: string | null
  timestamp: number
}

const AVATAR_CACHE_TTL_MS = 60_000

let avatarCache: AvatarCacheEntry | null = null
let inFlightAvatarRequest: Promise<string | null> | null = null

export async function loadAvatarCached(cacheKey: string) {
  const now = Date.now()
  if (avatarCache && avatarCache.key === cacheKey && now - avatarCache.timestamp < AVATAR_CACHE_TTL_MS) {
    return avatarCache.value
  }

  if (inFlightAvatarRequest) {
    return inFlightAvatarRequest
  }

  inFlightAvatarRequest = (async () => {
    try {
      const response = await fetch('/api/me/avatar', { cache: 'no-store' })
      if (!response.ok) {
        avatarCache = { key: cacheKey, value: null, timestamp: Date.now() }
        return null
      }

      const payload = (await response.json()) as { avatarUrl: string | null }
      const value = payload.avatarUrl
      avatarCache = { key: cacheKey, value, timestamp: Date.now() }
      return value
    } catch {
      avatarCache = { key: cacheKey, value: null, timestamp: Date.now() }
      return null
    }
  })()

  try {
    return await inFlightAvatarRequest
  } finally {
    inFlightAvatarRequest = null
  }
}
