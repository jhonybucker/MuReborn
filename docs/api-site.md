# API do site

Todas as rotas que o site (`site/`) chama na API da VPS, em `https://mu-reborn.duckdns.org/api`.
O cliente fica em `site/lib/api.ts`.

Formato comum:

- Respostas em JSON com `ok: true` em sucesso. Em erro, `ok: false` e `error` com um código curto.
- O site espera até 10 segundos. Sem resposta, mostra "indisponível" e tenta de novo depois.
- Status usados pelo site: **401** sessão inválida ou login errado, **404** não encontrado,
  **429** muitas tentativas. Qualquer outro erro vira "Erro no servidor".

| Rota | Situação | Usada em |
| --- | --- | --- |
| `POST /signup` | já existe | Criar conta (home) |
| `GET /status` | já existe | Status e rankings (home) |
| `GET /rankings` | existe, **ganha parâmetros** | home e `/ranking` |
| `GET /rankings/guilds` | **nova** | `/ranking`, aba Guilds |
| `GET /online` | **nova** | `/ranking`, aba Online agora |
| `GET /characters/:name` | **nova** | `/personagem/:nome` |
| `GET /events` | **nova** | Notícias e eventos (home) e `/eventos` |
| `POST /login` | **nova** | `/painel` |
| `GET /me/characters` | **nova** | `/painel` |
| `POST /me/password` | **nova** | `/painel`, Trocar senha |
| `POST /logout` | **nova** | `/painel` |

Enquanto uma rota nova não existir, a parte do site que depende dela mostra "indisponível" e o
resto continua funcionando.

---

## Rotas públicas

### GET /rankings

Hoje a rota responde sem parâmetros. Ela continua igual quando chamada sem nada, e passa a aceitar:

| Parâmetro | Valores | Padrão |
| --- | --- | --- |
| `tab` | `general` (por resets, depois level), `master` (só quem tem master reset), `class` | `general` |
| `class` | classe base quando `tab=class`: `0` Dark Wizard, `1` Dark Knight, `2` Fairy Elf, `3` Magic Gladiator, `4` Dark Lord | — |
| `limit` | 1 a 100 | 10 |

Para `tab=class`, filtrar por `Class / 16 = class` (inclui as evoluções: Soul Master, Blade Knight, Muse Elf).

```json
{
  "ok": true,
  "rankings": [{ "name": "DarkKing", "class": 17, "level": 400, "resets": 12, "master": true }]
}
```

### GET /rankings/guilds

Parâmetro `limit` (1 a 100, padrão 50). Ordem por `score`, do maior para o menor.

```json
{
  "ok": true,
  "guilds": [{ "name": "Lendas", "master": "DarkKing", "members": 12, "score": 340 }]
}
```

Fonte provável: `Guild` (`G_Name`, `G_Master`, `G_Score`) e a contagem de `GuildMember` por `G_Name`.

### GET /online

Quem está conectado agora, ordenado por resets e depois level.

```json
{
  "ok": true,
  "players": [{ "name": "SoulX", "class": 1, "level": 397, "resets": 9, "master": true, "map": 2 }]
}
```

Online = `MEMB_STAT.ConnectStat = 1` da conta **e** `AccountCharacter.GameIDC = Name`.
`map` é o número do mapa (`MapNumber`); o site traduz o nome.

### GET /characters/:name

Perfil público. `name` vem codificado na URL (`encodeURIComponent`).

```json
{
  "ok": true,
  "character": {
    "name": "DarkKing",
    "class": 17,
    "level": 400,
    "resets": 12,
    "master": true,
    "online": false,
    "guild": "Lendas",
    "strength": 32767,
    "agility": 15000,
    "vitality": 20000,
    "energy": 5000,
    "command": 0
  }
}
```

- Não existe: **404** `{ "ok": false, "error": "not_found" }`.
- `guild`: `null` quando o personagem não tem guild.
- **Não** devolver zen, mapa, coordenadas nem o login da conta: o perfil é aberto a qualquer pessoa,
  e posição em tempo real facilita perseguir jogadores.

### GET /events

Próximo horário de cada evento, calculado pelo servidor a partir da agenda do jogo.

```json
{
  "ok": true,
  "now": "2026-10-16T20:14:05-03:00",
  "events": [
    {
      "id": "blood-castle",
      "name": "Blood Castle",
      "next": "2026-10-16T22:00:00-03:00",
      "entryMinutes": 5,
      "schedule": "A cada 2 horas",
      "map": "Blood Castle 1 a 7",
      "description": "Invasão ao castelo em party, com tempo limite.",
      "today": ["2026-10-16T00:00:00-03:00", "2026-10-16T02:00:00-03:00", "…", "2026-10-16T22:00:00-03:00"]
    }
  ]
}
```

- `now`: hora atual do servidor. O site usa para acertar a contagem quando o relógio do jogador
  está adiantado ou atrasado.
- `next`: **próximo** início, ISO 8601 **com fuso**. Se o evento está com a entrada aberta agora,
  mande o início atual (o site mostra "Acontecendo agora" enquanto `now` < `next` + `entryMinutes`).
- `entryMinutes`: por quantos minutos a entrada fica aberta depois do início.
- `schedule` e `map`: texto livre e opcional, mostrado abaixo do nome.
- `id`: identificador estável. Para `blood-castle`, `devil-square` e `chaos-castle` o site já tem
  ícone e descrição próprios; outros ids aparecem com um ícone genérico.
- `description` (opcional): substitui a descrição padrão do site.
- `today` (opcional): todos os inícios do dia de hoje, para a linha do tempo de `/eventos`.
  Sem ele, a linha do tempo marca só o próximo início.
- Os horários vêm da configuração dos eventos no servidor do jogo (Blood Castle, Devil Square,
  Chaos Castle, invasões). O site atualiza a lista a cada 5 minutos.

---

## Conta (com login)

### POST /login

```json
{ "login": "guerreiro", "password": "1234" }
```

Sucesso: `{ "ok": true, "token": "<token opaco, ex. 32 bytes aleatórios em hex>", "login": "guerreiro" }`

Erros: **401** `{ "ok": false, "error": "invalid_credentials" }` para login inexistente **ou** senha
errada (mesma resposta nos dois casos); **429** `{ "ok": false, "error": "rate_limited" }`.

Validar contra `MEMB_INFO` (`memb___id` / `memb__pwd`), do mesmo jeito que o JoinServer valida no jogo.

As rotas abaixo recebem `Authorization: Bearer <token>`. Token ausente, inválido ou expirado:
**401** `{ "ok": false, "error": "unauthorized" }` (o site pede login de novo).

### GET /me/characters

```json
{
  "ok": true,
  "characters": [
    {
      "name": "DarkKing",
      "class": 17,
      "level": 400,
      "resets": 12,
      "master": true,
      "online": false,
      "strength": 32767,
      "agility": 15000,
      "vitality": 20000,
      "energy": 5000,
      "command": 0,
      "points": 120,
      "zen": 15000000,
      "map": 0,
      "x": 135,
      "y": 128
    }
  ]
}
```

Colunas prováveis na tabela `Character` (confirmar no banco de vocês):

| Campo | Coluna |
| --- | --- |
| `name` | `Name` |
| `class` | `Class` — código cru (0, 1, 16, 17, 32, 33, 48, 64); o site traduz nome e evolução |
| `level` | `cLevel` |
| `resets`, `master` | as mesmas colunas que `/rankings` já usa |
| `strength`, `agility`, `vitality`, `energy` | `Strength`, `Dexterity`, `Vitality`, `Energy` |
| `command` | `Leadership` (só Dark Lord; 0 nos outros) |
| `points` | `LevelUpPoint` |
| `zen` | `Money` |
| `map`, `x`, `y` | `MapNumber`, `MapPosX`, `MapPosY` |
| `online` | igual a `/online` |

Filtrar sempre por `AccountID` = login do token. Nunca aceitar o login pela URL ou pelo corpo.

### POST /me/password

```json
{ "currentPassword": "1234", "newPassword": "abcd5678" }
```

- Sucesso: `{ "ok": true }`.
- Senha atual errada: **400** `{ "ok": false, "error": "invalid_credentials" }`
  (não usar 401 aqui: o site trataria como sessão expirada).
- Senha nova fora da regra (4 a 10 caracteres, sem espaços, mesma regra do `/signup`):
  **400** `{ "ok": false, "error": "invalid_password" }`.
- Depois de trocar, invalidar os **outros** tokens da conta e manter o atual.
- Aplicar o mesmo limite de tentativas do `/login`.

### POST /logout

Invalida o token e responde `{ "ok": true }`. O site descarta a sessão local mesmo se falhar.

---

## Segurança

- **CORS:** liberar só a origem do site publicado (e `http://localhost:3000` para desenvolvimento),
  com o cabeçalho `Authorization` permitido. Pedidos com esse cabeçalho disparam preflight `OPTIONS`.
- **Token:** aleatório e opaco, guardado no servidor com o login e a validade (ex.: 2 horas).
  O site guarda em `sessionStorage`, que some ao fechar o navegador.
- **Limite de tentativas:** em `/login` e `/me/password`, por IP (ex.: 5 por minuto), respondendo 429.
- **Senha:** nunca devolver em nenhuma resposta nem gravar em log.
- **SQL:** consultas parametrizadas sempre. `:name` e os parâmetros de `/rankings` vêm do usuário;
  validar `tab`, `class` e `limit` contra os valores da tabela acima.
- **HTTPS:** obrigatório, porque senhas vão no corpo dos `POST`.
- **Cache:** rotas públicas podem ter cache curto (ex.: 60 s) para aguentar acessos simultâneos.
