// Modo manutenção. Com `active: true`, TODAS as páginas mostram a tela de manutenção
// (a rota /manutencao mostra a tela sempre, para conferir antes de ligar).
// Liga e desliga com um commit; o site publica sozinho no Netlify.

export type MaintenanceStep = { label: string; status: 'done' | 'doing' | 'todo' }

export const MAINTENANCE = {
  active: false,
  /** Previsão de retorno, ISO 8601 com fuso (ex.: '2026-10-20T03:00:00-03:00'). Vazio = sem previsão. */
  until: '' as string,
  message: 'O servidor está fora do ar para melhorias. Seus personagens estão seguros e tudo volta em breve.',
  steps: [
    { label: 'Backup dos personagens', status: 'done' },
    { label: 'Atualizando os servidores do jogo', status: 'doing' },
    { label: 'Testes finais e liberação', status: 'todo' },
  ] as MaintenanceStep[],
}
