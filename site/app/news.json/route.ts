import { NEWS } from '@/lib/news'

// Notícias em JSON para o launcher (launcher/ui/app.js). Gerado no build, a partir de lib/news.ts.
export const dynamic = 'force-static'

export function GET() {
  return Response.json(NEWS)
}
