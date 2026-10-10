# MU v99 VPS Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a safe, staged PowerShell workflow and Portuguese runbook to prepare the private MU Online v99b pilot on the user's Windows Server 2019 VPS.

**Architecture:** A single PowerShell 5.1 script exposes explicit modes and shared validation/reporting helpers. The default mode is read-only diagnosis; package extraction, config edits, SQL restore, process start, and Windows Firewall changes are separate confirmed operations. A dependency-free regression harness exercises filesystem, redaction, parser, database-command, and firewall-plan boundaries without changing the host.

**Tech Stack:** Windows PowerShell 5.1, .NET Framework APIs present on Windows Server 2019, `System.Data.SqlClient`, built-in Windows Firewall cmdlets, and a test harness written in PowerShell with no module downloads. RAR extraction may use an already-installed 7-Zip or WinRAR; the script must not download one.

**Spec:** `docs/superpowers/specs/2026-10-09-mu99-vps-automation-design.md`

## Global Constraints

- Do not modify the Three.js prototype under `src/`; keep all deployment artifacts under `mu99-vps/`.
- Windows PowerShell 5.1 is the minimum runtime; no PowerShell Gallery module or external dependency may be installed by the script.
- `Diagnostico` is the default mode and must not change existing inputs, services, database, firewall, or Defender; it may create a new report file.
- Never run installers or archived `.exe`, `.bat`, `.cmd`, or `.ps1` files automatically; never add Defender exclusions or install SQL automatically.
- Only stage the user's explicitly supplied package and only restore `DB\MuOnline.bak`; never search for or restore arbitrary `*.bak` files.
- Every filesystem path derived from archive entries must be checked to remain inside the chosen staging root.
- Mutating modes must use `SupportsShouldProcess`, honor `-WhatIf` and `-Confirm`, identify the target before mutation, and preserve a reversible backup where applicable.
- Never expose SQL, RDP, or administration ports; never open game ports without explicit operator approval and never change pre-existing firewall rules.
- Never include credentials in command-line arguments, reports, console logs, or test fixtures. Prompt interactively when credentials are needed; protect legacy plaintext config with restrictive ACL only after explicit opt-in.
- Do not claim the server is playable until external client, persistence, restart, backup/restore, and 2–5-player pilot checks are completed.
- Use the provided `jhonybucker/MuReborn` repository as the project root; keep deployment artifacts under `mu99-vps/` and planning documents under `docs/superpowers/`. Do not push to GitHub without an explicit publication request.

## Review Focus

- A ZIP/RAR entry uses an absolute path, `..`, or a reparse point; reject it and prove no file is written outside staging (Task 3).
- A config file or `TUIP` key has an unknown layout, encoding, or duplicate value; report ambiguity and preserve the original bytes (Task 4).
- `MuOnline.bak` is unreadable, the target database already exists, or it is in use; abort without overwriting and keep the previous backup (Task 5).
- A requested firewall port belongs to SQL/RDP, an observed administrative service, or a pre-existing rule; reject the request and preserve unrelated rules (Task 6).
- SQL credentials or secrets appear in exceptions, command output, or generated reports; redact them and test the exact output (Tasks 1 and 5).

---

## File Map

- Create `mu99-vps/Install-MU99-Safe.ps1`: standalone entry point, shared functions, mode handlers, comment-based help.
- Create `mu99-vps/tests/Run-Tests.ps1`: no-dependency test harness that dot-sources the script in export-functions-only mode and uses temporary directories/fixtures.
- Create `mu99-vps/tests/fixtures/`: synthetic or sanitized package config samples and safe/hostile archive fixtures; never include real credentials or redistribute the client.
- Create `mu99-vps/GUIA-EXECUCAO-MU-V99.md`: Portuguese operator guide, phase commands, decisions, manual provider steps, rollback, and playable acceptance checklist.
- Runtime output belongs under the operator's explicitly chosen destination root (`reports/`, `backups/`, `staging/`, and `state/`); it is not committed or placed in the web-game source folders.

## Task 1: PowerShell entry point, safety core, and test harness

**Files:**
- Create: `mu99-vps/Install-MU99-Safe.ps1`
- Create: `mu99-vps/tests/Run-Tests.ps1`

**Interfaces:**
- Script parameters: `-Mode` (`Diagnostico`, `PrepararArquivos`, `ValidarDependencias`, `Configurar`, `Banco`, `PrepararCliente`, `Iniciar`, `PlanoFirewall`, `AplicarFirewall`, `ReverterFirewall`); `-PackageZipPath`; `-DestinationRoot`; `-ArchiveToolPath`; `-ServerAddress`; `-SqlInstance`; `-DatabaseName`; `-ComponentManifestPath`; `-ApprovedGamePorts`; `-ApprovedProtocols`; and explicit switches `-ConfirmDatabaseOverwrite`, `-ConfirmPrivateClientDistributionRights`, `-AllowPlaintextLegacyDbCredentials`, and `-AcceptUnsignedBinaries`.
- `ConvertTo-Mu99RedactedText([string] $Text) -> [string]`: masks values associated with pass, password, pwd, secret, token, credential, API key, and connection-string password keys.
- `Test-Mu99PathWithinRoot([string] $Root, [string] $Candidate) -> [bool]`: canonicalizes paths and rejects traversal outside the root.
- `Write-Mu99Report([string] $Path, [object] $Report) -> [void]`: creates a new UTF-8 report after redaction; never writes to the package or server source files.
- `-ExportFunctionsOnly` loads functions for the test harness without dispatching a mode.

- [x] **Step 1: Add failing safety-core cases to `Run-Tests.ps1`**

  Assert that a child path is accepted, `..` traversal and a different-root path are rejected, a normal string is unchanged, and fields named `pass`, `password`, `pwd`, `secret`, `token`, `credential`, or `apiKey` have their values masked.

- [x] **Step 2: Run the harness and verify the safety-core cases fail**

  Run: `powershell.exe -NoProfile -File .\mu99-vps\tests\Run-Tests.ps1`
  Expected: FAIL with missing functions/assertions; no system state or files outside the test temporary directory are changed.

- [x] **Step 3: Implement the script parameter block and safety-core functions**

  Add `CmdletBinding(SupportsShouldProcess=$true, ConfirmImpact='High')`, validate mode-specific required arguments before dispatch, add `-ExportFunctionsOnly`, and implement the three exact interfaces above. Use canonical full paths and case-insensitive redaction for secret keys.

- [x] **Step 4: Add regression cases for mode gating and report redaction**

  Assert that omitting `-Mode` selects `Diagnostico`, a mode outside `ValidateSet` is rejected, a mutating mode without its required target fails before dispatch, and the report contains masked values while a pre-existing fixture remains byte-identical.

- [x] **Step 5: Run the harness and verify all Task 1 cases pass**

  Run: `powershell.exe -NoProfile -File .\mu99-vps\tests\Run-Tests.ps1`
  Expected: PASS; output includes case names and a nonzero process exit code only on failure.

## Task 2: Read-only VPS and package diagnosis

**Files:**
- Modify: `mu99-vps/Install-MU99-Safe.ps1`
- Modify: `mu99-vps/tests/Run-Tests.ps1`

**Interfaces:**
- `Get-Mu99EnvironmentSnapshot() -> [pscustomobject]`: reports Windows/PowerShell version, available RAM, free disk per volume, SQL service candidates, and available archive tools.
- `Get-Mu99PackageInventory([string] $PackageZipPath) -> [pscustomobject]`: reports ZIP/RAR entries and sizes when a trusted local archive tool can list them, archive hashes, pending executable-signature checks, and detected MU executable/config/database names without extracting or executing entries. If no RAR lister exists, nested contents are marked pending.
- `Invoke-Mu99Diagnostic([string] $PackageZipPath, [string] $DestinationRoot) -> [string]`: writes one timestamped diagnostic report under `reports/` and returns its path.

- [x] **Step 1: Add failing diagnosis tests using synthetic ZIP/package fixtures**

  Assert required fields for OS/RAM/disk, presence of the three nested RAR names and `DB\MuOnline.bak` when present, SHA-256 output, redaction, and a new report path. Snapshot fixture bytes before the call and assert they remain unchanged.

- [x] **Step 2: Run the harness and verify diagnosis cases fail**

  Run: `powershell.exe -NoProfile -File .\mu99-vps\tests\Run-Tests.ps1`
  Expected: FAIL on missing diagnosis functions; no live SQL, archive extraction, or firewall command is invoked.

- [x] **Step 3: Implement snapshot, ZIP listing, package hashing, and `Diagnostico` dispatch**

  Use read-only CIM/registry/file queries and `System.IO.Compression.ZipArchive` for the outer ZIP; use a trusted, already-installed 7-Zip/WinRAR listing command for nested RARs when available. The default path may create a report only; never modify existing files, services, database, Defender, or firewall. Do not attempt to infer that a binary is safe merely because it is unsigned or has a version resource.

- [x] **Step 4: Add missing-package and corrupt-ZIP cases**

  Assert that missing input and invalid ZIP data produce a clear failure report with no extraction and no overwrite of a prior report.

- [x] **Step 5: Run the harness and verify all Task 2 cases pass**

  Run: `powershell.exe -NoProfile -File .\mu99-vps\tests\Run-Tests.ps1`
  Expected: PASS; fixture hashes match their pre-run values.

## Task 3: Safe archive validation and staging

**Files:**
- Modify: `mu99-vps/Install-MU99-Safe.ps1`
- Modify: `mu99-vps/tests/Run-Tests.ps1`
- Create: `mu99-vps/tests/fixtures/safe-archive.zip`
- Create: `mu99-vps/tests/fixtures/hostile-path-archive.zip`

**Interfaces:**
- `Test-Mu99ArchiveEntryPath([string] $Root, [string] $EntryName) -> [bool]`: rejects rooted paths, traversal, unsupported path forms, and targets that resolve outside the root.
- `Get-Mu99NestedRarInventory([string] $RarPath, [string] $ArchiveToolPath) -> [object[]]`: lists RAR entries via an already-installed supported extractor; does not extract or execute them.
- `Invoke-Mu99StagePackage([string] $PackageZipPath, [string] $DestinationRoot, [string] $ArchiveToolPath) -> [pscustomobject]`: stages to a new timestamped directory only after entry validation, free-space estimation, and `ShouldProcess` approval.

- [x] **Step 1: Add failing safe/hostile archive tests**

  Assert a normal relative entry is accepted; `..\outside.txt`, an absolute drive path, a UNC path, and a path with traversal after normalization are rejected. Assert no outside sentinel is created. Assert duplicate destination or unavailable RAR tool causes a clean stop without overwrite.

- [x] **Step 2: Run the harness and verify archive-path cases fail**

  Run: `powershell.exe -NoProfile -File .\mu99-vps\tests\Run-Tests.ps1`
  Expected: FAIL before path validation is implemented; no archive entry is extracted.

- [x] **Step 3: Implement safe listing and staging**

  Validate every outer ZIP and nested RAR entry before extraction; require already-installed 7-Zip or WinRAR for RARs; never fetch tools. Extract into a newly created staging directory, preserve originals, separate server/client/library trees, and skip client extraction unless the operator selects `PrepararCliente`. After extraction, compute hashes and Authenticode status for executables without running them; any Defender detection or unexplained integrity concern becomes a blocker.

- [x] **Step 4: Add `-WhatIf`, insufficient-space, corrupt-RAR, and existing-target cases**

  Assert `-WhatIf` creates no staging directory, insufficient free space stops before extraction, corrupt RAR stops without partial overwrite, and an existing destination is never overwritten.

- [x] **Step 5: Run the harness and verify all Task 3 cases pass**

  Run: `powershell.exe -NoProfile -File .\mu99-vps\tests\Run-Tests.ps1`
  Expected: PASS; no hostile fixture writes outside its temp root.

## Task 4: Dependency report, server/client configuration proposals

**Files:**
- Modify: `mu99-vps/Install-MU99-Safe.ps1`
- Modify: `mu99-vps/tests/Run-Tests.ps1`
- Create: sanitized configuration fixtures under `mu99-vps/tests/fixtures/`

**Interfaces:**
- `Get-Mu99DependencyReport([string] $ServerRoot) -> [pscustomobject]`: detects SQL services/versions, expected runtime installers, executable architecture/version/signatures, and unknowns; it does not install anything or claim compatibility from backup compatibility alone.
- `Get-Mu99ConfigProposal([string] $ServerRoot, [string] $ClientRoot, [string] $ServerAddress) -> [pscustomobject]`: recognizes only the exact discovered files/keys and returns before/after proposals with secret values redacted.
- `Set-Mu99AddressConfiguration([pscustomobject] $Proposal, [string] $DestinationRoot) -> [string[]]`: backs up exact source files, preserves encoding/BOM/line endings, writes only after `ShouldProcess`, and returns backup paths.

- [x] **Step 1: Inspect extracted configuration files as data and create sanitized fixtures**

  Read only the candidate server/client configuration files identified by the package inventory. Record exact relative paths, key syntax, encoding, and line endings; replace IPs, accounts, passwords, and unique identifiers in fixtures with placeholders. Do not execute a package file.

- [x] **Step 2: Add failing tests for the exact known config formats**

  Assert proposal targets only discovered `TUIP` address entries in `ConnectServer\ServerList.dat`, `Data\MapServerInfo.dat`, and client `Config.ini` when those files and keys exist. Add cases for missing files, duplicate keys, unknown syntax, and ANSI/BOM inputs; assert ambiguous cases yield no proposed write and original bytes remain unchanged.

- [x] **Step 3: Run the harness and verify config cases fail**

  Run: `powershell.exe -NoProfile -File .\mu99-vps\tests\Run-Tests.ps1`
  Expected: FAIL on the not-yet-implemented parser/proposal functions; no original fixture changes.

- [x] **Step 4: Implement dependency reporting and config proposal/write functions**

  Detect SQL Server service/version and bundled VC++ installers without running them. Keep SQL installation out of scope. Replace only the server address in exact recognized keys; if the release file differs from fixtures, report a blocker instead of broad search/replace. Require explicit confirmation of private distribution rights before client-copy preparation.

- [x] **Step 5: Add redacted reports and reversible config-write tests**

  Assert the report does not contain sample password/token values, a confirmed change creates timestamped backups with matching original SHA-256, and `-WhatIf` leaves the original byte-identical.

- [x] **Step 6: Run the harness and verify all Task 4 cases pass**

  Run: `powershell.exe -NoProfile -File .\mu99-vps\tests\Run-Tests.ps1`
  Expected: PASS; unknown formats remain untouched and are listed as blockers.

## Task 5: SQL connection, backup validation, and safe database restore

**Files:**
- Modify: `mu99-vps/Install-MU99-Safe.ps1`
- Modify: `mu99-vps/tests/Run-Tests.ps1`

**Interfaces:**
- `Test-Mu99SqlInstance([string] $SqlInstance) -> [pscustomobject]`: connects only to the explicitly selected local instance by default and reports server version/edition.
- `Get-Mu99BackupMetadata([string] $BackupPath, [string] $SqlInstance) -> [pscustomobject]`: runs `RESTORE HEADERONLY`, `RESTORE FILELISTONLY`, and `RESTORE VERIFYONLY` only against the exact `DB\MuOnline.bak` path.
- `Invoke-Mu99DatabaseRestore([string] $BackupPath, [string] $SqlInstance, [string] $DatabaseName, [string] $BackupRoot, [switch] $ConfirmDatabaseOverwrite) -> [pscustomobject]`: backs up an existing target first, checks usage/free space, and restores only after `ShouldProcess`.
- `Get-Mu99SqlCredential() -> [pscredential]`: prompts securely only when Windows Authentication is unavailable/declined; never accepts a password argument.

- [x] **Step 1: Add failing command-construction and safety tests**

  Using fake SQL executor functions, assert the generated sequence targets only `DB\MuOnline.bak`, issues `VERIFYONLY` before restore, never executes restore on invalid metadata, safely quotes the database identifier/path, and refuses an existing/in-use database unless the explicit overwrite switch and confirmation are present.

- [x] **Step 2: Run the harness and verify the database cases fail**

  Run: `powershell.exe -NoProfile -File .\mu99-vps\tests\Run-Tests.ps1`
  Expected: FAIL on unimplemented SQL functions; fake executor confirms no external database connection.

- [x] **Step 3: Implement local SQL validation and backup metadata checks**

  Use .NET `System.Data.SqlClient`; default to Windows Authentication. If SQL authentication is necessary, prompt via `Read-Host -AsSecureString`, keep plaintext transient in memory only, and redact exceptions/output. Do not install SQL or change SQL configuration.

- [x] **Step 4: Implement guarded backup and restore**

  Before overwriting, check whether the database is in use and abort rather than killing sessions. Write a unique pre-restore backup, verify the backup file, require explicit `-ConfirmDatabaseOverwrite`, and use `ShouldProcess` for the restore. Require extra explicit `-AllowPlaintextLegacyDbCredentials` plus restrictive ACL if the server config requires a plaintext database password.

- [x] **Step 5: Add failure and secret-redaction regression cases**

  Assert invalid `.bak`, missing target database name, unsupported remote SQL address, insufficient disk space, active sessions, invalid credentials, and SQL exceptions all stop without restore and do not leak the fake password in console/report output.

- [x] **Step 6: Run the harness and verify all Task 5 cases pass**

  Run: `powershell.exe -NoProfile -File .\mu99-vps\tests\Run-Tests.ps1`
  Expected: PASS with only fake SQL executor calls; no SQL service or production database is required for this harness.

## Task 6: Explicit component startup and firewall plan/apply/rollback

**Files:**
- Modify: `mu99-vps/Install-MU99-Safe.ps1`
- Modify: `mu99-vps/tests/Run-Tests.ps1`

**Interfaces:**
- `Start-Mu99Components([string] $ComponentManifestPath, [switch] $AcceptUnsignedBinaries) -> [pscustomobject[]]`: starts only the confirmed executable paths, working directories, and order listed in a manifest under the selected server root. The manifest schema is `{ "components": [{ "name": "ConnectServer", "path": "ConnectServer\\ConnectServer.exe", "workingDirectory": "ConnectServer", "order": 1 }] }`; each path/order is reviewed by the operator before start.
- `Get-Mu99FirewallPlan([int[]] $ApprovedGamePorts, [string[]] $ApprovedProtocols) -> [pscustomobject[]]`: returns inbound rules without applying them.
- `Add-Mu99FirewallRules([pscustomobject[]] $Plan, [string] $DestinationRoot) -> [string[]]`: creates exact script-owned Windows Firewall rules after elevated privilege check and `ShouldProcess`, then writes an ownership manifest.
- `Remove-Mu99FirewallRules([string] $DestinationRoot) -> [string[]]`: removes only rule names and identifiers in the script's ownership manifest.

- [x] **Step 1: Add failing tests for startup manifests and firewall policy**

  Assert startup rejects paths outside the server root, missing executables, unconfirmed order, and unsigned executables without the explicit switch. Assert firewall planning rejects ports 1433/1434/3389 and detected SQL/RDP service ports, refuses an empty port list, and emits only explicitly approved TCP/UDP ports.

- [x] **Step 2: Run the harness and verify startup/firewall cases fail**

  Run: `powershell.exe -NoProfile -File .\mu99-vps\tests\Run-Tests.ps1`
  Expected: FAIL on unimplemented functions; tests use mocked process/firewall adapters and do not launch a game binary or alter Windows Firewall.

- [x] **Step 3: Implement guarded startup from an explicit component manifest**

  Generate a component-manifest template with discovered executable paths but an unset order; require the operator to review/fill `order` and `workingDirectory` from release documentation before start. Require confirmation for every component start. Do not infer order from names alone, run `StartUp.exe`, create a service/scheduled task, or configure auto-start. Emit PID and log paths without capturing credentials.

- [x] **Step 4: Implement firewall plan, apply, and ownership-only rollback**

  Use `New-NetFirewallRule`/`Remove-NetFirewallRule` through mockable adapter functions. Rule names use a deterministic `MU99-Pilot-` prefix and exact protocol/port. Never open SQL/RDP or any unapproved port; never edit provider firewall or existing rules. Require administrator context only for apply/revert.

- [x] **Step 5: Add `-WhatIf`, custom admin-port, and foreign-rule preservation tests**

  Assert `-WhatIf` invokes no firewall adapter, a custom port detected as administrative is rejected, rollback removes only exact owned rule IDs, and unrelated rules stay untouched.

- [x] **Step 6: Run the harness and verify all Task 6 cases pass**

  Run: `powershell.exe -NoProfile -File .\mu99-vps\tests\Run-Tests.ps1`
  Expected: PASS; test process has created no listener, process, task, service, or firewall rule.

## Task 7: Operator guide and end-to-end readiness handoff

**Files:**
- Create: `mu99-vps/GUIA-EXECUCAO-MU-V99.md`
- Modify: `mu99-vps/Install-MU99-Safe.ps1` (comment-based help only if gaps remain)

**Interfaces:**
- The guide documents the exact script modes/parameters, required decisions, output folders, rollback commands, SQL compatibility limitation, network/provider responsibilities, and manual pilot acceptance steps.
- The guide must state that the SQL Server 2008 R2 requirement mentioned by the community source is unsupported on Windows Server 2019 per Microsoft's matrix; SQL Server 2012 SP4 is listed as compatible by OS matrix but is out of support. Any chosen version still requires testing with the package's legacy binaries.
- It must provide example commands using placeholder paths/IPs only, no real secrets, and no `ExecutionPolicy Bypass` command.

- [x] **Step 1: Add a guide checklist covering every approved acceptance criterion**

  Map each of the ten acceptance criteria in the spec to an exact diagnostic report, script mode, or manual player/operator check. Mark external client testing and provider firewall setup as manual.

- [x] **Step 2: Write phase-by-phase commands and rollback instructions**

  Document Diagnose → review → Stage → dependency decision → config proposal → database backup/restore → local start → firewall plan/review/apply → external client test → backup/restore drill. Include stop conditions and cleanup only for script-owned artifacts.

- [x] **Step 3: Run the full local regression harness and inspect help output**

  Run: `powershell.exe -NoProfile -File .\mu99-vps\tests\Run-Tests.ps1`
  Expected: PASS with no admin rights and no access to the real VPS.
  Run: `powershell.exe -NoProfile -Command "Get-Help .\mu99-vps\Install-MU99-Safe.ps1 -Full"`
  Expected: documented modes, required options, examples, side effects, and rollback behavior.

- [x] **Step 4: Perform static self-review against the approved spec**

  Confirm every spec section and acceptance criterion maps to code, a regression case, or a manual guide check; search for `TODO`, `TBD`, hard-coded passwords/IPs, broad `*.bak` restore loops, Defender exclusions, `ExecutionPolicy Bypass`, unowned firewall deletion, and automatic SQL/runtime installers. Resolve all findings before handoff.

## Execution Handoff

Implement sequentially because the script's shared validation, report, staging, database, and firewall interfaces build on each other. After the plan is approved, execute Tasks 1–7 in order, using mocked adapters for local tests and reserving all production VPS changes for the owner's explicit execution/confirmation. Actual playability is established only by the manual VPS/player acceptance checklist, not by local harness results.

## Nota de revisao — 2026-10-10 (bloqueios pos-implementacao resolvidos)

Revisao estatica do pacote real e do codigo encontrou 5 bloqueios; todos
resolvidos nesta data, com regressoes no harness (contagem final registrada
no relatorio de conclusao da sessao):

1. **Staging/cliente (Task 3):** `Invoke-Mu99StagePackage` extraia so o ZIP
   externo e `PrepararCliente` procurava `client\Config.ini` que nenhum fluxo
   criava. Implementado `Expand-Mu99NestedArchive`: lista e valida TODOS os
   membros antes de gravar qualquer um (traversal, links via
   `Test-Mu99ListingLinkHint`, nomes de dispositivo, formatos nao
   suportados), segrega servidor/bibliotecas em `server/` e `libraries/`,
   pula o cliente em `PrepararArquivos` (só `PrepararCliente`, com
   confirmacao de direitos, o expande) e nunca executa conteudo. Raiz/parent
   com reparse sao recusados antes do extrator; a varredura pos-extracao
   cobre a propria raiz; a limpeza so remove o que o script criou e nunca
   segue redirecao (`LIMPEZA PENDENTE` caso contrario). RAR desconhecido
   bloqueia.
2. **Inventario honesto (Task 2):** `Get-Mu99PackageInventory` marcava
   `listed` sem listar. Agora materializa temporariamente so o blob `.rar`
   (caminho validado), lista de verdade, remove o temporario e reporta por
   RAR `listed` / `list-failed` (com erro) / `pending-no-tool`. `.bak`, exes
   e configs detectados via membros entram no inventario; sem listagem nao
   ha afirmacao.
3. **Portas administrativas (Task 6):** `Get-Mu99ObservedAdminPorts` agora
   expoe `listenersVerified`/`servicesVerified`, `adminListenerPorts`
   (listeners em portas admin ou de processos de sistema/administracao) e
   `collisionPorts`. `PlanoFirewall`/`AplicarFirewall` bloqueiam quando
   listeners nao sao verificaveis e recusam qualquer colisao antes de criar
   regra; o relatorio inclui a tabela de observacoes.
4. **Credencial legada (Task 5, desvio documentado):** o switch
   `-AllowPlaintextLegacyDbCredentials` foi REMOVIDO do script (estava
   declarado sem uso; o guia prometia ACL que nao existia). Inspecao
   estatica provou que nenhuma config reconhecida deste pacote carrega
   senha de banco (so DSN ODBC `MuOnline`); escrever segredos por conta
   propria violaria o principio fail-closed. Credencial legada em texto
   claro e **etapa manual bloqueada** fora do script (guia Fase 4). Isso
   substitui a ultima frase do Step 4 da Task 5 e a mencao na linha 52.
5. **Correcoes adicionais:** `(… | Where-Object …).Count` sob StrictMode
   (Task 2, inventario) protegido com `@(...)`; `Test-Mu99FileSafeForWrite`
   impede escrita de config atraves de symlink/junction/hardlink
   (verificado via atributos + `fsutil`, falha fechada quando nao
   verificavel); `Test-Mu99ListingLinkHint` identifica `Symbolic Link`,
   `Hard Link`, `Type=Link`, `->`, `symlink`, `junction` e modos `lrwx`, e
   formas de atributos UnRAR fora do padrao bloqueiam. Limite documentado:
   a listagem resumida do UnRAR nao distingue hardlinks (verificado
   empiricamente em 2026-10-10); a garantia restante e a cadeia
   validacao → varredura com atributos reais → verificacao pre-escrita.
6. **Dono de listener desconhecido (2026-10-10, segunda revisao):**
   `Get-Mu99ObservedAdminPorts` agora expoe `unknownOwnerPorts` e
   `listenersIdentityVerified`; `collisionPorts` inclui portas sem dono
   identificavel. `PlanoFirewall`/`AplicarFirewall` recusam porta aprovada
   ocupada por processo desconhecido e travam explicitamente quando
   `servicesVerified` ou `listenersVerified` sao falsos (antes so listeners
   travava). Regressoes Task6C usam seam de teste via env só-para-testes.
