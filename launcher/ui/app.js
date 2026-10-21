// Lógica da tela do launcher. O que precisa de acesso ao Windows (abrir o jogo, registro,
// rede sem CORS, atualização) é feito pelo Rust em src-tauri/src/main.rs via invoke.
const { invoke } = window.__TAURI__.core
const { listen } = window.__TAURI__.event
const { openUrl } = window.__TAURI__.opener
const appWindow = window.__TAURI__.window.getCurrentWindow()

const $ = (id) => document.getElementById(id)
let info = null
let updating = false

// ---------- utilidades ----------

let toastTimer
function toast(message) {
  const el = $('toast')
  el.textContent = message
  el.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (el.hidden = true), 6000)
}

const pad = (n) => String(n).padStart(2, '0')
function countdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}
const timeOf = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dateOf = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const formatMb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

function setProgress(percent, text) {
  const value = Math.max(0, Math.min(100, Math.round(percent)))
  $('update-fill').style.width = `${value}%`
  $('update-pct').textContent = `${value}%`
  $('update-bar').setAttribute('aria-valuenow', String(value))
  if (text) $('update-text').textContent = text
}

// ---------- janela ----------

$('btn-minimize').addEventListener('click', () => appWindow.minimize())
$('btn-close').addEventListener('click', () => appWindow.close())

// ---------- jogar / registrar ----------

$('btn-play').addEventListener('click', async () => {
  if (updating) return
  try {
    await invoke('play')
  } catch (error) {
    toast(String(error))
  }
})

$('btn-register').addEventListener('click', () => {
  const site = info?.config.siteUrl
  if (!site) return toast('O endereço do site ainda não foi configurado no launcher.')
  openUrl(`${site.replace(/\/$/, '')}/#conta`)
})

// ---------- configurações ----------

const dialog = $('settings')
const form = $('settings-form')

async function openSettings() {
  const settings = await invoke('get_settings')
  form.resolution.value = String(settings.resolution)
  form.windowMode.checked = settings.windowMode
  form.music.checked = settings.music
  form.sound.checked = settings.sound
  form.volume.value = String(settings.volume)
  $('volume-out').textContent = String(settings.volume)
  dialog.showModal()
}
$('btn-settings').addEventListener('click', openSettings)
$('btn-settings-top').addEventListener('click', openSettings)
$('settings-cancel').addEventListener('click', () => dialog.close())
form.volume.addEventListener('input', () => ($('volume-out').textContent = form.volume.value))
form.addEventListener('submit', async (event) => {
  event.preventDefault()
  try {
    await invoke('save_settings', {
      settings: {
        resolution: Number(form.resolution.value),
        windowMode: form.windowMode.checked,
        music: form.music.checked,
        sound: form.sound.checked,
        volume: Number(form.volume.value),
      },
    })
    dialog.close()
  } catch (error) {
    toast(String(error))
  }
})

// ---------- status do servidor e eventos ----------

let events = []
let serverOffset = 0

async function loadStatus() {
  const el = $('server-state')
  try {
    const status = await invoke('api_get', { path: '/status' })
    const up = Object.values(status.ports ?? {}).every(Boolean)
    const players = `${status.online} ${status.online === 1 ? 'jogador' : 'jogadores'}`
    el.innerHTML = `<i class="dot ${up ? 'on' : 'off'}"></i>${up ? 'Servidor online' : 'Servidor instável'} · ${players}`
  } catch {
    el.innerHTML = '<i class="dot off"></i>Servidor offline'
  }
}

async function loadEvents() {
  try {
    const data = await invoke('api_get', { path: '/events' })
    serverOffset = new Date(data.now).getTime() - Date.now()
    events = data.events ?? []
  } catch {
    events = []
  }
}

// ---------- notícias ----------

async function loadNews() {
  const list = $('news-list')
  let news = null
  try {
    news = await invoke('fetch_news')
  } catch {
    news = null
  }
  if (Array.isArray(news) && news.length) {
    list.innerHTML = ''
    for (const item of news.slice(0, 5)) {
      const li = document.createElement('li')
      const time = document.createElement('time')
      time.dateTime = item.date
      time.textContent = dateOf(item.date)
      const title = document.createElement('span')
      title.className = 'title'
      title.textContent = item.title
      title.title = item.text ?? item.title
      li.append(time, title)
      list.append(li)
    }
    return
  }
  // Sem notícias do site: mostra a agenda de eventos de hoje.
  $('news-title').textContent = 'Próximos eventos'
  const now = Date.now() + serverOffset
  const upcoming = events
    .map((e) => ({ ...e, start: new Date(e.next).getTime() }))
    .filter((e) => e.start > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, 5)
  list.innerHTML = ''
  if (!upcoming.length) {
    list.innerHTML = '<li class="muted">Nenhuma novidade no momento.</li>'
    return
  }
  for (const e of upcoming) {
    const li = document.createElement('li')
    const when = document.createElement('span')
    when.className = 'when'
    when.textContent = timeOf(e.next)
    const title = document.createElement('span')
    title.className = 'title'
    title.textContent = e.schedule ? `${e.name} — ${e.schedule}` : e.name
    li.append(when, title)
    list.append(li)
  }
}

// ---------- instalação / atualização do cliente ----------

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const m = Math.floor(seconds / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h${pad(m % 60)}` : `${m}:${pad(Math.floor(seconds % 60))}`
}

async function checkAndUpdate() {
  const play = $('btn-play')
  play.disabled = true
  try {
    setProgress(0, 'Verificando os arquivos do cliente…')
    const check = await invoke('check_update')
    if (!check.configured) {
      if (info.mainFound) return setProgress(100, 'Cliente pronto para jogar.')
      return setProgress(0, `Jogo não encontrado em ${info.clientDir}. Coloque o launcher na pasta do jogo.`)
    }
    if (check.pending === 0) return setProgress(100, `Cliente atualizado (versão ${check.version}). Pronto para jogar!`)

    // Sem o main.exe é instalação do zero; com ele, só os arquivos que mudaram.
    const installing = !info.mainFound
    const verb = installing ? 'Instalando o MU Reborn' : 'Atualizando'
    updating = true
    setProgress(0, `${verb}: ${check.pending} arquivo(s), ${formatMb(check.bytes)}…`)

    const startedAt = Date.now()
    const unlisten = await listen('update-progress', ({ payload }) => {
      const percent = payload.bytesTotal ? (payload.bytesDone / payload.bytesTotal) * 100 : 100
      const seconds = (Date.now() - startedAt) / 1000
      const speed = seconds > 0 ? payload.bytesDone / seconds : 0
      const eta = speed > 0 ? (payload.bytesTotal - payload.bytesDone) / speed : Infinity
      setProgress(
        percent,
        `${verb} · ${payload.done} de ${payload.total} arquivos · ${formatMb(payload.bytesDone)} de ${formatMb(payload.bytesTotal)} · ${formatMb(speed)}/s · faltam ${formatTime(eta)}`,
      )
    })
    try {
      await invoke('run_update')
    } finally {
      unlisten()
    }
    info = await invoke('launcher_info')
    setProgress(100, installing ? 'Instalação concluída. Pronto para jogar!' : `Cliente atualizado (versão ${check.version}). Pronto para jogar!`)
  } catch (error) {
    setProgress(0, `Não foi possível baixar os arquivos: ${error}. Feche e abra o launcher para tentar de novo.`)
  } finally {
    updating = false
    play.disabled = !info.mainFound
  }
}

// ---------- início ----------

async function start() {
  info = await invoke('launcher_info')
  await Promise.all([loadStatus(), loadEvents()])
  loadNews()
  checkAndUpdate()
  setInterval(loadStatus, 60000)
}

start().catch((error) => toast(String(error)))
