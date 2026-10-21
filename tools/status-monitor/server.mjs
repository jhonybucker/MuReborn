// Painel de status do MU Reborn — separado do site.
// Uso: node tools/status-monitor/server.mjs   (Node 18+, sem dependências)
// Abra http://localhost:4100 no navegador. Testa a cada 10 s e guarda os últimos 30 min.

import dns from 'node:dns/promises'
import http from 'node:http'

const HOST = 'mu-reborn.duckdns.org'
const EXPECTED_IP = '102.165.46.30'
const API = `https://${HOST}/api`
const PORT = Number(process.env.PORT ?? 4100)
const INTERVAL_MS = 10_000
const HISTORY = 180 // 180 × 10 s = 30 min
const TIMEOUT_MS = 6_000
const SLOW_MS = 400

const CHECKS = [
  // Sua internet: se estes falham também, o problema não é o servidor.
  { id: 'net-google', group: 'Sua internet', label: 'Google', kind: 'http', url: 'https://www.google.com/generate_204' },
  { id: 'net-cloudflare', group: 'Sua internet', label: 'Cloudflare', kind: 'http', url: 'https://1.1.1.1/cdn-cgi/trace' },
  { id: 'dns', group: 'Servidor', label: `DNS ${HOST}`, kind: 'dns' },
  // Portas do jogo: lidas do /status (a VPS checa de dentro). NÃO conectar nelas daqui: o ConnectServer
  // tem proteção contra flood e bloqueia o IP que abre conexões repetidas — inclusive o seu jogo.
  { id: 'game-44405', group: 'Jogo', label: 'ConnectServer (44405)', kind: 'game', port: 44405 },
  { id: 'game-55901', group: 'Jogo', label: 'GameServer (55901)', kind: 'game', port: 55901 },
  { id: 'game-55960', group: 'Jogo', label: 'Porta 55960', kind: 'game', port: 55960 },
  { id: 'game-55970', group: 'Jogo', label: 'Porta 55970', kind: 'game', port: 55970 },
  { id: 'api-status', group: 'API do site', label: '/status', kind: 'api', path: '/status' },
  { id: 'api-rankings', group: 'API do site', label: '/rankings', kind: 'api', path: '/rankings' },
  { id: 'api-events', group: 'API do site', label: '/events', kind: 'api', path: '/events' },
  { id: 'api-online', group: 'API do site', label: '/online', kind: 'api', path: '/online' },
]

const history = Object.fromEntries(CHECKS.map((c) => [c.id, []]))
let lastApiStatus = null

async function httpCheck(url, expectOk) {
  const start = performance.now()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' })
    const ms = Math.round(performance.now() - start)
    if (!expectOk) return { ok: response.status < 500, ms, detail: `HTTP ${response.status}` }
    const body = await response.json().catch(() => null)
    const ok = response.ok && body?.ok === true
    return { ok, ms, detail: ok ? `HTTP ${response.status}` : `HTTP ${response.status} ${body?.error ?? ''}`.trim(), body }
  } catch (error) {
    return { ok: false, ms: null, detail: error.name === 'TimeoutError' ? 'sem resposta (timeout)' : error.cause?.code ?? error.message }
  }
}

async function dnsCheck() {
  const start = performance.now()
  try {
    // lookup usa o DNS do sistema (o mesmo do navegador e do jogo); redes que bloqueiam DNS direto não dão falso alarme.
    const addresses = (await dns.lookup(HOST, { all: true, family: 4 })).map((entry) => entry.address)
    const ms = Math.round(performance.now() - start)
    const ok = addresses.includes(EXPECTED_IP)
    return { ok, ms, detail: ok ? addresses.join(', ') : `aponta para ${addresses.join(', ')} (esperado ${EXPECTED_IP})` }
  } catch (error) {
    return { ok: false, ms: null, detail: error.code ?? error.message }
  }
}

async function runChecks() {
  const at = Date.now()
  // As portas do jogo dependem do /status, então ele roda primeiro.
  const statusCheck = CHECKS.find((c) => c.id === 'api-status')
  const status = await httpCheck(API + statusCheck.path, true)
  const ports = status.ok ? status.body?.ports ?? {} : null
  if (status.ok) lastApiStatus = status.body
  await Promise.all(
    CHECKS.map(async (check) => {
      let result
      if (check.id === 'api-status') result = status
      else if (check.kind === 'game')
        result = ports === null
          ? { ok: false, ms: null, detail: 'sem resposta da API (/status)' }
          : ports[String(check.port)]
            ? { ok: true, ms: status.ms, detail: 'no ar (visto pela VPS)' }
            : { ok: false, ms: null, detail: 'porta fechada na VPS' }
      else if (check.kind === 'dns') result = await dnsCheck()
      else if (check.kind === 'http') result = await httpCheck(check.url, false)
      else result = await httpCheck(API + check.path, true)
      result = { ...result }
      delete result.body
      const list = history[check.id]
      list.push({ at, ...result })
      if (list.length > HISTORY) list.shift()
    }),
  )
}

function summary() {
  const checks = CHECKS.map((check) => {
    const list = history[check.id]
    const last = list.at(-1) ?? null
    const okSamples = list.filter((s) => s.ok)
    const times = okSamples.map((s) => s.ms).sort((a, b) => a - b)
    return {
      ...check,
      last,
      uptime: list.length ? Math.round((okSamples.length / list.length) * 1000) / 10 : null,
      avg: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
      p95: times.length ? times[Math.min(times.length - 1, Math.floor(times.length * 0.95))] : null,
      samples: list.map((s) => (s.ok ? s.ms : -1)),
    }
  })
  return { checks, verdict: verdict(checks), apiStatus: lastApiStatus, interval: INTERVAL_MS / 1000 }
}

function verdict(checks) {
  const byGroup = (group) => checks.filter((c) => c.group === group && c.last)
  const down = (list) => list.filter((c) => !c.last.ok)
  const internet = byGroup('Sua internet')
  const game = byGroup('Jogo')
  const api = byGroup('API do site')
  if (!internet.length) return { level: 'wait', text: 'Coletando as primeiras medições…' }
  if (down(internet).length === internet.length)
    return { level: 'bad', text: 'Sua internet está fora do ar ou bloqueada: nem Google nem Cloudflare respondem. O problema não é o servidor.' }
  const slowInternet = internet.some((c) => c.avg && c.avg > SLOW_MS)
  const gameDown = down(game)
  const apiDown = down(api)
  if (gameDown.length === game.length && apiDown.length === api.length)
    return { level: 'bad', text: 'Sua internet funciona, mas o servidor não responde em nada (jogo e API). A VPS pode estar desligada, sem rede ou bloqueando conexões.' }
  if (gameDown.length) return { level: 'bad', text: `Portas do jogo fora: ${gameDown.map((c) => c.label).join(', ')}. Verifique esses processos na VPS.` }
  if (apiDown.length) return { level: 'warn', text: `O jogo responde, mas a API tem falhas: ${apiDown.map((c) => c.label).join(', ')}.` }
  const unstable = [...game, ...api].filter((c) => c.uptime !== null && c.uptime < 95)
  if (unstable.length) return { level: 'warn', text: `Conexão instável (perdendo respostas): ${unstable.map((c) => c.label).join(', ')}. Pode ser a rede da VPS ou o caminho até ela.` }
  const slowGame = game.filter((c) => c.avg && c.avg > SLOW_MS)
  if (slowGame.length)
    return {
      level: 'warn',
      text: slowInternet
        ? 'Tudo responde, mas devagar — inclusive sites comuns. Provavelmente é a sua internet.'
        : `Tudo responde, mas o servidor está lento (média de ${slowGame[0].avg} ms). Isso costuma ser distância até a VPS ou a rede dela.`,
    }
  return { level: 'good', text: 'Tudo no ar e respondendo bem.' }
}

const PAGE = /* html */ `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Status MU Reborn</title>
<style>
  :root { --bg:#040916; --card:#0a1631; --line:#1c3466; --fg:#dce7ff; --muted:#8ea4cc; --good:#37e08a; --warn:#f0b443; --bad:#e5484d; --blue:#5aa2ff; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 system-ui, sans-serif; padding:24px 16px 48px; }
  main { max-width:1100px; margin:0 auto; display:flex; flex-direction:column; gap:20px; }
  h1 { margin:0; font-size:26px; letter-spacing:.04em; }
  h1 span { color:var(--warn); }
  .sub { color:var(--muted); font-size:13px; }
  .verdict { border-radius:18px; padding:18px 22px; border:1px solid var(--line); background:var(--card); font-size:17px; display:flex; gap:14px; align-items:center; }
  .verdict .dot { width:14px; height:14px; border-radius:50%; flex-shrink:0; }
  h2 { margin:8px 0 0; font-size:13px; letter-spacing:.2em; text-transform:uppercase; color:var(--warn); }
  .grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:14px 16px; display:flex; flex-direction:column; gap:6px; }
  .head { display:flex; align-items:center; gap:10px; font-weight:600; }
  .dot { width:10px; height:10px; border-radius:50%; background:var(--muted); }
  .good { background:var(--good); box-shadow:0 0 10px var(--good); }
  .warn { background:var(--warn); box-shadow:0 0 10px var(--warn); }
  .bad { background:var(--bad); box-shadow:0 0 10px var(--bad); }
  .ms { margin-left:auto; font-variant-numeric:tabular-nums; }
  .stats { display:flex; gap:14px; font-size:12px; color:var(--muted); }
  .detail { font-size:12px; color:var(--muted); min-height:18px; overflow-wrap:anywhere; }
  svg { width:100%; height:36px; display:block; }
  .players { color:var(--muted); font-size:14px; }
</style>
</head>
<body>
<main>
  <div>
    <h1>MU <span>REBORN</span> · Status</h1>
    <p class="sub" id="sub">Carregando…</p>
  </div>
  <div class="verdict"><span class="dot" id="vdot"></span><span id="vtext">Coletando as primeiras medições…</span></div>
  <p class="players" id="players"></p>
  <div id="groups"></div>
</main>
<script>
const SLOW = ${SLOW_MS};
function spark(samples) {
  if (!samples.length) return '';
  const w = 240, h = 36, max = Math.max(SLOW * 1.5, ...samples);
  const step = w / Math.max(1, samples.length - 1);
  let path = '', fails = '';
  samples.forEach((v, i) => {
    const x = (i * step).toFixed(1);
    if (v < 0) { fails += '<rect x="' + (x - 1.5) + '" y="0" width="3" height="' + h + '" fill="#e5484d" opacity=".55"/>'; return; }
    const y = (h - (v / max) * (h - 4) - 2).toFixed(1);
    path += (path ? 'L' : 'M') + x + ' ' + y;
  });
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' + fails +
    '<line x1="0" x2="' + w + '" y1="' + (h - (SLOW / max) * (h - 4) - 2) + '" y2="' + (h - (SLOW / max) * (h - 4) - 2) + '" stroke="#f0b443" stroke-dasharray="3 3" opacity=".4"/>' +
    '<path d="' + path + '" fill="none" stroke="#5aa2ff" stroke-width="1.5"/></svg>';
}
function level(c) {
  if (!c.last) return '';
  if (!c.last.ok) return 'bad';
  if ((c.uptime ?? 100) < 95 || (c.last.ms ?? 0) > SLOW) return 'warn';
  return 'good';
}
async function refresh() {
  try {
    const data = await (await fetch('/data', { cache: 'no-store' })).json();
    document.getElementById('sub').textContent = 'Atualiza a cada ' + data.interval + ' s · últimos 30 min · ' + new Date().toLocaleTimeString('pt-BR');
    const v = data.verdict;
    document.getElementById('vdot').className = 'dot ' + ({ good: 'good', warn: 'warn', bad: 'bad' }[v.level] || '');
    document.getElementById('vtext').textContent = v.text;
    document.getElementById('players').textContent = data.apiStatus ? 'Jogadores online agora: ' + data.apiStatus.online : '';
    const groups = {};
    data.checks.forEach((c) => (groups[c.group] ||= []).push(c));
    document.getElementById('groups').innerHTML = Object.entries(groups).map(([name, list]) =>
      '<h2>' + name + '</h2><div class="grid">' + list.map((c) =>
        '<div class="card"><div class="head"><span class="dot ' + level(c) + '"></span>' + c.label +
        '<span class="ms">' + (c.last ? (c.last.ok ? c.last.ms + ' ms' : 'falhou') : '…') + '</span></div>' +
        spark(c.samples) +
        '<div class="stats"><span>no ar ' + (c.uptime ?? '–') + '%</span><span>média ' + (c.avg ?? '–') + ' ms</span><span>pior ' + (c.p95 ?? '–') + ' ms</span></div>' +
        '<div class="detail">' + (c.last && !c.last.ok ? c.last.detail : '') + '</div></div>'
      ).join('') + '</div>').join('');
  } catch { document.getElementById('vtext').textContent = 'O monitor parou: veja o terminal.'; }
}
refresh(); setInterval(refresh, 5000);
</script>
</body>
</html>`

http
  .createServer((request, response) => {
    if (request.url === '/data') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify(summary()))
      return
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(PAGE)
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`Painel de status: http://localhost:${PORT}  (Ctrl+C para parar)`)
  })

runChecks()
setInterval(runChecks, INTERVAL_MS)
