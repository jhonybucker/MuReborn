'use client'

import { useEffect, useState } from 'react'

/**
 * Hora atual que avança a cada `intervalMs`. Começa em null para o HTML do servidor e o do
 * navegador baterem; só passa a ter valor depois que a página carrega no navegador.
 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

/** Divide milissegundos em horas, minutos e segundos (com dois dígitos). */
export function splitDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    hours: pad(Math.floor(total / 3600)),
    minutes: pad(Math.floor((total % 3600) / 60)),
    seconds: pad(total % 60),
  }
}
