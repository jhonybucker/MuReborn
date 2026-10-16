import { AccountRequest } from '@/components/account-request'
import { Classes } from '@/components/classes'
import { Hero } from '@/components/hero'
import { HowToPlay } from '@/components/how-to-play'
import { NewsEvents } from '@/components/news-events'
import { Rankings } from '@/components/rankings'
import { ResetSystem } from '@/components/reset-system'
import { Rules, SiteFooter } from '@/components/rules-footer'
import { ServerFeatures } from '@/components/server-features'
import { SiteHeader } from '@/components/site-header'

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <NewsEvents />
        <Rankings />
        <ServerFeatures />
        <ResetSystem />
        <Classes />
        <HowToPlay />
        <AccountRequest />
        <Rules />
      </main>
      <SiteFooter />
    </>
  )
}
