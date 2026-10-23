import { Download, Play, UserPlus } from 'lucide-react'
import { SERVER } from '@/lib/server-info'

const steps = [
  {
    icon: Download,
    title: 'Baixe o cliente',
    text: `Baixe o instalador oficial do MU Reborn ${SERVER.version} e instale. Ele cria o atalho MU Reborn na área de trabalho.`,
    cta: { label: 'Baixar instalador', href: SERVER.clientUrl, external: true, primary: true },
  },
  {
    icon: UserPlus,
    title: 'Crie sua conta',
    text: 'Cadastre login e senha na hora, sem esperar ninguém.',
    cta: { label: 'Criar conta', href: '#conta', external: false, primary: true },
  },
  {
    icon: Play,
    title: 'Entre no jogo',
    text: null,
    cta: { label: 'Ainda sem conta?', href: '#conta', external: false, primary: false },
  },
]

export function HowToPlay() {
  return (
    <section
      id="comecar"
      className="bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgb(61_139_255/0.28),transparent_70%),radial-gradient(ellipse_50%_40%_at_50%_100%,rgb(240_180_67/0.1),transparent_70%)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-14 px-4 py-24 md:px-20">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="eyebrow after:h-px after:w-11 after:bg-gradient-to-l after:from-transparent after:to-accent after:content-['']">
            Como jogar
          </p>
          <h2 className="text-chrome font-serif text-4xl leading-[1.02] font-black text-balance md:text-6xl">
            Três passos até Lorencia.
          </h2>
          <p className="text-lg text-muted-foreground">
            Use exatamente o cliente oficial. Outros clientes ou versões não conectam ao servidor.
          </p>
        </div>

        <div className="relative">
          <span
            className="absolute inset-x-[150px] top-[66px] hidden border-t-2 border-dashed border-accent/50 lg:block"
            aria-hidden
          />
          <ol className="relative grid gap-9 lg:grid-cols-3">
            {steps.map(({ icon: Icon, title, text, cta }, index) => (
              <li
                key={title}
                className="glass relative flex min-h-[340px] flex-col overflow-hidden rounded-[48px] bg-[linear-gradient(160deg,rgb(22_50_115/0.7),rgb(5_12_32/0.95))] p-[34px]"
              >
                <span
                  className="absolute -top-1.5 right-[22px] font-serif text-[150px] leading-none font-black text-[rgb(130_175_255/0.1)]"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className="relative flex size-16 items-center justify-center rounded-full border border-[rgb(140_196_255/0.55)] bg-[radial-gradient(circle,rgb(90_162_255/0.4),rgb(61_139_255/0.1))] text-[#e6f1ff] shadow-[0_0_30px_-4px_var(--primary)]">
                  <Icon className="size-[30px]" strokeWidth={1.9} aria-hidden />
                </span>
                <h3 className="relative mt-[26px] mb-2.5 font-serif text-[27px] font-black">{title}</h3>
                <p className="relative mb-7 leading-relaxed text-[#a9bde0]">
                  {text ?? (
                    <>
                      Abra pelo atalho MU Reborn, clique em JOGAR, escolha o servidor MU Reborn e entre com o login e a
                      senha que você criou.
                    </>
                  )}
                </p>
                <a
                  href={cta.href}
                  {...(cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={`relative mt-auto w-fit px-7 ${
                    cta.primary ? 'btn-play h-[50px] text-[13px]' : 'btn-frame h-[50px] text-xs'
                  }`}
                >
                  {cta.label}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
