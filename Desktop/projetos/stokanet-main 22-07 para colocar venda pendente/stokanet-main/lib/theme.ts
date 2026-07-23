export const THEME_PREFERENCES = ['SUNSET', 'OCEAN', 'FOREST', 'ROSE'] as const

export type ThemePreference = (typeof THEME_PREFERENCES)[number]

export const THEME_ATTRIBUTE_MAP: Record<ThemePreference, string> = {
  SUNSET: 'sunset',
  OCEAN: 'ocean',
  FOREST: 'forest',
  ROSE: 'rose',
}

export function isThemePreference(value: string): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference)
}

export function toThemeAttribute(value?: string | null): string {
  if (!value) return THEME_ATTRIBUTE_MAP.SUNSET
  if (isThemePreference(value)) return THEME_ATTRIBUTE_MAP[value]
  return THEME_ATTRIBUTE_MAP.SUNSET
}
