import type { Metadata } from 'next'
import { Cpu, Download, HardDrive, MemoryStick, Monitor, MonitorCog, Wifi } from 'lucide-react'
import { DiscordLink } from '@/components/discord-link'
import { SiteFooter } from '@/components/rules-footer'
import { SectionHeading } from '@/components/section-heading'
import { SiteHeader } from '@/components/site-header'
import { SERVER } from '@/lib/server-info'

export const metadata: Metadata = {
  title: 'Downloads e requisitos — MU Reborn',
  description: `Baixe o cliente oficial do MU Reborn ${SERVER.version}, veja os requisitos e como resolver os erros mais comuns.`,
}

// Requisitos típicos do cliente 99b; aproximados, não medidos neste cliente.
const requirements = [
  { icon: Monitor, label: 'Sistema', value: 'Windows 7 ou superior' },
  { icon: Cpu, label: 'Processador', value: '1 GHz ou superior' },
  { icon: MemoryStick, label: 'Memória', value: '1 GB de RAM' },
  { icon: MonitorCog, label: 'Vídeo', value: 'Compatível com DirectX 9.0c' },
  { icon: HardDrive, label: 'Espaço livre', value: '1 GB' },
  { icon: Wifi, label: 'Internet', value: 'Conexão estável' },
]

const steps = [
  { title: 'Baixe o cliente', text: `Use o botão acima. O arquivo tem cerca de ${SERVER.clientSizeMb} MB e fica no MEGA.` },
  {
    title: 'Extraia em uma pasta simples',
    text: 'Extraia com o WinRAR, o 7-Zip ou o extrator do Windows em uma pasta como C:\\MuReborn. Evite "Arquivos de Programas": o Windows bloqueia gravações ali e o jogo pode não salvar configurações.',
  },
  { title: 'Crie sua conta', text: 'Cadastre login e senha na página inicial, na seção Criar conta.' },
  { title: 'Abra o jogo', text: 'Execute o main.exe, escolha o servidor MU Reborn e entre com o login criado.' },
]

const problems = [
  {
    q: 'O antivírus apagou ou bloqueou o main.exe',
    a: 'Clientes antigos de MU costumam ser marcados por engano pelos antivírus. Baixe só pelo link oficial desta página e adicione a pasta do jogo às exclusões: Segurança do Windows › Proteção contra vírus e ameaças › Gerenciar configurações › Exclusões › Adicionar uma exclusão › Pasta. Depois extraia o cliente de novo.',
  },
  {
    q: 'Erro dizendo que falta um arquivo d3dx9_XX.dll',
    a: 'Falta o DirectX 9 no Windows. Instale o "DirectX End-User Runtime" pelo site da Microsoft e abra o jogo de novo.',
    link: { href: 'https://www.microsoft.com/download/details.aspx?id=35', label: 'Baixar DirectX End-User Runtime' },
  },
  {
    q: 'Erro dizendo que falta MSVCR, MSVCP ou VCRUNTIME',
    a: 'Faltam as bibliotecas do Visual C++. Instale os pacotes "Visual C++ Redistributable" na versão x86 (32 bits), mesmo que o seu Windows seja 64 bits.',
    link: {
      href: 'https://learn.microsoft.com/cpp/windows/latest-supported-vc-redist',
      label: 'Baixar Visual C++ Redistributable',
    },
  },
  {
    q: 'O jogo não abre ou fecha sozinho no Windows 10 ou 11',
    a: 'Clique com o botão direito no main.exe › Propriedades › Compatibilidade. Marque "Executar este programa em modo de compatibilidade para" Windows XP (Service Pack 3) e "Executar este programa como administrador". Clique em OK e tente de novo.',
  },
  {
    q: 'Não conecta ao servidor',
    a: 'Confira se o servidor está ON na seção Status e rankings da página inicial. Use exatamente o cliente desta página: outros clientes ou versões não conectam. Se o Firewall do Windows perguntar, permita o acesso do main.exe à rede.',
  },
  {
    q: 'Login ou senha incorretos',
    a: 'O login tem de 4 a 10 caracteres, só letras e números, e a senha de 4 a 10 caracteres, sem espaços. Se ainda não criou a conta, crie na página inicial.',
  },
]

export default function DownloadsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-7xl flex-col gap-16 px-4 pt-36 pb-24 md:px-20">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="Downloads"
            title="Baixe e entre na batalha."
            description="Cliente oficial do MU Reborn. Outros clientes ou versões não conectam ao servidor."
          />
          <div className="glass flex flex-col gap-4 rounded-[36px] p-6 sm:min-w-[360px] md:p-8">
            <div>
              <p className="font-serif text-xl font-bold">Cliente MU Reborn {SERVER.version}</p>
              <p className="text-sm text-muted-foreground">Cerca de {SERVER.clientSizeMb} MB · hospedado no MEGA</p>
            </div>
            <a href={SERVER.clientUrl} target="_blank" rel="noopener noreferrer" className="btn-play h-14 text-lg">
              <Download className="size-5" aria-hidden />
              Baixar cliente
            </a>
          </div>
        </div>

        <section aria-labelledby="requisitos" className="flex flex-col gap-6">
          <h2 id="requisitos" className="text-chrome font-serif text-3xl font-black md:text-4xl">
            Requisitos mínimos
          </h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {requirements.map(({ icon: Icon, label, value }) => (
              <li key={label} className="glass flex items-center gap-4 rounded-[24px] p-4 md:p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[rgb(140_196_255/0.45)] bg-primary/15 text-[#bfe0ff]">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{label}</p>
                  <p className="font-semibold text-pretty">{value}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Valores aproximados para o cliente 99b. Funciona na maioria dos computadores, inclusive os mais antigos.
          </p>
        </section>

        <section aria-labelledby="instalacao" className="flex flex-col gap-6">
          <h2 id="instalacao" className="text-chrome font-serif text-3xl font-black md:text-4xl">
            Instalação
          </h2>
          <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="glass flex flex-col gap-3 rounded-[28px] p-6">
                <span className="flex size-10 items-center justify-center rounded-full border-2 border-ring bg-[#071230] font-serif font-black text-[#bfe0ff] shadow-[0_0_20px_-4px_var(--primary)]">
                  {index + 1}
                </span>
                <h3 className="font-serif text-lg font-bold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-[#a9bde0]">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="problemas" className="flex flex-col gap-6">
          <h2 id="problemas" className="text-chrome font-serif text-3xl font-black md:text-4xl">
            Problemas comuns
          </h2>
          <div className="flex flex-col gap-3">
            {problems.map((item) => (
              <details
                key={item.q}
                className="glass group rounded-[28px] bg-[linear-gradient(160deg,rgb(20_44_100/0.5),rgb(5_12_32/0.85))]"
              >
                <summary className="flex cursor-pointer list-none items-center gap-4 px-6 py-5 font-semibold md:px-7 [&::-webkit-details-marker]:hidden">
                  <span className="size-2 shrink-0 rotate-45 bg-accent" aria-hidden />
                  {item.q}
                  <span className="ml-auto text-muted-foreground transition-transform group-open:rotate-180" aria-hidden>
                    ▾
                  </span>
                </summary>
                <div className="flex flex-col gap-4 px-6 pb-6 md:px-7">
                  <p className="leading-relaxed text-[#a9bde0]">{item.a}</p>
                  {item.link ? (
                    <a
                      href={item.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-frame h-11 w-fit px-5 text-xs"
                    >
                      {item.link.label}
                    </a>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="glass flex flex-col items-center gap-4 rounded-[36px] px-6 py-10 text-center">
          <h2 className="font-serif text-2xl font-bold">Ainda com problema?</h2>
          <p className="max-w-xl text-muted-foreground">
            Fale com o administrador informando seu login, o horário e uma foto ou a mensagem do erro.
          </p>
          <DiscordLink className="h-12 px-6 text-xs" />
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
