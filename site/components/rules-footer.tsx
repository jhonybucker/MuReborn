import { SectionHeading } from '@/components/section-heading'
import { SERVER } from '@/lib/server-info'

const rules = [
  'Servidor de amigos: nada de trapaças, hacks, bots ou exploração de bugs.',
  'Não divulgue o link do cliente nem o IP fora do grupo.',
  `Máximo de ${SERVER.maxAccountsPerIp} contas por IP.`,
  'Respeite os outros jogadores dentro e fora do jogo.',
  'Problemas? Fale com o administrador informando login, horário e o que aconteceu.',
]

export function Rules() {
  return (
    <section id="regras" className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 md:px-6 lg:grid-cols-2">
        <SectionHeading
          eyebrow="Regras"
          title="O código de honra."
          description="Poucas regras, levadas a sério. Quem quebrar perde o convite."
        />
        <ul className="flex flex-col">
          {rules.map((rule) => (
            <li key={rule} className="flex gap-4 border-b border-border py-4 first:pt-0 last:border-b-0">
              <span className="mt-2 size-1.5 shrink-0 rotate-45 bg-primary" aria-hidden />
              <p className="leading-relaxed text-foreground/90">{rule}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-muted-foreground md:flex-row md:px-6">
        <p className="font-serif tracking-widest">
          <span className="text-gold font-bold">MU REBORN</span> {SERVER.version}
        </p>
        <p className="text-center text-pretty">
          Servidor privado sem fins lucrativos. MU Online é marca registrada da Webzen.
        </p>
      </div>
    </footer>
  )
}
