'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function CharacterSearch() {
  const router = useRouter()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('nome') ?? '').trim()
    if (name) router.push(`/personagem/${encodeURIComponent(name)}`)
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="flex h-14 max-w-md items-center gap-3 rounded-full border border-[#2a4c94] bg-[rgb(4_9_22/0.75)] pr-1.5 pl-5 shadow-[inset_0_2px_8px_rgb(0_0_0/0.4)] focus-within:border-ring"
    >
      <Search className="size-5 shrink-0 text-[#6f86b3]" aria-hidden />
      <label htmlFor="busca-personagem" className="sr-only">
        Nome do personagem
      </label>
      <input
        id="busca-personagem"
        name="nome"
        maxLength={10}
        autoComplete="off"
        placeholder="Nome do personagem"
        className="h-full min-w-0 flex-1 bg-transparent text-foreground placeholder:text-[#6f86b3] focus:outline-none"
      />
      <button type="submit" className="btn-play h-11 shrink-0 px-5 text-xs">
        Buscar
      </button>
    </form>
  )
}
