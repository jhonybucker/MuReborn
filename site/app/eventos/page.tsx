import type { Metadata } from 'next'
import { EventsBoard } from '@/components/events-board'
import { SiteFooter } from '@/components/rules-footer'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: 'Eventos — MU Reborn',
  description: 'Horários de Blood Castle, Devil Square, Chaos Castle e outros eventos do MU Reborn, com contagem regressiva.',
}

export default function EventosPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <EventsBoard />
      </main>
      <SiteFooter />
    </>
  )
}
