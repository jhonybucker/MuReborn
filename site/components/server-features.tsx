import { Coins, Gem, ShieldAlert, Users } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { SERVER } from '@/lib/server-info'

const features = [
  {
    icon: Gem,
    title: 'Drop que vale ouro',
    text: `Com drop de ${SERVER.rates.drop}, cada Jewel of Bless, Soul e Chaos tem peso real. Itens excelentes são conquista, não rotina.`,
  },
  {
    icon: Coins,
    title: 'Economia apertada',
    text: `Zen a ${SERVER.rates.zen} mantém o mercado entre jogadores vivo. Trocar e negociar faz parte da progressão.`,
  },
  {
    icon: ShieldAlert,
    title: 'Fiel ao 99b',
    text: 'Quatro classes originais, mapas clássicos e mecânicas da versão 99b. Sem itens de cash shop, sem atalhos.',
  },
  {
    icon: Users,
    title: 'Comunidade fechada',
    text: `Servidor piloto entre amigos, com no máximo ${SERVER.maxAccountsPerIp} contas por IP para manter o jogo justo.`,
  },
]

export function ServerFeatures() {
  return (
    <section id="servidor" className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-24 md:px-6">
      <SectionHeading
        eyebrow="O servidor"
        title="Hard de verdade. Sem pressa, sem atalho."
        description="A experiência sobe rápido para você chegar logo ao conteúdo — mas o equipamento, o zen e os resets exigem dedicação."
      />
      <ul className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
        {features.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex flex-col gap-4 bg-background p-8">
            <Icon className="size-6 text-primary" aria-hidden />
            <h3 className="font-serif text-xl font-bold tracking-wide">{title}</h3>
            <p className="leading-relaxed text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
