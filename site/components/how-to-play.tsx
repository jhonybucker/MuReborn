import { Download, FileCog, Play } from 'lucide-react'
import { CopyButton } from '@/components/copy-button'
import { SectionHeading } from '@/components/section-heading'
import { SERVER } from '@/lib/server-info'

const configLine = `IpAddress = ${SERVER.ip}`

export function HowToPlay() {
  return (
    <section id="comecar" className="border-y border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-24 md:px-6">
        <SectionHeading
          eyebrow="Como jogar"
          title="Três passos até Lorencia."
          description="Use exatamente o cliente abaixo. Outros clientes ou versões não conectam ao servidor."
        />
        <ol className="grid gap-6 lg:grid-cols-3">
          <li className="flex flex-col gap-5 border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <span className="font-serif text-sm text-muted-foreground">Passo 1</span>
              <Download className="size-5 text-primary" aria-hidden />
            </div>
            <h3 className="font-serif text-xl font-bold tracking-wide">Baixe o cliente</h3>
            <p className="leading-relaxed text-muted-foreground">
              Faça o download do cliente {SERVER.version} oficial do MU Reborn e extraia em uma pasta.
            </p>
            <a
              href={SERVER.clientUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto inline-flex w-fit items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Download className="size-4" aria-hidden />
              Download (MEGA)
            </a>
          </li>

          <li className="flex flex-col gap-5 border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <span className="font-serif text-sm text-muted-foreground">Passo 2</span>
              <FileCog className="size-5 text-primary" aria-hidden />
            </div>
            <h3 className="font-serif text-xl font-bold tracking-wide">Aponte o servidor</h3>
            <p className="leading-relaxed text-muted-foreground">
              Na pasta do cliente, abra o arquivo <code className="font-mono text-foreground">Config.ini</code> e deixe
              assim:
            </p>
            <div className="mt-auto flex items-center justify-between gap-2 border border-border bg-card py-2 pl-4 pr-2">
              <code className="font-mono text-sm text-primary">{configLine}</code>
              <CopyButton value={configLine} label="Copiar" className="px-2" />
            </div>
          </li>

          <li className="flex flex-col gap-5 border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <span className="font-serif text-sm text-muted-foreground">Passo 3</span>
              <Play className="size-5 text-primary" aria-hidden />
            </div>
            <h3 className="font-serif text-xl font-bold tracking-wide">Entre no jogo</h3>
            <p className="leading-relaxed text-muted-foreground">
              Abra o <code className="font-mono text-foreground">main.exe</code>, escolha o servidor MU Reborn e entre com
              o login e a senha que você criou abaixo.
            </p>
            <a
              href="#conta"
              className="mt-auto inline-flex w-fit items-center gap-2 rounded-sm border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              Ainda sem conta?
            </a>
          </li>
        </ol>
      </div>
    </section>
  )
}
