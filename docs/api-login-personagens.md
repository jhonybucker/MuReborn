# API: login e personagens

A página `/painel` do site (`site/components/account-panel.tsx`, cliente em `site/lib/account-api.ts`)
espera três rotas novas na mesma API de `/api/signup`, `/api/status` e `/api/rankings`
(`https://mu-reborn.duckdns.org/api`). Enquanto elas não existirem, a página mostra
"Não foi possível conectar ao servidor".

Todas as respostas são JSON com `ok: true|false`. Em erro, `error` traz um código curto.

## POST /api/login

Pedido:

```json
{ "login": "guerreiro", "password": "1234" }
```

Sucesso (200):

```json
{ "ok": true, "token": "<token opaco, ex. 32 bytes aleatórios em hex>", "login": "guerreiro" }
```

Erros:

| Status | Corpo | Quando |
| --- | --- | --- |
| 401 | `{ "ok": false, "error": "invalid_credentials" }` | login não existe **ou** senha errada (mesma resposta nos dois casos) |
| 429 | `{ "ok": false, "error": "rate_limited" }` | muitas tentativas do mesmo IP |

Validar a senha contra `MEMB_INFO` (`memb___id` / `memb__pwd`), do mesmo jeito que o JoinServer valida
no jogo. O site usa o texto exato `invalid_credentials` para mostrar "Login ou senha incorretos.".

## GET /api/me/characters

Cabeçalho: `Authorization: Bearer <token>`

Sucesso (200):

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

Token ausente, inválido ou expirado: **401** `{ "ok": false, "error": "unauthorized" }`
(o site usa esse texto exato para pedir login de novo).

De onde vem cada campo, na tabela `Character` do banco `MuOnline` (confirmar os nomes no banco de vocês):

| Campo | Coluna |
| --- | --- |
| `name` | `Name` |
| `class` | `Class` — o código cru (0, 1, 16, 17, 32, 33, 48, 64); o site traduz o nome e a evolução |
| `level` | `cLevel` |
| `resets`, `master` | as mesmas colunas que o `/api/rankings` já usa |
| `strength`, `agility`, `vitality`, `energy` | `Strength`, `Dexterity`, `Vitality`, `Energy` |
| `command` | `Leadership` (só Dark Lord; 0 nos outros) |
| `points` | `LevelUpPoint` |
| `zen` | `Money` |
| `map`, `x`, `y` | `MapNumber`, `MapPosX`, `MapPosY` — o número do mapa; o site traduz o nome |
| `online` | `MEMB_STAT.ConnectStat = 1` da conta **e** `AccountCharacter.GameIDC = Name` |

Filtrar sempre por `AccountID` = login do token. Nunca aceitar o login pela URL ou pelo corpo.

## POST /api/logout

Cabeçalho: `Authorization: Bearer <token>`. Invalida o token e responde `{ "ok": true }`.
O site descarta a sessão local mesmo se essa chamada falhar.

## Segurança

- **CORS:** liberar só a origem do site publicado (e `http://localhost:3000` para desenvolvimento),
  com o cabeçalho `Authorization` permitido. O pedido com esse cabeçalho dispara preflight `OPTIONS`.
- **Token:** aleatório e opaco, guardado no servidor com o login e a validade (ex.: 2 horas).
  O site guarda em `sessionStorage`, que some ao fechar o navegador.
- **Limite de tentativas:** limitar `/api/login` por IP (ex.: 5 por minuto), respondendo 429.
- **Senha:** nunca devolver a senha em nenhuma resposta, nem gravar em log.
- **SQL:** usar consultas parametrizadas; o login vem do usuário.
- **HTTPS:** obrigatório, porque a senha vai no corpo do `POST`.
