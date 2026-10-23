export const SERVER = {
  name: 'MU Reborn',
  version: '99b',
  ip: '102.165.46.30',
  // Instalador completo (launcher + jogo), publicado como release no GitHub.
  clientUrl: 'https://github.com/jhonybucker/MuReborn/releases/download/instalador-1.0.0/Instalador-MU-Reborn.exe',
  clientFile: 'Instalador-MU-Reborn.exe',
  clientSizeMb: 215,
  // SHA-256 do instalador acima. Muda a cada build: atualize junto com o link.
  clientSha256: 'ffee942ba34010efb0ed7e99c96e3c84bc468900c59e0996702119d04c6767c0',
  // Convite do Discord (ex.: 'https://discord.gg/xxxx'). Vazio = botão escondido.
  discordUrl: '' as string,
  rates: {
    exp: '1000%',
    drop: '50%',
    zen: '50%',
  },
  resetLevel: 400,
  statCap: 32767,
  masterStatCap: 65000,
  maxAccountsPerIp: 5,
  apiUrl: 'https://mu-reborn.duckdns.org/api/signup',
  apiBase: 'https://mu-reborn.duckdns.org/api',
} as const
