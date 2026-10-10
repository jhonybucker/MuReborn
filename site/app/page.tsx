import { AccountRequest } from '@/components/account-request'
import { Classes } from '@/components/classes'
import { Hero } from '@/components/hero'
import { HowToPlay } from '@/components/how-to-play'
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
