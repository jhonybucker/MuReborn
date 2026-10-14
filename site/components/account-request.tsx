'use client'

import { ScrollText } from 'lucide-react'
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
      setStatus({ kind: 'error', message: 'O login precisa ter de 4 a 10 caracteres, apenas letras e nÃºmeros.' })
      return
    }
    if (password.length < 4 || password.length > 10 || /\s/.test(password)) {
      setStatus({ kind: 'error', message: 'A senha precisa ter de 4 a 10 caracteres, sem espaÃ§os.' })
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
    <section id="conta" className="mx-auto grid max-w-6xl gap-12 px-4 py-24 md:px-6 lg:grid-cols-2">
      <SectionHeading
        eyebrow="Criar conta"
        title="Crie sua conta e jogue."
        description="Crie sua conta na hora e entre no jogo em seguida."
      />

      <div className="gold-frame bg-card p-6 md:p-8">
        {status.kind === 'done' ? (
          <div className="flex flex-col gap-5" role="status">
            <div className="flex items-center gap-3 text-primary">
              <ScrollText className="size-5" aria-hidden />
              <p className="font-serif text-lg font-bold">Conta criada!</p>
            </div>
            <p className="leading-relaxed text-muted-foreground">
              Login <span className="font-mono text-foreground">{status.login}</span> pronto. Abra o jogo e divirta-se!
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <CopyButton value={status.login} label="Copiar login" className="border border-primary/60" />
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
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="login" className="text-sm font-medium">
                Login desejado
              </label>
              <input
                id="login"
                name="login"
                required
                minLength={4}
                maxLength={10}
                autoComplete="username"
                aria-describedby="login-hint"
                className="h-11 rounded-sm border border-input bg-background px-3 font-mono text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:outline-none"
                placeholder="ex: guerreiro"
              />
              <p id="login-hint" className="text-xs text-muted-foreground">
                4 a 10 caracteres, apenas letras e nÃºmeros.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={4}
                maxLength={10}
                autoComplete="new-password"
                className="h-11 rounded-sm border border-input bg-background px-3 text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:outline-none"
                placeholder="4 a 10 caracteres, sem espaÃ§os"
              />
            </div>
            {status.kind === 'error' ? (
              <p role="alert" className="border border-accent/60 bg-accent/20 px-3 py-2 text-sm text-accent-foreground">
                {status.message}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={status.kind === 'busy'}
              className="h-11 rounded-sm bg-primary font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {status.kind === 'busy' ? 'Criando...' : 'Criar conta'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
