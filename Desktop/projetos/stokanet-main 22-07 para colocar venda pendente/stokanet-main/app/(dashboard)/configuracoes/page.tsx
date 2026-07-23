import prisma from '@/lib/prisma'
import { getActiveUser, getOrCreateDefaultCompany } from '@/lib/access'
import { SettingsClient } from './SettingsClient'

export default async function ConfiguracoesPage() {
  const company = await getOrCreateDefaultCompany()
  const user = await getActiveUser()

  const currentCompany = await prisma.company.findUnique({
    where: { id: company.id },
    select: { name: true, defaultMinStock: true, notificationWebhookUrl: true },
  })

  if (!currentCompany) {
    throw new Error('Configurações indisponíveis')
  }

  return (
    <SettingsClient
      companyName={currentCompany.name}
      defaultMinStock={currentCompany.defaultMinStock}
      notificationWebhookUrl={currentCompany.notificationWebhookUrl ?? ''}
      currentThemePreference={user.themePreference as 'SUNSET' | 'OCEAN' | 'FOREST' | 'ROSE'}
    />
  )
}