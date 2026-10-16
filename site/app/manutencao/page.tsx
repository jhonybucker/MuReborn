import type { Metadata } from 'next'
import { MaintenanceScreen } from '@/components/maintenance-screen'

export const metadata: Metadata = {
  title: 'Em manutenção — MU Reborn',
  robots: { index: false },
}

export default function ManutencaoPage() {
  return <MaintenanceScreen />
}
