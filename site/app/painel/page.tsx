import type { Metadata } from 'next'
import { AccountPanel } from '@/components/account-panel'
import { SiteFooter } from '@/components/rules-footer'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: 'Minha conta — MU Reborn',
  description: 'Entre com sua conta do MU Reborn para ver seus personagens, atributos, zen e mapa.',
}

export default function PainelPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <AccountPanel />
      </main>
      <SiteFooter />
    </>
  )
}
