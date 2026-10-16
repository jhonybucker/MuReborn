'use client'

import { LostPage } from '@/components/lost-page'
import { SiteFooter } from '@/components/rules-footer'
import { SiteHeader } from '@/components/site-header'

// Erro inesperado em qualquer página: mesmo visual do 404, com opção de tentar de novo.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <SiteHeader />
      <main>
        <LostPage
          eyebrow="Erro inesperado"
          title={
            <>
              Algo deu errado
              <br />
              na batalha.
            </>
          }
          text="A página encontrou um problema ao carregar. Tente de novo; se continuar, avise o administrador dizendo o que você estava fazendo."
          badge="!"
          caption="Falha ao carregar"
          actions={
            <>
              <button type="button" onClick={reset} className="btn-play h-[62px] px-9 text-base">
                Tentar de novo
              </button>
              <a href="/" className="btn-frame h-[62px] px-8 text-[13px]">
                Voltar ao início
              </a>
            </>
          }
        />
      </main>
      <SiteFooter />
    </>
  )
}
