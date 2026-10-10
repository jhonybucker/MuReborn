# Guia de execucao — MU Online v99b na VPS (piloto privado)

> Leia este guia por completo antes de executar qualquer comando na VPS.
> Todos os comandos abaixo usam **caminhos e IPs de exemplo** — substitua pelos
> seus valores reais. Nunca cole senhas em linha de comando, scripts ou logs.

## 1. Objetivo e escopo

Preparar o pacote **MuDevs Free - Release II Files 99b** em uma VPS
**Windows Server 2019** ate um piloto privado jogavel (proprietario + 2 a 5
amigos, ~2 horas), com orquestracao em etapas pelo script:

- Script: `mu99-vps/Install-MU99-Safe.ps1` (Windows PowerShell 5.1, sem
  dependencias externas, sem acesso remoto).
- Harness local de regressao: `mu99-vps/tests/Run-Tests.ps1`
  (259 casos, sem tocar na VPS).

O script **nunca**: instala SQL/runtimes/extratores, executa
`.exe/.bat/.cmd/.ps1` do pacote automaticamente, cria exclusoes do Defender,
altera regras pre-existentes de firewall, restaura `*.bak` arbitrarios
(**apenas `DB\MuOnline.bak`**) ou cria auto-start/servico/tarefa agendada.

O servidor **so pode ser chamado de “jogavel”** apos cumprir o checklist da
secao 9 (login externo, personagem, persistencia, reinicio, backup testado e
piloto com 2–5 jogadores). Resultado do harness local **nao** substitui esses
testes.

## 2. Decisoes que so o operador pode tomar (bloqueios)

| # | Decisao | Onde registrar |
|---|---------|----------------|
| 1 | Espaco livre/RAM/IP publico estavel da VPS | Relatorio `Diagnostico` |
| 2 | Instancia SQL local a usar (versao/edicao/autenticacao) — ver secao 6 | Decisao manual + `ValidarDependencias` |
| 3 | Endereco do servidor a gravar nas configs (ex.: `203.0.113.10`) | Parametro `-ServerAddress` |
| 4 | VPN vs. portas de jogo publicas; firewall do provedor (fora do script) | Secao 7 + painel do provedor |
| 5 | Direitos de uso do cliente antes de compartilhar com amigos | `-ConfirmPrivateClientDistributionRights` |
| 6 | Ordem de inicializacao dos componentes (a partir da doc da release) | Manifesto JSON (`Iniciar`) |
| 7 | Portas de jogo aprovadas para o firewall | `-ApprovedGamePorts` |
| 8 | Aceite de binarios sem assinatura (`-AcceptUnsignedBinaries`) | Somente apos avaliar a origem do pacote |

Enquanto qualquer item acima estiver pendente, o modo correspondente **para
com mensagem de bloqueio** — isso e o comportamento esperado, nao um erro.

## 3. Pastas de saida (escolhidas pelo operador)

O operador informa `-DestinationRoot` (ex.: `C:\MU99\out`). O script cria,
**sem nunca sobrescrever**:

- `reports\` — diagnostico, inventario, planos e propostas (redigidos, sem
  senhas).
- `backups\` — copias exatas pre-edicao (`<arquivo>.<timestamp>.bak`) e
  backup pre-restore do banco.
- `staging\` ou o proprio `DestinationRoot` de staging — arquivos extraidos
  (originais do ZIP preservados), com `server/` e `libraries/` segregados e
  `client/` criado somente pelo `PrepararCliente`.
- `state\firewall-manifest.json` — regras criadas pelo script (para reversao).

## 4. Fase a fase

Use sempre PowerShell **elevado** apenas onde indicado. Modos mutaveis pedem
confirmacao e respeitam `-WhatIf` (simula sem alterar nada).

### Fase 0 — Diagnostico (somente leitura, modo padrao)

```powershell
.\mu99-vps\Install-MU99-Safe.ps1 -Mode Diagnostico `
  -PackageZipPath C:\pacotes\pacote-99b.zip `
  -DestinationRoot C:\MU99\out
```

Verifica: versao Windows/PowerShell, RAM, disco livre por volume, servicos e
instancias SQL detectaveis, extratores instalados, entradas e hash SHA-256 do
ZIP, `DB\MuOnline.bak` esperado e portas observadas nas configs. Quando ha
extrator, cada RAR aninhado (servidor/cliente/bibliotecas) e **listado de
verdade**: apenas o blob `.rar` e copiado para um temporario (caminho
validado), os membros sao listados e o temporario e removido — **nenhum
membro e extraido** no diagnostico. Cada RAR recebe status individual
(`listed`, `list-failed` com o erro, ou `pending-no-tool`); `.bak`,
executaveis e configs detectados via membros entram no inventario, e falha
ou pendencia de listagem vira bloqueio honesto (nunca "listed" falso).
Gera `reports\diagnostico-<timestamp>.json`.
**Nao altera** arquivos, servicos, banco, firewall ou Defender. Revise os
`blockers` e `openQuestions` do relatorio antes de prosseguir.

### Fase 1 — PrepararArquivos (staging validado)

```powershell
.\mu99-vps\Install-MU99-Safe.ps1 -Mode PrepararArquivos `
  -PackageZipPath C:\pacotes\pacote-99b.zip `
  -DestinationRoot C:\MU99\stage-20261010-1200 -WhatIf   # simula primeiro

.\mu99-vps\Install-MU99-Safe.ps1 -Mode PrepararArquivos `
  -PackageZipPath C:\pacotes\pacote-99b.zip `
  -DestinationRoot C:\MU99\stage-20261010-1200
```

Valida **todas** as entradas antes de extrair (recusa traversal, caminhos
absolutos/UNC e saidas do destino), estima espaco livre, exige extrator
(7-Zip/WinRAR **ja instalado**) quando ha RARs aninhados e extrai para um
diretorio **novo** (destino existente = erro, sem sobrescrita). Depois do ZIP
externo, cada RAR aninhado e **listado por completo e validado membro a
membro antes de gravar qualquer membro**: traversal, caminhos absolutos/UNC,
nomes de dispositivo reservado (`NUL`, `COM1`…), nomes terminados em
ponto/espaco e qualquer indicador de link (`Symbolic Link`, `Hard Link`,
`Type=Link`, `->`, `symlink`, `junction`, modos `lrwx`) ou forma de atributos
desconhecida bloqueiam a expansao. RARs de servidor e bibliotecas vao para
`server/` e `libraries/` (raiz comum unica removida apos revalidacao); o RAR
do cliente e **ignorado aqui** e so pode sair via `PrepararCliente`; RAR
desconhecido bloqueia tudo. Antes de chamar o extrator, o destino (se
existir) e a pasta pai sao verificados contra reparse point/junction; apos
extrair, varredura recursiva (incluindo a propria raiz) remove a arvore e
aborta em qualquer violacao. Falha do extrator remove a arvore parcial; se a
limpeza for insegura, nada e apagado e o erro pede remocao manual
(`LIMPEZA PENDENTE`). Nenhum conteudo do pacote e executado. Se o Defender
acusar algum binario, trate como **bloqueio** e avalie com um humano.

Limite conhecido e documentado: a listagem resumida do UnRAR nao distingue
hardlinks de arquivos regulares (verificado empiricamente); por isso, alem da
triagem acima, a varredura pos-extracao rejeita reparse points e **nenhuma
config e escrita atraves de link** — antes de gravar, cada alvo precisa
existir como arquivo comum com exatamente 1 link (`fsutil`), e a escrita
trava quando isso nao pode ser verificado.

### Fase 2 — ValidarDependencias (somente leitura do staging)

```powershell
.\mu99-vps\Install-MU99-Safe.ps1 -Mode ValidarDependencias `
  -DestinationRoot C:\MU99\stage-20261010-1200
```

Lista servicos SQL, arquitetura/versao/assinatura dos executaveis e
instaladores VC++ **encontrados (sem executar)**. Nao instala nada. Decida a
versao do SQL conforme a **secao 6** e volte a validar depois de instala-la
manualmente.

### Fase 3 — Configurar (proposta + diff, depois escrita com backup)

O script reconhece **exatamente**:

- `ConnectServer\ServerList.dat` — token `"TUIP"`.
- `Data\MapServerInfo.dat` — token `STUIP` (placeholder observado no pacote).
- Cliente `Config.ini` — linha `IpAddress = TUIP` (modo `PrepararCliente`).

Qualquer layout diferente (duplicado, ausente, sintaxe nova, encoding
inesperado) **bloqueia sem escrever** e preserva os bytes originais.

```powershell
.\mu99-vps\Install-MU99-Safe.ps1 -Mode Configurar `
  -DestinationRoot C:\MU99\stage-20261010-1200 `
  -ServerAddress 203.0.113.10 -WhatIf   # revisa a proposta primeiro
```

(`Configurar`, `ValidarDependencias` e a busca do `Banco` usam
`DestinationRoot\server\` quando o staging segregado existe; com layout
plano, usam o proprio `DestinationRoot`. Passe a raiz do servidor ao
`Iniciar` da mesma forma.)

A execucao real mostra a proposta (arquivo/chave/antes/depois), salva backup
com SHA-256 verificavel em `backups\` e aplica **somente** as chaves
reconhecidas, preservando encoding/BOM/quebras de linha. Relatorios omitem
segredos.

### Fase 4 — Banco (somente `DB\MuOnline.bak`, com `VERIFYONLY` e backup previo)

```powershell
.\mu99-vps\Install-MU99-Safe.ps1 -Mode Banco `
  -SqlInstance '.\SQLEXPRESS' -DatabaseName MuOnline `
  -DestinationRoot C:\MU99\stage-20261010-1200 -WhatIf

.\mu99-vps\Install-MU99-Safe.ps1 -Mode Banco `
  -SqlInstance '.\SQLEXPRESS' -DatabaseName MuOnline `
  -DestinationRoot C:\MU99\stage-20261010-1200 `
  -ConfirmDatabaseOverwrite
```

Regras: instancia **local explicita** (remota e recusada); testa a conexao
(Windows Authentication; se falhar, a senha e pedida **interativamente**, nunca
em argumento/log); roda `HEADERONLY`/`FILELISTONLY`/`VERIFYONLY` no
`DB\MuOnline.bak`; aborta se o banco existe e falta
`-ConfirmDatabaseOverwrite`; aborta se ha sessoes ativas (sem derruba-las);
faz backup pre-restore **verificado** antes de sobrescrever. O `.bak` e
procurado em `server\DB\MuOnline.bak`, `staging\DB\MuOnline.bak` ou
`DB\MuOnline.bak` sob o staging.

Credencial legada em texto claro: **etapa manual bloqueada** — o script nunca
grava, le nem transporta senhas de banco (só usa a credencial interativa e
transiente para conectar, sempre redigida em saidas). Se o software legado
exigir senha em texto claro em algum arquivo, configure-o manualmente fora do
script, com ACL restrita aplicada por voce, e registre a limitacao: nenhum
relatorio do script contera esse valor.

### Fase 5 — PrepararCliente (extrai o cliente em staging, original preservado)

```powershell
.\mu99-vps\Install-MU99-Safe.ps1 -Mode PrepararCliente `
  -DestinationRoot C:\MU99\stage-20261010-1200 `
  -ServerAddress 203.0.113.10 `
  -ConfirmPrivateClientDistributionRights
```

Localiza o blob do RAR do cliente dentro do staging, expande-o para
`client/` com as **mesmas validacoes da Fase 1** (lista total, sem links,
sem reparse na raiz/parent, varredura pos-extracao) e so entao propoe e
aplica `IpAddress` em `client\Config.ini`, com backup como na Fase 3. Sem o
switch de direitos, sem blob localizado, com `client/` pre-existente ou com
`Config.ini` irreconhecivel, o modo **bloqueia sem alterar nada**. Nao publica
nem distribui arquivos — a distribuicao aos amigos e manual e privada.

### Fase 6 — Iniciar (manifesto explicito, ordem confirmada)

Monte o manifesto a partir dos executaveis descobertos e da documentacao da
release (exemplo — revise `path`, `workingDirectory` e `order`):

```json
{ "components": [
  { "name": "ConnectServer", "path": "ConnectServer\\ConnectServer.exe",
    "workingDirectory": "ConnectServer", "order": 1 }
] }
```

```powershell
.\mu99-vps\Install-MU99-Safe.ps1 -Mode Iniciar `
  -ComponentManifestPath C:\MU99\componentes.json `
  -DestinationRoot C:\MU99\stage-20261010-1200 `
  -AcceptUnsignedBinaries -WhatIf

.\mu99-vps\Install-MU99-Safe.ps1 -Mode Iniciar `
  -ComponentManifestPath C:\MU99\componentes.json `
  -DestinationRoot C:\MU99\stage-20261010-1200 `
  -AcceptUnsignedBinaries
```

Cada componente pede confirmacao, registra PID/horario e aponta logs. Nunca
executa `StartUp.exe`/`.bat`/instaladores nem cria servico/tarefa/auto-start.

### Fase 7 — Firewall do Windows (plano, revisao, aplicacao, reversao)

Portas **observadas** no pacote (confirme contra o seu staging):

| Porta | Papel observado | Sugestao |
|-------|-----------------|----------|
| 44405 | ConnectServer TCP (cliente) | TCP |
| 55557 | ConnectServer UDP | UDP |
| 55558 | ConnectServer TCP (Join) | TCP |
| 55901 | GameServer | TCP |
| 55960 | DataServer | TCP |
| 55970 | JoinServer | TCP |

```powershell
# Somente leitura: gera reports\firewall-plano-*.json
.\mu99-vps\Install-MU99-Safe.ps1 -Mode PlanoFirewall `
  -ApprovedGamePorts 44405,55557,55901,55960,55970 `
  -ApprovedProtocols TCP,UDP `
  -DestinationRoot C:\MU99\out

# Aplica (PowerShell elevado + confirmacao): regras MU99-Pilot-* + manifesto
.\mu99-vps\Install-MU99-Safe.ps1 -Mode AplicarFirewall `
  -ApprovedGamePorts 44405,55557,55901,55960,55970 `
  -ApprovedProtocols TCP,UDP `
  -DestinationRoot C:\MU99\out

# Reversao (remove SOMENTE as regras do manifesto)
.\mu99-vps\Install-MU99-Safe.ps1 -Mode ReverterFirewall `
  -DestinationRoot C:\MU99\out
```

Proibido: 1433/1434 (SQL), 3389 (RDP), portas nao aprovadas e qualquer regra
pre-existente. Antes de planejar ou aplicar, o script observa **portas
administrativas**: conhecidas (1433/1434/3389), derivadas de servicos SQL/RDP
em execucao (inclui portas customs quando o servico as declara) e listeners
locais em portas administrativas ou pertencentes a processos de
sistema/administracao — com processo dono registrado no relatorio para sua
revisao. Qualquer aprovada nesse conjunto **recusa tudo antes de criar
regra**. A mesma recusa vale para **porta aprovada ocupada por processo
desconhecido** (dono nao identificavel, ex.: enumeracao sem elevacao nao
resolveu o PID): sem identidade nao ha como provar que nao e administrativo.
Listeners de processos comuns identificados (ex.: os proprios componentes MU
ja iniciados) nao bloqueiam, apenas constam do relatorio. Se servicos ou
listeners nao puderem ser verificados, os modos travam ate verificacao
manual. O firewall **do provedor** (painel externo) e configurado
manualmente — ver secao 7.

## 5. Rollback

- **Staging/config**: reaplique os arquivos de `backups\` (nomes com
  timestamp) sobre o staging e confira o SHA-256. O ZIP original nunca e
  modificado. Expansao com falha remove so a arvore parcial que o script
  criou; conteudo pre-existente nunca e apagado — se o erro disser
  `LIMPEZA PENDENTE`, remova manualmente o caminho indicado apos inspeciona-lo.
- **Banco**: restaure o `.bak` de `backups\<banco>-pre-restore-<timestamp>.bak`
  (gerado e verificado antes de qualquer sobrescrita).
- **Firewall**: `ReverterFirewall` remove apenas `MU99-Pilot-*` do manifesto;
  regras alheias nunca sao tocadas.
- **Processos**: encerre os componentes pela ordem inversa no Gerenciador de
  Tarefas/Services (o script nao cria auto-start, entao basta nao reinicia-los).
- Relatorios e manifestos nunca sao sobrescritos — cada execucao gera um novo
  arquivo com timestamp.

## 6. Limitacao SQL Server (leitura obrigatoria)

- O requisito “SQL Server 2012 R2” da publicacao comunitaria esta
  **incorreto/ambiguo** e nao autoriza instalacao automatica.
- Pela matriz da Microsoft, o **SQL Server 2008 R2 nao e suportado no Windows
  Server 2019**; o **SQL Server 2012 SP4** consta como compativel com o SO,
  mas esta **fora de suporte desde julho/2022**.
- Restaurar o `.bak` em versao nova (ex.: 2019 aceita backups de 2008+) **nao
  prova** que os executaveis legados conectam — o driver/conexao usado pelo
  GameServer/JoinServer/ConnectServer precisa de **teste real**.
- A instalacao do SQL e **manual**, apos decisao de compatibilidade/licenca;
  depois, rode `ValidarDependencias` e `Banco` novamente.

## 7. Rede, provedor e acessos (manual, fora do script)

- O script nao ajusta firewall do provedor, DNS, NAT, RDP, contas, antivirus,
  Windows Update ou compartilhamento de arquivos.
- Escolha **VPN** (recomendado) ou portas de jogo publicas; libere no painel
  do provedor **somente** as portas aprovadas da Fase 7. **Nunca exponha**
  SQL (1433/1434) ou RDP (3389).
- RDP: acesso individual com senha forte; nao compartilhe credenciais.
- Cliente: distribuicao privada apenas aos participantes do piloto, apos a
  confirmacao de direitos (Fase 5).

## 8. Incidentes

- **Defender acusa binario**: pare, nao crie exclusao, registre o relatorio e
  avalie a origem do pacote com um humano antes de continuar.
- **Link/reparse detectado** (na listagem, na raiz/parent ou na varredura):
  pare — a expansao/escrita aborta e a arvore parcial e removida (ou
  preservada com aviso `LIMPEZA PENDENTE` quando remover seria inseguro).
  Nunca extraia o RAR por fora do script para "dar um jeito".
- **Config desconhecida**: o modo `Configurar` bloqueia — envie o diff do
  relatorio para revisao humana; nunca edite em massa com busca/substituicao.
- **Banco em uso / restore falha**: aborte, preserve o backup previo e revise
  sessoes/espaco/permissoes antes de repetir.
- **Queda no piloto**: colete `reports\`, logs dos componentes, uso de
  CPU/RAM/disco e horarios de desconexao antes de reiniciar.

## 9. Checklist de aceitacao “jogavel” (todos obrigatorios)

Mapeamento para os 10 criterios da especificacao:

1. `Diagnostico` nao altera nada (so cria relatorio redigido) — relatorio em
   `reports\`, com listagem real por RAR e status honesto por membro.
2. `PrepararArquivos` recusa pacote ausente/corrompido, sem extrator, sem
   espaco, traversal, links, reparse na raiz/parent e RAR desconhecido;
   segrega `server/` e `libraries/` e pula o cliente — verificado pelo
   harness (casos Task 3/3B) e na VPS.
3. `Configurar` mostra chaves/arquivos exatos, com backup verificavel; ignora
   chaves nao reconhecidas — proposta em tela + `backups\`.
4. `Banco` so usa `DB\MuOnline.bak`, valida antes, exige switch de
   sobrescrita e guarda backup previo — logs da Fase 4.
5. Nada instala SQL/runtimes nem executa o pacote implicitamente — revisao
   manual + harness (casos Task 4/5/6).
6. `-WhatIf` nao altera nada; mudancas reais mostram alvo e pedem confirmacao
   — exercitado em cada fase.
7. `PlanoFirewall` nao abre nada; `AplicarFirewall` recusa SQL/RDP, portas de
   servicos observados, listeners administrativos, portas aprovadas com dono
   desconhecido e portas nao aprovadas (e trava se servicos/listeners nao
   puderem ser verificados); `ReverterFirewall` preserva regras alheias —
   manifesto em `state\`.
8. `Iniciar` respeita a ordem do manifesto, sem auto-start — PIDs/logs.
9. Este guia cobre rollback, firewall do provedor, backup/restore,
   distribuicao do cliente e incidentes — secoes 5–8.
10. **Piloto manual**: login externo OK; criar/entrar com personagem OK; jogo
    basico OK; persistencia apos reconexao **e** reinicio OK; drill de
    backup/restore OK; 2–5 jogadores por ~2h com recursos e desconexoes
    medidos OK.

## 10. Comandos de verificacao local (sem VPS)

```powershell
powershell.exe -NoProfile -File .\mu99-vps\tests\Run-Tests.ps1
powershell.exe -NoProfile -Command "Get-Help .\mu99-vps\Install-MU99-Safe.ps1 -Full"
```

Nao execute o script principal contra esta maquina nem contra a VPS a partir
daqui — ele e para execucao **manual do proprietario na VPS**.
