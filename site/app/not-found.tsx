import type { Metadata } from 'next'
import { LostPage } from '@/components/lost-page'
import { SiteFooter } from '@/components/rules-footer'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: 'Página não encontrada — MU Reborn',
}

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main>
        <LostPage
          eyebrow="Erro 404"
          title={
            <>
              Você se perdeu
              <br />
              nas ruínas.
            </>
          }
          text="Esta página não existe ou foi levada pela batalha. Volte para a cidade e retome sua jornada."
          badge="404"
          caption="Caminho não encontrado"
          actions={
            <>
              <a href="/" className="btn-play h-[62px] px-9 text-base">
                Voltar ao início
              </a>
              <a href="/ranking" className="btn-frame h-[62px] px-8 text-[13px]">
                Ver ranking
              </a>
            </>
          }
        />
      </main>
      <SiteFooter />
    </>
  )
}
