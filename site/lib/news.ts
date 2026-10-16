import { SERVER } from '@/lib/server-info'

// Notícias do site. Para publicar uma nova, adicione no topo da lista (mais recente primeiro).
// `date` no formato AAAA-MM-DD.

export type NewsItem = { date: string; title: string; text: string }

export const NEWS: NewsItem[] = [
  {
    date: '2026-10-16',
    title: 'Bem-vindo ao MU Reborn!',
    text: `O servidor está aberto. MU ${SERVER.version} com experiência ${SERVER.rates.exp}, drop e zen a ${SERVER.rates.drop}, reset acumulativo no level ${SERVER.resetLevel} e master reset para quem chegar ao teto de atributos. Baixe o cliente, crie sua conta e nos vemos em Lorencia.`,
  },
]
