import type { Metadata } from 'next'
import { CharacterProfile } from '@/components/character-profile'
import { SiteFooter } from '@/components/rules-footer'
import { SiteHeader } from '@/components/site-header'

type Props = { params: Promise<{ nome: string }> }

// URL malformada (ex.: "%" solto) não pode derrubar a página.
function decodeName(raw: string) {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = decodeName((await params).nome)
  return {
    title: `${name} — MU Reborn`,
    description: `Perfil de ${name} no MU Reborn: classe, level, resets e atributos.`,
  }
}

export default async function CharacterPage({ params }: Props) {
  const name = decodeName((await params).nome)
  return (
    <>
      <SiteHeader />
      <main>
        <CharacterProfile name={name} />
      </main>
      <SiteFooter />
    </>
  )
}
