import type { Metadata } from 'next'
import { RankingBoard } from '@/components/ranking-board'
import { SiteFooter } from '@/components/rules-footer'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: 'Ranking — MU Reborn',
  description: 'Ranking do MU Reborn: geral, master reset, por classe, guilds e quem está online agora.',
}

export default function RankingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <RankingBoard />
      </main>
      <SiteFooter />
    </>
  )
}
