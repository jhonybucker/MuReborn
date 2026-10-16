'use client'

import Image from 'next/image'
import { Lock, ScrollText, User } from 'lucide-react'
import { useState } from 'react'
import { CopyButton } from '@/components/copy-button'
import { SectionHeading } from '@/components/section-heading'
import { SERVER } from '@/lib/server-info'

const LOGIN_PATTERN = /^[a-zA-Z0-9]{4,10}$/

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; login: string }
  | { kind: 'error'; message: string }

export function AccountRequest() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const login = String(data.get('login') ?? '').trim()
    const password = String(data.get('password') ?? '')

    if (!LOGIN_PATTERN.test(login)) {
      setStatus({ kind: 'error', message: 'O login precisa ter de 4 a 10 caracteres, apenas letras e números.' })
      return
    }
    if (password.length < 4 || password.length > 10 || /\s/.test(password)) {
      setStatus({ kind: 'error', message: 'A senha precisa ter de 4 a 10 caracteres, sem espaços.' })
      return
    }

    setStatus({ kind: 'busy' })
    try {
      const res = await fetch(SERVER.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (res.ok && body?.ok) {
        setStatus({ kind: 'done', login })
      } else {
        setStatus({ kind: 'error', message: 'Falha: ' + (body?.error ?? 'tente de novo') })
      }
    } catch {
      setStatus({ kind: 'error', message: 'Falha de rede, tente de novo.' })
    }
  }

  return (
    <section
      id="conta"
      className="bg-[radial-gradient(ellipse_60%_60%_at_100%_100%,rgb(61_139_255/0.26),transparent_70%)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 py-24 md:px-20 lg:flex-row lg:gap-[72px]">
        <div className="gold-ring relative hidden h-[608px] w-[410px] shrink-0 overflow-hidden rounded-t-[205px] rounded-b-[44px] lg:block">
          <Image
            src="/fundo.webp"
            alt=""
            fill
            sizes="410px"
            className="object-cover object-[64%_45%]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,#040916_6%,rgb(4_9_22/0.2)_50%,transparent_80%)]" />
          <Image
            src="/logo.webp"
            alt=""
            width={612}
            height={408}
            className="absolute bottom-5 left-1/2 h-auto w-[260px] -translate-x-1/2 drop-shadow-[0_0_28px_rgb(61_139_255/0.6)]"
          />
        </div>

        <div className="w-full flex-1">
          <SectionHeading
            eyebrow="Criar conta"
            title={
              <>
                Crie sua conta
                <br />
                e jogue.
              </>
            }
            description="Crie na hora e entre no jogo em seguida."
          />

          <div className="glass mt-8 rounded-[44px] bg-[linear-gradient(160deg,rgb(22_50_115/0.6),rgb(5_12_32/0.9))] px-6 pt-8 pb-9 md:px-9">
            {status.kind === 'done' ? (
              <div className="flex flex-col gap-5" role="status">
                <div className="flex items-center gap-3 text-accent">
                  <ScrollText className="size-5" aria-hidden />
                  <p className="font-serif text-xl font-bold">Conta criada!</p>
                </div>
                <p className="leading-relaxed text-muted-foreground">
                  Login <span className="font-mono text-foreground">{status.login}</span> pronto. Abra o jogo e
                  divirta-se!
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <CopyButton value={status.login} label="Copiar login" className="btn-frame h-11 rounded-full px-5 text-[#f7dfa4] hover:bg-transparent" />
                  <button
                    type="button"
                    onClick={() => setStatus({ kind: 'idle' })}
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Criar outra conta
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="flex flex-col">
                <label htmlFor="login" className="mb-2 text-xs font-semibold tracking-[0.2em] text-[#a9bde0] uppercase">
                  Login desejado
                </label>
                <div className="flex h-[58px] items-center gap-3.5 rounded-full border border-[#2a4c94] bg-[rgb(4_9_22/0.75)] px-6 shadow-[inset_0_2px_8px_rgb(0_0_0/0.4)] focus-within:border-ring">
                  <User className="size-5 shrink-0 text-[#6f86b3]" strokeWidth={1.9} aria-hidden />
                  <input
                    id="login"
                    name="login"
                    required
                    minLength={4}
                    maxLength={10}
                    autoComplete="username"
                    aria-describedby="login-hint"
                    className="h-full w-full bg-transparent font-mono text-foreground placeholder:text-[#6f86b3] focus:outline-none"
                    placeholder="seu_login"
                  />
                </div>
                <p id="login-hint" className="mt-2 mb-5 ml-6 text-[13px] text-[#6f86b3]">
                  4 a 10 caracteres, apenas letras e números.
                </p>

                <label htmlFor="password" className="mb-2 text-xs font-semibold tracking-[0.2em] text-[#a9bde0] uppercase">
                  Senha
                </label>
                <div className="flex h-[58px] items-center gap-3.5 rounded-full border border-[#2a4c94] bg-[rgb(4_9_22/0.75)] px-6 shadow-[inset_0_2px_8px_rgb(0_0_0/0.4)] focus-within:border-ring">
                  <Lock className="size-5 shrink-0 text-[#6f86b3]" strokeWidth={1.9} aria-hidden />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={4}
                    maxLength={10}
                    autoComplete="new-password"
                    aria-describedby="password-hint"
                    className="h-full w-full bg-transparent text-foreground placeholder:text-[#6f86b3] focus:outline-none"
                    placeholder="••••••"
                  />
                </div>
                <p id="password-hint" className="mt-2 mb-6 ml-6 text-[13px] text-[#6f86b3]">
                  4 a 10 caracteres, sem espaços.
                </p>

                {status.kind === 'error' ? (
                  <p
                    role="alert"
                    className="mb-5 rounded-full border border-destructive/60 bg-destructive/15 px-6 py-3 text-sm text-red-200"
                  >
                    {status.message}
                  </p>
                ) : null}
                <button type="submit" disabled={status.kind === 'busy'} className="btn-play h-16 text-xl">
                  {status.kind === 'busy' ? 'Criando...' : 'Criar conta'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
