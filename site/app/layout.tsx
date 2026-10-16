import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import Image from 'next/image'
import { Cinzel, Inter } from 'next/font/google'
import './globals.css'

const cinzel = Cinzel({ subsets: ['latin'], variable: '--font-cinzel', weight: ['500', '700', '900'] })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'MU Reborn 99b — Servidor Hard com Reset Acumulativo',
  description:
    'MU Reborn: servidor privado de MU Online versão 99b, estilo hard, com reset acumulativo e master reset. Baixe o cliente, configure e entre na batalha.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#040916',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${cinzel.variable} ${inter.variable} bg-background`}>
      <body className="antialiased">
        {/* Fundo fixo da página inteira, escurecido para o texto das seções continuar legível. */}
        <div className="fixed inset-0 -z-10" aria-hidden>
          <Image src="/fundo.png" alt="" fill sizes="100vw" className="object-cover object-[60%_50%]" />
          <div className="absolute inset-0 bg-[rgb(4_9_22/0.86)]" />
        </div>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
