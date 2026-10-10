<#
.SYNOPSIS
  Orquestrador seguro em etapas para o piloto MU Online v99b (Windows PowerShell 5.1).

.DESCRIPTION
  Script executado manualmente na VPS pelo proprietario. O modo padrao
  Diagnostico e somente leitura e pode apenas criar um novo relatorio
  mascarado. Modos mutaveis exigem alvo explicito, backup previo quando
  aplicavel, confirmacao interativa e respeitam -WhatIf/-Confirm.
  Nao instala SQL, runtimes, extratores ou atualizacoes. Nao executa
  binarios/instaladores do pacote automaticamente. Nao altera Defender,
  nao abre firewall sem aprovacao explicita e nunca restaura *.bak
  arbitrarios: apenas DB\MuOnline.bak.

.PARAMETER Mode
  Diagnostico (padrao, somente leitura), PrepararArquivos,
  ValidarDependencias, Configurar, Banco, PrepararCliente, Iniciar,
  PlanoFirewall, AplicarFirewall, ReverterFirewall.

.PARAMETER PackageZipPath
  Caminho do ZIP original do pacote. Nunca e sobrescrito.

.PARAMETER DestinationRoot
  Raiz de saida escolhida pelo operador (contera reports/, backups/,
  staging/ e state/). Relatorios sao sempre arquivos novos com timestamp.

.PARAMETER ArchiveToolPath
  Caminho de 7-Zip ou WinRAR ja instalado (para listar e expandir os RARs
  aninhados apos validacao total). O script nunca baixa ferramentas.

.PARAMETER ServerAddress
  Endereco IPv4/hostname publico do servidor a aplicar nas configuracoes
  reconhecidas.

.PARAMETER SqlInstance
  Instancia SQL local explicita (ex.: .\SQLEXPRESS). Nao aceita endereco
  remoto por padrao.

.PARAMETER DatabaseName
  Nome do banco alvo (padrao MuOnline).

.PARAMETER ComponentManifestPath
  Manifesto JSON de componentes para o modo Iniciar.

.PARAMETER ApprovedGamePorts
  Portas de jogo explicitamente aprovadas pelo operador.

.PARAMETER ApprovedProtocols
  Protocolos aprovados (TCP/UDP).

.PARAMETER ConfirmDatabaseOverwrite
  Switch explicito exigido para sobrescrever banco existente.

.PARAMETER ConfirmPrivateClientDistributionRights
  Confirmacao de direitos de uso antes de preparar copia do cliente.

.PARAMETER AcceptUnsignedBinaries
  Opt-in explicito para iniciar binarios sem assinatura Authenticode valida.

.PARAMETER ExportFunctionsOnly
  Uso interno do harness de testes: carrega funcoes sem despachar modo.

.EXAMPLE
  .\Install-MU99-Safe.ps1 -Mode Diagnostico -DestinationRoot C:\MU99\out

.EXAMPLE
  .\Install-MU99-Safe.ps1 -Mode PrepararArquivos -PackageZipPath C:\pacote.zip -DestinationRoot C:\MU99\stage-2026-10-10-1200 -WhatIf

.NOTES
  Requisitos: Windows PowerShell 5.1. Sem dependencias externas.
  Rollback: cada modo mutavel gera backup/manifesto sob DestinationRoot;
  ReverterFirewall remove apenas regras com prefixo MU99-Pilot- listadas
  no manifesto. Consulte mu99-vps/GUIA-EXECUCAO-MU-V99.md.
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
  [ValidateSet('Diagnostico','PrepararArquivos','ValidarDependencias','Configurar','Banco','PrepararCliente','Iniciar','PlanoFirewall','AplicarFirewall','ReverterFirewall')]
  [string]$Mode = 'Diagnostico',

  [string]$PackageZipPath = '',
  [string]$DestinationRoot = '',
  [string]$ArchiveToolPath = '',
  [string]$ServerAddress = '',
  [string]$SqlInstance = '',
  [string]$DatabaseName = 'MuOnline',
  [string]$ComponentManifestPath = '',
  [int[]]$ApprovedGamePorts = @(),
  [string[]]$ApprovedProtocols = @(),
  [switch]$ConfirmDatabaseOverwrite,
  [switch]$ConfirmPrivateClientDistributionRights,
  [switch]$AcceptUnsignedBinaries,
  [switch]$ExportFunctionsOnly
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# =============================================================
# Nucleo de seguranca (Task 1)
# =============================================================

function ConvertTo-Mu99RedactedText {
  <#
  .SYNOPSIS
    Mascara valores de segredos em texto livre.
  #>
  [CmdletBinding()]
  param([string]$Text)
  if ($null -eq $Text -or $Text -eq '') { return $Text }
  $out = $Text
  $out = [System.Text.RegularExpressions.Regex]::Replace(
    $out,
    '(?i)("[A-Za-z0-9_.\-]*(pass(word|wd)?|pwd|secret|token|credential|api[-_]?key)[A-Za-z0-9_.\-]*"\s*[:=]\s*["'']?)([^\s"'',;&\r\n\]]+)(["'']?)',
    '$1***$5'
  )
  $out = [System.Text.RegularExpressions.Regex]::Replace(
    $out,
    '(?i)([A-Za-z0-9_.\-]*(pass(word|wd)?|pwd|secret|token|credential|api[-_]?key)[A-Za-z0-9_.\-]*?)(\s*[:=]\s*)(["'']?)([^\s"'',;&\r\n]+)(["'']?)',
    '$1$4$5***$7'
  )
  $out = [System.Text.RegularExpressions.Regex]::Replace(
    $out,
    "(?i)(\b(password|pwd)\b)(\s*=\s*)([^\s;'`"]+)",
    '$1$3***'
  )
  return $out
}

function Test-Mu99PathWithinRoot {
  <#
  .SYNOPSIS
    Verifica se Candidate esta dentro de Root (canonico, sem traversal).
  #>
  [CmdletBinding()]
  param([string]$Root, [string]$Candidate)
  if ([string]::IsNullOrWhiteSpace($Root) -or [string]::IsNullOrWhiteSpace($Candidate)) { return $false }
  try {
    $rootFull = [System.IO.Path]::GetFullPath($Root)
    $sep = [System.IO.Path]::DirectorySeparatorChar.ToString()
    $alt = '/'
    if ($sep -eq '/') { $alt = '\' }
    $rootFull = $rootFull.TrimEnd($sep.ToCharArray()).TrimEnd($alt.ToCharArray())
    $rootWithSep = $rootFull + $sep
    if ([System.IO.Path]::IsPathRooted($Candidate)) {
      $candFull = [System.IO.Path]::GetFullPath($Candidate)
    } else {
      $candFull = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($rootFull, $Candidate))
    }
    if ($candFull.TrimEnd($sep.ToCharArray()).TrimEnd($alt.ToCharArray()) -ieq $rootFull) { return $true }
    return $candFull.StartsWith($rootWithSep, [System.StringComparison]::OrdinalIgnoreCase)
  } catch { return $false }
}

function Write-Mu99Report {
  <#
  .SYNOPSIS
    Grava relatorio JSON UTF-8 redigido em um caminho novo (nunca sobrescreve).
  #>
  [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][object]$Report
  )
  if (Test-Path -LiteralPath $Path) {
    throw ("Write-Mu99Report: caminho ja existe; recusa de sobrescrita: " + $Path)
  }
  $dir = [System.IO.Path]::GetDirectoryName($Path)
  if ($dir -and (-not (Test-Path -LiteralPath $dir))) {
    if ($PSCmdlet.ShouldProcess($dir, 'Criar diretorio de relatorio')) {
      New-Item -ItemType Directory -Path $dir | Out-Null
    } else { return }
  }
  $json = $Report | ConvertTo-Json -Depth 10
  $redacted = ConvertTo-Mu99RedactedText -Text $json
  if ($PSCmdlet.ShouldProcess($Path, 'Gravar relatorio redigido')) {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $redacted, $utf8)
  }
}

function Assert-Mu99ModeRequirements {
  [CmdletBinding()]
  param([string]$ModeName)
  switch ($ModeName) {
    'Diagnostico' {
      if ([string]::IsNullOrWhiteSpace($DestinationRoot)) { throw 'Modo Diagnostico exige -DestinationRoot (pasta de saida para o relatorio).' }
    }
    'PrepararArquivos' {
      if ([string]::IsNullOrWhiteSpace($PackageZipPath)) { throw 'Modo PrepararArquivos exige -PackageZipPath.' }
      if ([string]::IsNullOrWhiteSpace($DestinationRoot)) { throw 'Modo PrepararArquivos exige -DestinationRoot (novo diretorio de staging, sem sobrescrita).' }
    }
    'ValidarDependencias' {
      if ([string]::IsNullOrWhiteSpace($DestinationRoot)) { throw 'Modo ValidarDependencias exige -DestinationRoot (raiz do servidor em staging).' }
    }
    'Configurar' {
      if ([string]::IsNullOrWhiteSpace($DestinationRoot)) { throw 'Modo Configurar exige -DestinationRoot.' }
      if ([string]::IsNullOrWhiteSpace($ServerAddress)) { throw 'Modo Configurar exige -ServerAddress.' }
    }
    'Banco' {
      if ([string]::IsNullOrWhiteSpace($SqlInstance)) { throw 'Modo Banco exige -SqlInstance explicita.' }
      if ([string]::IsNullOrWhiteSpace($DatabaseName)) { throw 'Modo Banco exige -DatabaseName.' }
      if ([string]::IsNullOrWhiteSpace($DestinationRoot)) { throw 'Modo Banco exige -DestinationRoot.' }
    }
    'PrepararCliente' {
      if ([string]::IsNullOrWhiteSpace($DestinationRoot)) { throw 'Modo PrepararCliente exige -DestinationRoot.' }
      if ([string]::IsNullOrWhiteSpace($ServerAddress)) { throw 'Modo PrepararCliente exige -ServerAddress.' }
      if (-not $ConfirmPrivateClientDistributionRights) { throw 'Modo PrepararCliente exige -ConfirmPrivateClientDistributionRights (direitos de uso do cliente).' }
    }
    'Iniciar' {
      if ([string]::IsNullOrWhiteSpace($ComponentManifestPath)) { throw 'Modo Iniciar exige -ComponentManifestPath.' }
      if ([string]::IsNullOrWhiteSpace($DestinationRoot)) { throw 'Modo Iniciar exige -DestinationRoot.' }
    }
    'PlanoFirewall' {
      if ($null -eq $ApprovedGamePorts -or $ApprovedGamePorts.Count -eq 0) { throw 'Modo PlanoFirewall exige -ApprovedGamePorts nao vazio.' }
    }
    'AplicarFirewall' {
      if ($null -eq $ApprovedGamePorts -or $ApprovedGamePorts.Count -eq 0) { throw 'Modo AplicarFirewall exige -ApprovedGamePorts nao vazio.' }
      if ([string]::IsNullOrWhiteSpace($DestinationRoot)) { throw 'Modo AplicarFirewall exige -DestinationRoot (para o manifesto de reversao).' }
    }
    'ReverterFirewall' {
      if ([string]::IsNullOrWhiteSpace($DestinationRoot)) { throw 'Modo ReverterFirewall exige -DestinationRoot (onde esta o manifesto).' }
    }
    default { throw ("Modo desconhecido: " + $ModeName) }
  }
}

# =============================================================
# Diagnostico somente leitura (Task 2)
# =============================================================

function Get-Mu99EnvironmentSnapshot {
  [CmdletBinding()]
  param()
  $os = [System.Environment]::OSVersion.VersionString
  try { $osCaption = (Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop).Caption } catch { $osCaption = $os }
  $psv = '5.1'; $edition = 'Desktop'
  try {
    $t = (Get-Variable PSVersionTable -ValueOnly -ErrorAction Stop)
    if ($t.PSVersion) { $psv = $t.PSVersion.ToString() }
    if ($t.PSEdition) { $edition = $t.PSEdition.ToString() }
  } catch {}
  $ramGB = 0
  try {
    $cs = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop
    $ramGB = [math]::Round([double]$cs.TotalPhysicalMemory / 1GB, 2)
  } catch {}
  $volumes = @()
  try {
    foreach ($d in [System.IO.DriveInfo]::GetDrives()) {
      if (-not $d.IsReady) { continue }
      $volumes += [pscustomobject]@{
        name = $d.Name
        freeGB = [math]::Round([double]$d.AvailableFreeSpace / 1GB, 2)
        totalGB = [math]::Round([double]$d.TotalSize / 1GB, 2)
        format = $d.DriveFormat
      }
    }
  } catch {}
  $sqlCandidates = @()
  try {
    $svcs = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'MSSQL*' -or $_.DisplayName -like '*SQL Server*' }
    foreach ($s in $svcs) {
      $sqlCandidates += [pscustomobject]@{ name = $s.Name; displayName = $s.DisplayName; status = $s.Status.ToString() }
    }
  } catch {}
  try {
    $regRoots = @('HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Microsoft SQL Server\Instance Names\SQL')
    foreach ($rk in $regRoots) {
      if (Test-Path -LiteralPath $rk) {
        foreach ($p in (Get-ItemProperty -LiteralPath $rk -ErrorAction SilentlyContinue).PSObject.Properties) {
          if ($p.Name -match '^(PS|PSParent|PSChild|PSDrive|PSProvider|PSPath)$') { continue }
          $sqlCandidates += [pscustomobject]@{ name = $p.Name; displayName = ('SQL Instance ' + $p.Name); status = 'registry' }
        }
      }
    }
  } catch {}
  $archiveTools = @()
  foreach ($cand in @('C:\Program Files\7-Zip\7z.exe','C:\Program Files (x86)\7-Zip\7z.exe','C:\Program Files\WinRAR\WinRAR.exe','C:\Program Files\WinRAR\Rar.exe','C:\Program Files\WinRAR\UnRAR.exe')) {
    if (Test-Path -LiteralPath $cand) { $archiveTools += $cand }
  }
  try {
    foreach ($n in @('7z.exe','7za.exe','WinRAR.exe','Rar.exe','UnRAR.exe')) {
      $c = Get-Command $n -ErrorAction SilentlyContinue
      if ($c -and $c.Source -and (-not ($archiveTools -contains $c.Source))) { $archiveTools += $c.Source }
    }
  } catch {}
  return [pscustomobject]@{
    os = $osCaption
    osVersion = $os
    powershellVersion = $psv
    powershellEdition = $edition
    ramTotalGB = $ramGB
    volumes = $volumes
    sqlCandidates = $sqlCandidates
    archiveTools = $archiveTools
  }
}

function Get-Mu99FileSha256 {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$Path)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $fs = [System.IO.File]::OpenRead($Path)
    try { $hash = $sha.ComputeHash($fs) } finally { $fs.Dispose() }
    return (($hash | ForEach-Object { $_.ToString('x2') }) -join '')
  } finally { $sha.Dispose() }
}

function Get-Mu99PackageInventory {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string]$PackageZipPath,
    [string]$ArchiveToolPath = '',
    [scriptblock]$ListAdapter = $null
  )
  if (-not (Test-Path -LiteralPath $PackageZipPath)) { throw ("Pacote nao encontrado: " + $PackageZipPath) }
  Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
  $fileInfo = Get-Item -LiteralPath $PackageZipPath
  $sha = Get-Mu99FileSha256 -Path $PackageZipPath
  $entries = @()
  $fs = [System.IO.File]::OpenRead($PackageZipPath)
  try {
    $ar = New-Object System.IO.Compression.ZipArchive($fs, ([System.IO.Compression.ZipArchiveMode]::Read))
    try {
      foreach ($e in $ar.Entries) {
        $entries += [pscustomobject]@{
          name = $e.FullName
          length = [long]$e.Length
          compressedLength = [long]$e.CompressedLength
        }
      }
    } finally { $ar.Dispose() }
  } catch {
    throw ("ZIP invalido ou ilegiven: " + $_.Exception.Message)
  } finally { $fs.Dispose() }
  $names = @($entries | ForEach-Object { $_.name })
  $hasFiles = (@($names -like '*.rar' | Where-Object { $_ -like '*Files*99b*' }).Count -gt 0)
  if (-not $hasFiles) { $hasFiles = ($names -join "`n") -match 'Files.*99b.*\.rar' }
  $hasClient = ($names -join "`n") -match 'Client.*99b.*\.rar'
  $hasLibs = ($names -join "`n") -match 'Librerias\.rar'
  $hasBak = ($names -join "`n") -match 'MuOnline\.bak'
  $muExes = @('ConnectServer.exe','DataServer.exe','JoinServer.exe','GameServer.exe')
  $detectedExes = @()
  foreach ($x in $muExes) { if (($names -join "`n") -match [regex]::Escape($x)) { $detectedExes += $x } }
  $detectedConfigs = @()
  foreach ($c in @('ServerList.dat','MapServerInfo.dat','Config.ini','ConnectServer.ini','DataServer.ini','JoinServer.ini')) {
    if (($names -join "`n") -match [regex]::Escape($c)) { $detectedConfigs += $c }
  }
  $nestedStatus = 'pending-no-tool'
  $nested = @()
  $tool = $ArchiveToolPath
  if ([string]::IsNullOrWhiteSpace($tool)) {
    $snap = Get-Mu99EnvironmentSnapshot
    foreach ($t in $snap.archiveTools) {
      if ($t -match '(7z\.exe|WinRAR\.exe|Rar\.exe|UnRAR\.exe)$') { $tool = $t; break }
    }
  }
  $toolOk = ((-not [string]::IsNullOrWhiteSpace($tool)) -and (Test-Path -LiteralPath $tool))
  $rarEntries = @($entries | Where-Object { $_.name -like '*.rar' })
  if ($rarEntries.Count -eq 0) { $nestedStatus = 'no-nested-rar' }
  elseif ((-not $toolOk) -and (-not $ListAdapter)) {
    $nestedStatus = 'pending-no-tool'
    foreach ($r in $rarEntries) {
      $nested += [pscustomobject]@{ rar = $r.name; status = 'pending-no-tool'; memberCount = 0; members = @(); error = 'Sem extrator instalado; conteudo interno nao listado. Nenhum membro foi extraido.' }
    }
  } else {
    # Listagem real sem extrair membros: materializa APENAS o blob .rar em
    # diretorio temporario (caminho validado), lista, e remove o temporario.
    $anyListed = $false
    $scratchBase = [System.IO.Path]::GetTempPath()
    foreach ($r in $rarEntries) {
      try {
        if ($ListAdapter) {
          $listed = @(Get-Mu99NestedRarInventory -RarPath $r.name -ListAdapter $ListAdapter)
        } else {
          $scratch = Join-Path $scratchBase ('mu99-inv-' + [System.Guid]::NewGuid().ToString('N'))
          New-Item -ItemType Directory -Path $scratch | Out-Null
          try {
            if (-not (Test-Mu99ArchiveEntryPath -Root $scratch -EntryName $r.name)) {
              throw ("Entrada .rar com caminho nao validavel; listagem recusada: " + $r.name)
            }
            $tmpRar = Join-Path $scratch 'nested.rar'
            $fsM = [System.IO.File]::OpenRead($PackageZipPath)
            try {
              $arM = New-Object System.IO.Compression.ZipArchive($fsM, ([System.IO.Compression.ZipArchiveMode]::Read))
              try {
                $found = $null
                foreach ($e in $arM.Entries) { if ($e.FullName -ceq $r.name) { $found = $e; break } }
                if ($null -eq $found) { throw ("Entrada .rar nao relocalizada no ZIP: " + $r.name) }
                $srcM = $found.Open()
                try {
                  $dstM = [System.IO.File]::Create($tmpRar)
                  try { $srcM.CopyTo($dstM) } finally { $dstM.Dispose() }
                } finally { $srcM.Dispose() }
              } finally { $arM.Dispose() }
            } finally { $fsM.Dispose() }
            $listed = @(Get-Mu99NestedRarInventory -RarPath $tmpRar -ArchiveToolPath $tool)
          } finally {
            if (Test-Path -LiteralPath $scratch) { Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction SilentlyContinue }
          }
        }
        $anyListed = $true
        $memberNames = @($listed | ForEach-Object { [string]$_.name })
        $nested += [pscustomobject]@{ rar = $r.name; status = 'listed'; memberCount = @($listed).Count; members = $memberNames; error = '' }
      } catch {
        $msg = ConvertTo-Mu99RedactedText -Text $_.Exception.Message
        $nested += [pscustomobject]@{ rar = $r.name; status = 'list-failed'; memberCount = 0; members = @(); error = $msg }
      }
    }
    if ($anyListed) { $nestedStatus = 'listed' } else { $nestedStatus = 'list-failed' }
  }
  $nestedMemberText = ($nested | ForEach-Object { @($_.members) }) -join "`n"
  if (($nestedMemberText -match 'MuOnline\.bak') -and (-not $hasBak)) { $hasBak = $true }
  foreach ($x in $muExes) {
    if (($detectedExes -notcontains $x) -and ($nestedMemberText -match [regex]::Escape($x))) { $detectedExes += $x }
  }
  $allConfigNames = @('ServerList.dat','MapServerInfo.dat','Config.ini','ConnectServer.ini','DataServer.ini','JoinServer.ini')
  foreach ($c in $allConfigNames) {
    if (($detectedConfigs -notcontains $c) -and ($nestedMemberText -match [regex]::Escape($c))) { $detectedConfigs += $c }
  }
  return [pscustomobject]@{
    packagePath = $PackageZipPath
    packageBytes = [long]$fileInfo.Length
    sha256 = $sha
    entryCount = $entries.Count
    entries = $entries
    hasServerRar = [bool]$hasFiles
    hasClientRar = [bool]$hasClient
    hasLibrariesRar = [bool]$hasLibs
    hasMuOnlineBak = [bool]$hasBak
    detectedExecutables = $detectedExes
    detectedConfigs = $detectedConfigs
    executableSignature = 'pending-until-staging'
    nestedRarStatus = $nestedStatus
    nestedRars = $nested
  }
}

function Invoke-Mu99Diagnostic {
  [CmdletBinding()]
  param(
    [string]$PackageZipPath = '',
    [Parameter(Mandatory = $true)][string]$DestinationRoot,
    [string]$ArchiveToolPath = '',
    [scriptblock]$ListAdapter = $null
  )
  $reportsDir = Join-Path $DestinationRoot 'reports'
  if (-not (Test-Path -LiteralPath $reportsDir)) { New-Item -ItemType Directory -Path $reportsDir | Out-Null }
  $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
  $reportPath = Join-Path $reportsDir ("diagnostico-" + $stamp + ".json")
  $n = 0
  while (Test-Path -LiteralPath $reportPath) { $n++; $reportPath = Join-Path $reportsDir ("diagnostico-" + $stamp + "-" + $n + ".json") }
  $snapshot = Get-Mu99EnvironmentSnapshot
  $inv = $null; $invError = ''
  if ([string]::IsNullOrWhiteSpace($PackageZipPath)) { $invError = 'PackageZipPath nao informado; inventario do pacote pendente.' }
  else {
    try { $inv = Get-Mu99PackageInventory -PackageZipPath $PackageZipPath -ArchiveToolPath $ArchiveToolPath -ListAdapter $ListAdapter }
    catch { $invError = ConvertTo-Mu99RedactedText -Text $_.Exception.Message }
  }
  $blockers = @()
  if ($invError) { $blockers += $invError }
  if ($inv -and (-not $inv.hasMuOnlineBak)) {
    $pendingNested = @($inv.nestedRars | Where-Object { $_.status -ne 'listed' })
    if (@($pendingNested).Count -gt 0) { $blockers += 'DB\MuOnline.bak nao confirmado (listagem de RAR pendente ou falhou); Banco bloqueado ate a confirmacao no staging.' }
    else { $blockers += 'DB\MuOnline.bak nao identificado no pacote; Banco bloqueado.' }
  }
  if ($inv) {
    foreach ($nr in @($inv.nestedRars)) {
      if ($nr.status -eq 'pending-no-tool') { $blockers += ("Sem extrator instalado para listar " + $nr.rar + "; conteudo interno pendente. Nenhum membro foi extraido.") }
      elseif ($nr.status -eq 'list-failed') { $blockers += ("Falha ao listar " + $nr.rar + ": " + $nr.error) }
    }
  }
  $blockers += 'Espaco livre/RAM/IP/SQL/firewall do provedor precisam ser medidos na VPS; este relatorio local nao substitui o diagnostico na VPS.'
  $blockers += 'Versao de SQL/driver exigida pelos binarios ainda nao confirmada; nenhuma instalacao automatica sera feita.'
  $report = [pscustomobject]@{
    schema = 'mu99-diagnostico/1'
    mode = 'Diagnostico'
    startedAt = (Get-Date).ToString('o')
    environment = $snapshot
    package = $inv
    packageError = $invError
    configuredPortsObserved = @(
      [pscustomobject]@{ port = 44405; role = 'ConnectServer TCP (observado em ConnectServer.ini/Config.ini)'; protocol = 'TCP' },
      [pscustomobject]@{ port = 55557; role = 'ConnectServer UDP (observado em ConnectServer.ini/JoinServer.ini)'; protocol = 'UDP' },
      [pscustomobject]@{ port = 55558; role = 'ConnectServer TCP Join (observado em JoinServer.ini)'; protocol = 'TCP' },
      [pscustomobject]@{ port = 55901; role = 'GameServer (observado em ServerList.dat/MapServerInfo.dat/GameServerInfo)'; protocol = 'TCP' },
      [pscustomobject]@{ port = 55960; role = 'DataServer (observado em DataServer.ini/GameServerInfo)'; protocol = 'TCP' },
      [pscustomobject]@{ port = 55970; role = 'JoinServer (observado em JoinServer.ini/DataServer)'; protocol = 'TCP' }
    )
    openQuestions = @(
      'Quanto espaco livre e RAM disponivel existe hoje na VPS?',
      'Ja existe instancia SQL instalada? Qual versao/edicao, modo de autenticacao e memoria configurada?',
      'Qual versao de SQL/driver os binarios realmente requerem?',
      'Qual e o IP publico estavel e que firewall externo o provedor oferece (VPN ou portas publicas)?',
      'Os arquivos podem ser hospedados e o cliente compartilhado privadamente?',
      'As bibliotecas ja estao presentes e os binarios sao detectados pelo Defender?'
    )
    blockers = $blockers
  }
  Write-Mu99Report -Path $reportPath -Report $report
  return $reportPath
}

# =============================================================
# Staging seguro de arquivos (Task 3)
# =============================================================

function Test-Mu99ArchiveEntryPath {
  [CmdletBinding()]
  param([string]$Root, [string]$EntryName)
  if ([string]::IsNullOrWhiteSpace($Root) -or [string]::IsNullOrWhiteSpace($EntryName)) { return $false }
  $e = $EntryName.Replace('/', '\')
  if ($e.StartsWith('\\')) { return $false }
  if ($e -match '^[A-Za-z]:[\\/]') { return $false }
  if ($e.StartsWith('\')) { return $false }
  if ($e -match '[\x00-\x1F<>:"|?*]') {
    # ':' permitido apenas como drive no inicio (ja rejeitado); demais casos rejeita.
    # Permite ':'? Em entradas ZIP ':' e invalido no Windows; rejeita qualquer ':' restante.
    return $false
  }
  # Normaliza . e .. sem tocar no disco
  $parts = $e -split '\\'
  $stack = @()
  foreach ($part in $parts) {
    if ($part -eq '' -or $part -eq '.') { continue }
    if ($part -eq '..') {
      if ($stack.Count -eq 0) { return $false }
      if ($stack.Count -eq 1) { $stack = @() }
      else { $stack = $stack[0..($stack.Count - 2)] }
    } else { $stack += $part }
  }
  $normalized = $stack -join '\'
  if ([string]::IsNullOrWhiteSpace($normalized)) { return $false }
  return (Test-Mu99PathWithinRoot -Root $Root -Candidate $normalized)
}

function Test-Mu99ListingLinkHint {
  <#
  .SYNOPSIS
    Identifica indicadores explicitos de link em uma linha/bloco de listagem
    de extrator (Symbolic Link, Hard Link, Type=Link, setas, marcadores,
    modos unix lrwx). Qualquer acerto bloqueia a extracao antes de gravar.
  #>
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$Text)
  return [bool]($Text -match '(?i)(symbolic[ -]?link|hard[ -]?link|type\s*[:=]\s*link|->|<symlink>|<junction>|\bsymlink\b|\bjunction\b|lrwx)')
}

function Get-Mu99NestedRarInventory {
  <#
  .SYNOPSIS
    Lista membros de um RAR via extrator ja instalado (sem extrair nem executar).
    Aceita um adaptador de listagem injetavel para testes.
  #>
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string]$RarPath,
    [string]$ArchiveToolPath = '',
    [scriptblock]$ListAdapter = $null
  )
  if (-not (Test-Path -LiteralPath $RarPath) -and (-not $ListAdapter)) { throw ("RAR nao encontrado: " + $RarPath) }
  if ($ListAdapter) {
    $raw = & $ListAdapter $RarPath
    $norm = @()
    foreach ($item in @($raw)) {
      if ($item -is [string]) {
        if ([string]::IsNullOrWhiteSpace($item)) { continue }
        $norm += [pscustomobject]@{ name = $item; size = [long]0; linkHint = $false; source = 'adapter' }
      } elseif ($null -ne $item -and $null -ne $item.name -and (-not [string]::IsNullOrWhiteSpace([string]$item.name))) {
        $sz = [long]0
        try { if ($null -ne $item.size) { $sz = [long]$item.size } } catch {}
        $lh = $false
        try { if ($item.linkHint) { $lh = $true } } catch {}
        $norm += [pscustomobject]@{ name = [string]$item.name; size = $sz; linkHint = $lh; source = 'adapter' }
      } else { throw 'Adaptador de listagem retornou item sem nome; listagem recusada.' }
    }
    if ($norm.Count -eq 0) { throw ("Listagem vazia ou ilegivel para: " + $RarPath) }
    return $norm
  }
  $resolvedTool = $ArchiveToolPath
  if ([string]::IsNullOrWhiteSpace($resolvedTool)) {
    $snap = Get-Mu99EnvironmentSnapshot
    foreach ($t in $snap.archiveTools) {
      if ($t -match '(7z\.exe|WinRAR\.exe|Rar\.exe|UnRAR\.exe)$') { $resolvedTool = $t; break }
    }
  }
  if ([string]::IsNullOrWhiteSpace($resolvedTool) -or (-not (Test-Path -LiteralPath $resolvedTool))) {
    throw 'Extrator indisponivel: informe -ArchiveToolPath para 7-Zip/WinRAR ja instalado. O script nunca baixa ferramentas.'
  }
  $tool = $resolvedTool.ToLowerInvariant()
  $outLines = @()
  if ($tool -like '*7z*.exe') {
    $outLines = & $resolvedTool 'l' '-slt' '--' $RarPath 2>&1
    if ($LASTEXITCODE -ne 0) { throw ("Falha ao listar RAR (7-Zip): " + ($outLines -join "`n")) }
    $names = @()
    $pendingName = ''; $pendingSize = [long]0; $pendingBlock = ''
    foreach ($line in ($outLines + @(''))) {
      if ($line -match '^\s*$') {
        if ((-not [string]::IsNullOrWhiteSpace($pendingName)) -and ($pendingName -ne $RarPath) -and ($pendingName -notmatch '^[A-Z]:')) {
          $names += [pscustomobject]@{ name = $pendingName; size = $pendingSize; linkHint = (Test-Mu99ListingLinkHint -Text $pendingBlock); source = '7z' }
        }
        $pendingName = ''; $pendingSize = [long]0; $pendingBlock = ''
        continue
      }
      if ($line -match '^Path\s*=\s*(.+)$') {
        if ((-not [string]::IsNullOrWhiteSpace($pendingName)) -and ($pendingName -ne $RarPath) -and ($pendingName -notmatch '^[A-Z]:')) {
          $names += [pscustomobject]@{ name = $pendingName; size = $pendingSize; linkHint = (Test-Mu99ListingLinkHint -Text $pendingBlock); source = '7z' }
        }
        $pendingName = $Matches[1].Trim(); $pendingSize = [long]0; $pendingBlock = $line
      }
      elseif ($line -match '^Size\s*=\s*(\d+)\s*$') { try { $pendingSize = [long]$Matches[1] } catch {}; $pendingBlock += "`n" + $line }
      elseif ($pendingName -ne '') { $pendingBlock += "`n" + $line }
    }
    if ($names.Count -eq 0) { throw ("Listagem vazia ou ilegivel para: " + $RarPath) }
    return $names
  } else {
    $outLines = & $resolvedTool 'l' '-c-' '--' $RarPath 2>&1
    if ($LASTEXITCODE -ne 0) { throw ("Falha ao listar RAR (WinRAR/UnRAR): " + ($outLines -join "`n")) }
    # UnRAR lista colunas; extrai tamanho e nome apos data/hora.
    $names = @()
    $inList = $false
    foreach ($line in $outLines) {
      if ($line -match '^\s*Atributos\s+Tamanho') { $inList = $true; continue }
      if (-not $inList) { continue }
      if ($line -match '^-----------') { continue }
      if ($line -match '^\s*$') { continue }
      if ($line -match '^\s+(\.\.|Todo|All)\s') { continue }
      if ($line -match '^\s*([\.A-Za-z]{7}|\S+)\s+(\d+)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(.+)$') {
        $attrs = $Matches[1]
        $sz = [long]0
        try { $sz = [long]$Matches[2] } catch {}
        $nm = $Matches[3].Trim()
        # Formas conhecidas: arquivos (..A...., ..A...R) e diretorios (...D...).
        # Qualquer outra forma e tratada como possivel link (fail-closed), pois
        # a listagem resumida nao distingue links de arquivos regulares.
        $lh = (Test-Mu99ListingLinkHint -Text $line)
        if ((-not $lh) -and ($attrs -notmatch '^[\.A-Za-z]{7}$')) { $lh = $true }
        $names += [pscustomobject]@{ name = $nm; size = $sz; linkHint = [bool]$lh; source = 'unrar' }
      }
    }
    if ($names.Count -eq 0) { throw ("Listagem vazia ou ilegivel para: " + $RarPath) }
    return $names
  }
}

function Test-Mu99WriteRootSafe {
  <#
  .SYNOPSIS
    Valida a raiz de escrita ANTES de chamar qualquer extrator: o diretorio
    de destino (se existir) e sua pasta pai (que deve existir) nao podem ser
    reparse point/junction, nem um arquivo comum. Impede que o extrator
    grave fora do staging e que a limpeza siga um caminho redirecionado.
  #>
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string]$DestinationDir,
    [scriptblock]$AttributeReader = $null
  )
  $reader = $AttributeReader
  if (-not $reader) {
    $reader = { param([string]$P) return (Get-Item -LiteralPath $P -Force).Attributes }.GetNewClosure()
  }
  if (Test-Path -LiteralPath $DestinationDir) {
    try { $a = & $reader $DestinationDir }
    catch { throw ("Nao foi possivel ler atributos do destino; expansao bloqueada antes de gravar: " + $DestinationDir) }
    if (($a -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw ("Destino de expansao e reparse point/junction pre-existente; expansao bloqueada antes de gravar (nada foi alterado nem removido): " + $DestinationDir)
    }
    if (($a -band [System.IO.FileAttributes]::Directory) -eq 0) {
      throw ("Destino de expansao existe e nao e diretorio; expansao bloqueada antes de gravar: " + $DestinationDir)
    }
    return $true
  }
  $parent = Split-Path -Parent $DestinationDir
  if ([string]::IsNullOrWhiteSpace($parent) -or (-not (Test-Path -LiteralPath $parent))) {
    throw ("Pasta pai do destino nao existe; expansao bloqueada antes de gravar: " + $DestinationDir)
  }
  try { $pa = & $reader $parent }
  catch { throw ("Nao foi possivel ler atributos da pasta pai; expansao bloqueada antes de gravar: " + $parent) }
  if (($pa -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw ("Pasta pai do destino e reparse point/junction; expansao bloqueada antes de gravar (nada foi alterado): " + $parent)
  }
  return $true
}

function Clear-Mu99CreatedDir {
  <#
  .SYNOPSIS
    Remove um diretorio criado pelo proprio script, somente apos reverificar
    que nao e reparse point. Nunca remove o que nao criou nem segue redirecao:
    nesses casos lanca erro pedindo remocao manual, sem apagar nada.
  #>
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [bool]$WasCreatedByUs = $false,
    [scriptblock]$AttributeReader = $null
  )
  if (-not $WasCreatedByUs) { return $false }
  if (-not (Test-Path -LiteralPath $Path)) { return $true }
  $reader = $AttributeReader
  if (-not $reader) {
    $reader = { param([string]$P) return (Get-Item -LiteralPath $P -Force).Attributes }.GetNewClosure()
  }
  try { $a = & $reader $Path }
  catch { throw ("Limpeza recusada (atributos nao lidos, nada removido; remova manualmente): " + $Path) }
  if (($a -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw ("Limpeza recusada (virou reparse point, nada removido; remova manualmente): " + $Path)
  }
  Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
  return $true
}

function Test-Mu99StagingTreeSafe {
  <#
  .SYNOPSIS
    Varredura somente leitura de uma arvore extraida: tudo deve estar dentro
    da raiz e nenhum item pode ser reparse point/link. Retorna violacoes.
  #>
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [scriptblock]$AttributeReader = $null
  )
  $violations = @()
  $reader = $AttributeReader
  if (-not $reader) {
    $reader = { param([string]$P) return (Get-Item -LiteralPath $P -Force).Attributes }.GetNewClosure()
  }
  # A propria raiz tambem e verificada (nao somente os filhos): se a raiz
  # sumiu ou virou reparse point, a arvore e considerada insegura.
  if (-not (Test-Path -LiteralPath $Root)) {
    return @([pscustomobject]@{ path = $Root; reason = 'raiz-ausente' })
  }
  try { $rootAttrs = & $reader $Root }
  catch { return @([pscustomobject]@{ path = $Root; reason = 'atributos-nao-lidos' }) }
  if (($rootAttrs -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    return @([pscustomobject]@{ path = $Root; reason = 'root-reparse-point' })
  }
  $stack = @($Root)
  while ($stack.Count -gt 0) {
    $dir = $stack[0]
    if ($stack.Count -eq 1) { $stack = @() } else { $stack = $stack[1..($stack.Count - 1)] }
    $children = @()
    try { $children = @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction Stop) } catch { $violations += [pscustomobject]@{ path = $dir; reason = 'ilegivel' }; continue }
    foreach ($it in $children) {
      if (-not (Test-Mu99PathWithinRoot -Root $Root -Candidate $it.FullName)) {
        $violations += [pscustomobject]@{ path = $it.FullName; reason = 'fora-do-destino' }
        continue
      }
      $attrs = $null
      try { $attrs = & $reader $it.FullName } catch { $violations += [pscustomobject]@{ path = $it.FullName; reason = 'atributos-nao-lidos'; }; continue }
      if (($attrs -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        $violations += [pscustomobject]@{ path = $it.FullName; reason = 'reparse-point/link' }
        continue
      }
      if (($attrs -band [System.IO.FileAttributes]::Directory) -ne 0) { $stack += $it.FullName }
    }
  }
  return $violations
}

function Expand-Mu99NestedArchive {
  <#
  .SYNOPSIS
    Expande um RAR aninhado para um diretorio segregado novo, somente apos
    listar e validar TODOS os membros (traversal, links, formatos nao
    suportados). Nunca executa conteudo do pacote.
  #>
  [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
  param(
    [Parameter(Mandatory = $true)][string]$RarPath,
    [Parameter(Mandatory = $true)][string]$DestinationDir,
    [string]$ArchiveToolPath = '',
    [scriptblock]$ListAdapter = $null,
    [scriptblock]$ExtractAdapter = $null,
    [scriptblock]$AttributeReader = $null
  )
  if (-not (Test-Path -LiteralPath $RarPath)) { throw ("RAR nao encontrado: " + $RarPath) }
  if (Test-Path -LiteralPath $DestinationDir) {
    # Destino pre-existente: primeiro garante que nao e reparse (nunca toca),
    # depois recusa sobrescrita/mesclagem de qualquer jeito.
    Test-Mu99WriteRootSafe -DestinationDir $DestinationDir -AttributeReader $AttributeReader | Out-Null
    throw ("Destino de expansao ja existe; recusa de sobrescrita/mesclagem (use um caminho novo): " + $DestinationDir)
  }
  # 1. Listar todos os membros (sem extrair).
  $members = @(Get-Mu99NestedRarInventory -RarPath $RarPath -ArchiveToolPath $ArchiveToolPath -ListAdapter $ListAdapter)
  if ($members.Count -eq 0) { throw ("RAR sem membros listaveis; expansao bloqueada: " + $RarPath) }
  # 2. Validar TODOS os caminhos antes de gravar qualquer membro.
  foreach ($m in $members) {
    if ($m.linkHint) { throw ("Membro indica link/reparse point; expansao bloqueada antes de gravar: " + $m.name) }
    if (-not (Test-Mu99ArchiveEntryPath -Root $DestinationDir -EntryName $m.name)) {
      throw ("Membro hostil ou fora do destino; expansao bloqueada antes de gravar: " + $m.name)
    }
    $leaf = ([string]$m.name).Replace('/', '\')
    $leaf = $leaf.Substring($leaf.LastIndexOf('\') + 1)
    if ($leaf -match '^(?i)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$') {
      throw ("Nome de dispositivo reservado; expansao bloqueada: " + $m.name)
    }
    if ($leaf -match '[. ]$') { throw ("Nome terminado em ponto/espaco (formato nao suportado); expansao bloqueada: " + $m.name) }
  }
  # 3. Remover raiz comum unica (ex.: "[release] Files 99b\") quando presente em todos.
  $strippedRoot = ''
  $finalNames = @()
  foreach ($m in $members) { $finalNames += [string]$m.name }
  $split = @()
  foreach ($n in $finalNames) { $split += ,(@(([string]$n).Replace('/', '\') -split '\\')) }
  $common = $true
  $first = ''
  foreach ($parts in $split) {
    if ($parts.Count -lt 2) { $common = $false; break }
    if ($first -eq '') { $first = $parts[0] }
    elseif ($parts[0] -ne $first) { $common = $false; break }
  }
  if ($common -and ($first -ne '') -and ($first -ne '.') -and ($first -ne '..')) {
    $strippedRoot = $first
    $finalNames = @()
    foreach ($m in $members) {
      $rel = ([string]$m.name).Replace('/', '\')
      $rel = $rel.Substring($strippedRoot.Length + 1)
      if ([string]::IsNullOrWhiteSpace($rel)) { throw ("Membro reduzido a raiz comum; expansao bloqueada: " + $m.name) }
      if (-not (Test-Mu99ArchiveEntryPath -Root $DestinationDir -EntryName $rel)) {
        throw ("Membro hostil apos remocao da raiz; expansao bloqueada: " + $m.name)
      }
      $finalNames += $rel
    }
  }
  # 4. Estimar espaco antes de gravar.
  $need = [long]10485760
  foreach ($m in $members) { try { $need += [long]$m.size } catch {} }
  $need = [long]($need * 1.3)
  $free = [long]0
  try { $free = Get-Mu99DestinationFreeBytes -Path ([System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($DestinationDir))) } catch {}
  if (($free -gt 0) -and ($need -gt $free)) { throw ("Espaco insuficiente para expandir RAR (necessario ~" + [math]::Round($need/1MB,1) + " MB). Nada foi gravado.") }
  # 5. Validar raiz/parent contra reparse ANTES de chamar qualquer extrator.
  #    Impede gravacao fora do staging e limpeza seguindo caminho redirecionado.
  Test-Mu99WriteRootSafe -DestinationDir $DestinationDir -AttributeReader $AttributeReader | Out-Null
  # 6. Gate de confirmacao: -WhatIf nao grava nada.
  if (-not $PSCmdlet.ShouldProcess($DestinationDir, ("Expandir RAR validado (" + $members.Count + " membros) a partir de " + $RarPath))) { return $null }
  $weCreatedDir = $false
  if (-not (Test-Path -LiteralPath $DestinationDir)) {
    New-Item -ItemType Directory -Path $DestinationDir | Out-Null
    $weCreatedDir = $true
  }
  try {
    if ($ExtractAdapter) {
      & $ExtractAdapter $RarPath $DestinationDir $finalNames | Out-Null
    } else {
      $resolvedTool = $ArchiveToolPath
      if ([string]::IsNullOrWhiteSpace($resolvedTool)) {
        $snap = Get-Mu99EnvironmentSnapshot
        foreach ($t in $snap.archiveTools) {
          if ($t -match '(7z\.exe|WinRAR\.exe|Rar\.exe|UnRAR\.exe)$') { $resolvedTool = $t; break }
        }
      }
      if ([string]::IsNullOrWhiteSpace($resolvedTool) -or (-not (Test-Path -LiteralPath $resolvedTool))) {
        throw 'Extrator indisponivel para expansao; informe -ArchiveToolPath ja instalado. Nada foi gravado.'
      }
      if ($resolvedTool.ToLowerInvariant() -like '*7z*.exe') {
        & $resolvedTool 'x' ('-o' + $DestinationDir) '-y' '--' $RarPath | Out-Null
        if ($LASTEXITCODE -ne 0) { throw ("Falha ao extrair RAR (7-Zip, saida " + $LASTEXITCODE + ").") }
      } else {
        & $resolvedTool 'x' '-o-' '-c-' $RarPath ($DestinationDir + '\') | Out-Null
        if ($LASTEXITCODE -ne 0) { throw ("Falha ao extrair RAR (WinRAR/UnRAR, saida " + $LASTEXITCODE + ").") }
      }
      if ($strippedRoot -ne '') {
        $rootDir = Join-Path $DestinationDir $strippedRoot
        if (Test-Path -LiteralPath $rootDir) {
          try { $rdAttrs = (Get-Item -LiteralPath $rootDir -Force -ErrorAction Stop).Attributes }
          catch { throw ("Nao foi possivel ler atributos da raiz do RAR; reorganizacao bloqueada: " + $rootDir) }
          if (($rdAttrs -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw ("Raiz do RAR e reparse point/junction; reorganizacao bloqueada (nada movido): " + $rootDir)
          }
          foreach ($child in @(Get-ChildItem -LiteralPath $rootDir -Force)) {
            $target = Join-Path $DestinationDir $child.Name
            if (Test-Path -LiteralPath $target) { throw ("Colisao ao reorganizar raiz do RAR: " + $child.Name) }
            if (-not (Test-Mu99PathWithinRoot -Root $DestinationDir -Candidate $target)) { throw ("Alvo fora do destino ao reorganizar: " + $target) }
            Move-Item -LiteralPath $child.FullName -Destination $target
          }
          $left = @(Get-ChildItem -LiteralPath $rootDir -Force -ErrorAction SilentlyContinue)
          if (@($left).Count -eq 0) { Remove-Item -LiteralPath $rootDir -Force }
        }
      }
    }
  } catch {
    $origErr = $_
    $cleanupFailed = ''
    try { Clear-Mu99CreatedDir -Path $DestinationDir -WasCreatedByUs $weCreatedDir -AttributeReader $AttributeReader | Out-Null }
    catch { $cleanupFailed = $_.Exception.Message }
    if ($cleanupFailed -ne '') { throw ($origErr.Exception.Message + ' | LIMPEZA PENDENTE (remova manualmente): ' + $cleanupFailed) }
    $PSCmdlet.ThrowTerminatingError($origErr)
  }
  # 7. Varredura pos-extracao: raiz, reparse points, tudo dentro do destino.
  $violations = @(Test-Mu99StagingTreeSafe -Root $DestinationDir -AttributeReader $AttributeReader)
  if (@($violations).Count -gt 0) {
    $firstV = @($violations)[0]
    $cleanupFailed = ''
    try { Clear-Mu99CreatedDir -Path $DestinationDir -WasCreatedByUs $weCreatedDir -AttributeReader $AttributeReader | Out-Null }
    catch { $cleanupFailed = $_.Exception.Message }
    if ($cleanupFailed -ne '') {
      throw ("Arvore extraida insegura (" + $firstV.reason + "): " + $firstV.path + ". LIMPEZA PENDENTE (remova manualmente): " + $cleanupFailed)
    }
    throw ("Arvore extraida insegura (" + $firstV.reason + "): " + $firstV.path + ". Tudo foi removido.")
  }
  # 8. Hashes (leitura apenas; nada e executado).
  $files = @(Get-ChildItem -LiteralPath $DestinationDir -Recurse -File -Force -ErrorAction SilentlyContinue)
  $hashes = @()
  foreach ($f in $files) {
    $h = ''
    try { $h = Get-Mu99FileSha256 -Path $f.FullName } catch { $h = 'unreadable' }
    $hashes += [pscustomobject]@{ file = $f.FullName; sha256 = $h }
  }
  return [pscustomobject]@{
    destinationDir = $DestinationDir
    sourceRar = $RarPath
    memberCount = $members.Count
    strippedRoot = $strippedRoot
    fileCount = $files.Count
    files = $hashes
  }
}

function Get-Mu99DestinationFreeBytes {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$Path)
  $driveRoot = [System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($Path))
  foreach ($d in [System.IO.DriveInfo]::GetDrives()) {
    if ($d.IsReady -and ($d.Name -ieq $driveRoot)) { return [long]$d.AvailableFreeSpace }
  }
  return [long]0
}

function Invoke-Mu99StagePackage {
  [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
  param(
    [Parameter(Mandatory = $true)][string]$PackageZipPath,
    [Parameter(Mandatory = $true)][string]$DestinationRoot,
    [string]$ArchiveToolPath = '',
    [scriptblock]$ListAdapter = $null,
    [scriptblock]$ExtractAdapter = $null
  )
  if (-not (Test-Path -LiteralPath $PackageZipPath)) { throw ("Pacote nao encontrado: " + $PackageZipPath) }
  if (Test-Path -LiteralPath $DestinationRoot) { throw ("Destino ja existe; recusa de sobrescrita: " + $DestinationRoot) }
  Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
  # Validacao previa de todas as entradas do ZIP externo
  $fs = [System.IO.File]::OpenRead($PackageZipPath)
  try {
    $ar = New-Object System.IO.Compression.ZipArchive($fs, ([System.IO.Compression.ZipArchiveMode]::Read))
    try {
      $zipEntries = @($ar.Entries)
      foreach ($e in $zipEntries) {
        if ($e.FullName.EndsWith('/')) { continue }
        if (-not (Test-Mu99ArchiveEntryPath -Root $DestinationRoot -EntryName $e.FullName)) {
          throw ("Entrada hostil ou fora do destino recusada: " + $e.FullName)
        }
      }
      $needBytes = 0
      foreach ($e in $zipEntries) { $needBytes += [long]$e.Length }
      $needBytes = [long]($needBytes * 1.3 + 50MB)
      $driveRoot = [System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($DestinationRoot))
      $freeBytes = [long]0
      try { $freeBytes = Get-Mu99DestinationFreeBytes -Path $DestinationRoot } catch {}
      if (($freeBytes -gt 0) -and ($needBytes -gt $freeBytes)) {
        throw ("Espaco insuficiente: necessario ~" + [math]::Round($needBytes/1MB,1) + " MB, livre " + [math]::Round($freeBytes/1MB,1) + " MB em " + $driveRoot)
      }
      $hasRar = @($zipEntries | Where-Object { $_.FullName -like '*.rar' }).Count -gt 0
      if ($hasRar) {
        if ((-not [string]::IsNullOrWhiteSpace($ArchiveToolPath)) -and (-not (Test-Path -LiteralPath $ArchiveToolPath))) {
          throw ("Extrator informado nao encontrado: " + $ArchiveToolPath + ". Nada foi extraido.")
        }
        $toolOk = $false
        if ((-not [string]::IsNullOrWhiteSpace($ArchiveToolPath)) -and (Test-Path -LiteralPath $ArchiveToolPath)) { $toolOk = $true }
        elseif ($ListAdapter -and $ExtractAdapter) { $toolOk = $true }
        else {
          try {
            $snap = Get-Mu99EnvironmentSnapshot
            foreach ($t in $snap.archiveTools) { if ($t) { $toolOk = $true; break } }
          } catch {}
        }
        if (-not $toolOk) { throw 'Pacote contem RARs aninhados e nenhum extrator (7-Zip/WinRAR) foi localizado; informe -ArchiveToolPath ja instalado. Nada foi extraido.' }
      }
    } finally { $ar.Dispose() }
  } finally { $fs.Dispose() }
  if (-not $PSCmdlet.ShouldProcess($DestinationRoot, 'Criar staging e extrair pacote validado (originais preservados)')) { return $null }
  New-Item -ItemType Directory -Path $DestinationRoot | Out-Null
  # Extracao do ZIP externo (originais preservados; ZIP nunca e modificado)
  $fs2 = [System.IO.File]::OpenRead($PackageZipPath)
  try {
    $ar2 = New-Object System.IO.Compression.ZipArchive($fs2, ([System.IO.Compression.ZipArchiveMode]::Read))
    try {
      foreach ($e in $ar2.Entries) {
        if ($e.FullName.EndsWith('/')) { continue }
        if (-not (Test-Mu99ArchiveEntryPath -Root $DestinationRoot -EntryName $e.FullName)) {
          throw ("Entrada hostil detectada durante a extracao: " + $e.FullName)
        }
        $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($DestinationRoot, ($e.FullName.Replace('/', '\'))))
        if (-not (Test-Mu99PathWithinRoot -Root $DestinationRoot -Candidate $target)) {
          throw ("Alvo fora do destino: " + $target)
        }
        $parent = [System.IO.Path]::GetDirectoryName($target)
        if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
        $src = $e.Open()
        try {
          $dst = [System.IO.File]::Create($target)
          try { $src.CopyTo($dst) } finally { $dst.Dispose() }
        } finally { $src.Dispose() }
      }
    } finally { $ar2.Dispose() }
  } finally { $fs2.Dispose() }
  # Expansao dos RARs aninhados em arvores segregadas (servidor/bibliotecas).
  # O RAR do cliente e ignorado aqui: somente PrepararCliente (com confirmacao
  # de direitos) pode extrai-lo. Nenhum conteudo do pacote e executado.
  $nestedReport = @()
  $stagedRars = @(Get-ChildItem -LiteralPath $DestinationRoot -Recurse -Filter *.rar -File -ErrorAction SilentlyContinue)
  if (@($stagedRars).Count -gt 0) {
    $resolvedTool = $ArchiveToolPath
    if (([string]::IsNullOrWhiteSpace($resolvedTool) -or (-not (Test-Path -LiteralPath $resolvedTool))) -and (-not $ListAdapter) -and (-not $ExtractAdapter)) {
      $resolvedTool = ''
      try {
        $snap2 = Get-Mu99EnvironmentSnapshot
        foreach ($t in $snap2.archiveTools) {
          if ($t -match '(7z\.exe|WinRAR\.exe|Rar\.exe|UnRAR\.exe)$') { $resolvedTool = $t; break }
        }
      } catch {}
    }
    foreach ($rarFile in $stagedRars) {
      $rn = $rarFile.Name
      $kind = ''
      if (($rn -like '*Files*') -and ($rn -like '*99b*')) { $kind = 'server' }
      elseif (($rn -like '*Client*') -and ($rn -like '*99b*')) { $kind = 'client' }
      elseif ($rn -like '*Librerias*') { $kind = 'libraries' }
      else { throw ("RAR aninhado desconhecido; expansao bloqueada (renomeie/mapeie manualmente): " + $rarFile.FullName) }
      if ($kind -eq 'client') {
        $nestedReport += [pscustomobject]@{
          rar = $rarFile.FullName; kind = $kind; status = 'skipped-client'
          note = 'Extracao do cliente somente via PrepararCliente com -ConfirmPrivateClientDistributionRights.'
        }
        continue
      }
      $segDir = Join-Path $DestinationRoot $kind
      $exp = Expand-Mu99NestedArchive -RarPath $rarFile.FullName -DestinationDir $segDir -ArchiveToolPath $resolvedTool -ListAdapter $ListAdapter -ExtractAdapter $ExtractAdapter
      if ($null -eq $exp) { throw ("Expansao cancelada pelo operador; staging inconsistente abortado: " + $rarFile.FullName) }
      $nestedReport += [pscustomobject]@{
        rar = $rarFile.FullName; kind = $kind; status = 'expanded'
        destinationDir = $exp.destinationDir; memberCount = $exp.memberCount
        strippedRoot = $exp.strippedRoot; fileCount = $exp.fileCount
      }
    }
  }
  $files = @(Get-ChildItem -LiteralPath $DestinationRoot -Recurse -File -ErrorAction SilentlyContinue)
  $hashes = @()
  foreach ($f in $files) {
    $h = ''
    try { $h = Get-Mu99FileSha256 -Path $f.FullName } catch { $h = 'unreadable' }
    $sig = 'not-checked'
    if ($f.Extension -match '(?i)^\.exe$') { $sig = 'pending-manual-review' }
    $hashes += [pscustomobject]@{ file = $f.FullName; sha256 = $h; signature = $sig }
  }
  return [pscustomobject]@{
    stagingRoot = $DestinationRoot
    fileCount = $files.Count
    files = $hashes
    nestedArchives = $nestedReport
    note = 'Originais preservados. RARs de servidor/bibliotecas expandidos em server/ e libraries/ apos validacao total; RAR do cliente somente via PrepararCliente.'
  }
}

# =============================================================
# Dependencias e configuracao (Task 4)
# =============================================================

function Get-Mu99DependencyReport {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$ServerRoot)
  if (-not (Test-Path -LiteralPath $ServerRoot)) { throw ("Raiz do servidor nao encontrada: " + $ServerRoot) }
  $sql = @()
  try {
    $svcs = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'MSSQL*' -or $_.DisplayName -like '*SQL Server*' }
    foreach ($s in $svcs) { $sql += [pscustomobject]@{ name = $s.Name; displayName = $s.DisplayName; status = $s.Status.ToString() } }
  } catch {}
  $exes = @(Get-ChildItem -LiteralPath $ServerRoot -Recurse -Include *.exe -ErrorAction SilentlyContinue)
  $exeInfo = @()
  foreach ($x in $exes) {
    $ver = ''; $arch = 'unknown'; $sig = 'unknown'
    try { $v = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($x.FullName); if ($v.FileVersion) { $ver = $v.FileVersion } } catch {}
    try {
      $bytes = [System.IO.File]::ReadAllBytes($x.FullName)
      if ($bytes.Length -gt 0x3D) {
        $peOff = [BitConverter]::ToInt32($bytes, 0x3C)
        if (($peOff -gt 0) -and ($peOff + 6 -lt $bytes.Length) -and $bytes[$peOff] -eq 0x50 -and $bytes[$peOff+1] -eq 0x45) {
          $machine = [BitConverter]::ToUInt16($bytes, $peOff + 4)
          if ($machine -eq 0x14c) { $arch = 'x86' } elseif ($machine -eq 0x8664) { $arch = 'x64' }
        }
      }
    } catch {}
    try {
      $s = Get-AuthenticodeSignature -LiteralPath $x.FullName -ErrorAction SilentlyContinue
      if ($s) { $sig = $s.Status.ToString() }
    } catch {}
    $exeInfo += [pscustomobject]@{ name = $x.Name; path = $x.FullName; version = $ver; architecture = $arch; signature = $sig }
  }
  $installers = @(Get-ChildItem -LiteralPath $ServerRoot -Recurse -Include *.exe -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)vcredist|vc_redist' } | ForEach-Object { $_.FullName })
  $unknowns = @()
  $unknowns += 'Versao de SQL/driver exigida pelos binarios nao confirmada; compatibilidade de backup nao prova compatibilidade do executavel.'
  $unknowns += 'SQL Server 2008 R2 nao e suportado no Windows Server 2019; SQL 2012 SP4 consta na matriz mas esta fora de suporte. Instalacao manual somente apos decisao de compatibilidade/licenca.'
  return [pscustomobject]@{
    serverRoot = $ServerRoot
    sqlServices = $sql
    executables = $exeInfo
    runtimeInstallersFound = $installers
    unknowns = $unknowns
    installsNothing = $true
  }
}

function Read-Mu99FileBytes {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$Path)
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  $enc = [System.Text.Encoding]::GetEncoding(1252)
  $text = $enc.GetString($bytes)
  if ($hasBom) { $text = ([System.Text.Encoding]::UTF8).GetString($bytes, 3, ($bytes.Length - 3)) }
  $newline = 'CRLF'
  if ($text.Contains("`r`n")) { $newline = 'CRLF' } elseif ($text.Contains("`n")) { $newline = 'LF' } else { $newline = 'NONE' }
  return [pscustomobject]@{ bytes = $bytes; text = $text; hasBom = $hasBom; newline = $newline }
}

function Get-Mu99ConfigProposal {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string]$ServerRoot,
    [string]$ClientRoot = '',
    [Parameter(Mandatory = $true)][string]$ServerAddress
  )
  if ($ServerAddress -match '\s') { throw 'ServerAddress invalido (contem espacos).' }
  if ($ServerAddress -match '[\"'']') { throw 'ServerAddress invalido (contem aspas).' }
  $changes = @()
  $blockers = @()
  # 1) ConnectServer\ServerList.dat : "TUIP"
  $sl = Join-Path $ServerRoot 'ConnectServer\ServerList.dat'
  if (Test-Path -LiteralPath $sl) {
    $f = Read-Mu99FileBytes -Path $sl
    $occ = ([regex]::Matches($f.text, '"TUIP"')).Count
    if ($occ -eq 1) {
      $changes += [pscustomobject]@{
        file = $sl; key = '"TUIP"'; before = '"TUIP"'; after = ('"' + $ServerAddress + '"')
        encoding = $(if ($f.hasBom) { 'UTF8-BOM' } else { 'ANSI' }); newline = $f.newline
      }
    } elseif ($occ -eq 0) { $blockers += ("ServerList.dat sem token TUIP reconhecido: " + $sl) }
    else { $blockers += ("ServerList.dat com chaves TUIP duplicadas (" + $occ + "); edicao bloqueada: " + $sl) }
  } else { $blockers += ("ServerList.dat ausente: " + $sl) }
  # 2) Data\MapServerInfo.dat : STUIP (placeholder observado no pacote)
  $ms = Join-Path $ServerRoot 'Data\MapServerInfo.dat'
  if (Test-Path -LiteralPath $ms) {
    $f = Read-Mu99FileBytes -Path $ms
    $occ = ([regex]::Matches($f.text, '(?m)(^|\s)STUIP(\s|$)')).Count
    if ($occ -eq 1) {
      $changes += [pscustomobject]@{
        file = $ms; key = 'STUIP'; before = 'STUIP'; after = $ServerAddress
        encoding = $(if ($f.hasBom) { 'UTF8-BOM' } else { 'ANSI' }); newline = $f.newline
      }
    } elseif ($occ -eq 0) {
      # Tenta TUIP como alternativa documentada
      $occ2 = ([regex]::Matches($f.text, '(?m)(^|\s)TUIP(\s|$)')).Count
      if ($occ2 -eq 1) {
        $changes += [pscustomobject]@{
          file = $ms; key = 'TUIP'; before = 'TUIP'; after = $ServerAddress
          encoding = $(if ($f.hasBom) { 'UTF8-BOM' } else { 'ANSI' }); newline = $f.newline
        }
      } elseif ($occ2 -eq 0) { $blockers += ("MapServerInfo.dat sem placeholder STUIP/TUIP reconhecido: " + $ms) }
      else { $blockers += ("MapServerInfo.dat com chaves TUIP duplicadas (" + $occ2 + "); edicao bloqueada: " + $ms) }
    } else { $blockers += ("MapServerInfo.dat com chaves STUIP duplicadas (" + $occ + "); edicao bloqueada: " + $ms) }
  } else { $blockers += ("MapServerInfo.dat ausente: " + $ms) }
  # 3) Client Config.ini : IpAddress = TUIP
  if ($ClientRoot -ne '') {
    $ci = Join-Path $ClientRoot 'Config.ini'
    if (Test-Path -LiteralPath $ci) {
      $f = Read-Mu99FileBytes -Path $ci
      $m = [regex]::Matches($f.text, '(?im)^\s*IpAddress\s*=\s*TUIP\s*$')
      if ($m.Count -eq 1) {
        $changes += [pscustomobject]@{
          file = $ci; key = 'IpAddress'; before = 'IpAddress = TUIP'; after = ('IpAddress = ' + $ServerAddress)
          encoding = $(if ($f.hasBom) { 'UTF8-BOM' } else { 'ANSI' }); newline = $f.newline
        }
      } elseif ($m.Count -eq 0) { $blockers += ("Config.ini sem linha IpAddress = TUIP reconhecida: " + $ci) }
      else { $blockers += ("Config.ini com chaves IpAddress duplicadas (" + $m.Count + "); edicao bloqueada: " + $ci) }
    } else { $blockers += ("Config.ini ausente: " + $ci) }
  }
  return [pscustomobject]@{ serverAddress = $ServerAddress; changes = $changes; blockers = $blockers }
}

function Get-Mu99FileLinkCount {
  <#
  .SYNOPSIS
    Conta hardlinks de um arquivo via fsutil (somente leitura). Falha fechada:
    se a contagem nao puder ser verificada, lanca erro em vez de afirmar.
  #>
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [scriptblock]$FsutilRunner = $null
  )
  $runner = $FsutilRunner
  if (-not $runner) {
    $runner = {
      param([string]$P)
      $o = & fsutil hardlink list "$P" 2>&1
      if ($LASTEXITCODE -ne 0) { throw ("fsutil hardlink list falhou: " + (@($o) -join "`n")) }
      return @($o)
    }.GetNewClosure()
  }
  $lines = @(& $runner $Path | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
  return @($lines).Count
}

function Test-Mu99FileSafeForWrite {
  <#
  .SYNOPSIS
    Guarda de escrita: o alvo deve existir, ser arquivo comum (sem reparse
    point) e ter exatamente 1 link. Impede escrita atraves de symlink,
    junction ou hardlink para fora do staging. Falha fechada quando a
    verificacao nao e possivel.
  #>
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [scriptblock]$AttributeReader = $null,
    [scriptblock]$FsutilRunner = $null
  )
  if (-not (Test-Path -LiteralPath $Path)) { throw ("Alvo de escrita nao encontrado: " + $Path) }
  $reader = $AttributeReader
  if (-not $reader) {
    $reader = { param([string]$P) return (Get-Item -LiteralPath $P -Force).Attributes }.GetNewClosure()
  }
  try { $a = & $reader $Path }
  catch { throw ("Atributos do alvo nao lidos; escrita bloqueada: " + $Path) }
  if (($a -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw ("Alvo e reparse point/link; escrita bloqueada (nada foi alterado): " + $Path)
  }
  if (($a -band [System.IO.FileAttributes]::Directory) -ne 0) {
    throw ("Alvo e diretorio, nao arquivo; escrita bloqueada: " + $Path)
  }
  try { $n = Get-Mu99FileLinkCount -Path $Path -FsutilRunner $FsutilRunner }
  catch { throw ("Nao foi possivel verificar hardlinks; escrita bloqueada: " + $Path + " (" + $_.Exception.Message + ")") }
  if ($n -ne 1) {
    throw ("Arquivo possui " + $n + " links (possivel hardlink para fora do staging); escrita bloqueada (nada foi alterado): " + $Path)
  }
  return $true
}

function Set-Mu99AddressConfiguration {
  [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
  param(
    [Parameter(Mandatory = $true)][pscustomobject]$Proposal,
    [Parameter(Mandatory = $true)][string]$DestinationRoot,
    [scriptblock]$AttributeReader = $null,
    [scriptblock]$FsutilRunner = $null
  )
  if ($Proposal.blockers -and $Proposal.blockers.Count -gt 0) {
    throw ("Proposta contem bloqueios; nenhuma escrita realizada: " + ($Proposal.blockers -join ' | '))
  }
  if (-not $Proposal.changes -or $Proposal.changes.Count -eq 0) { throw 'Proposta sem alteracoes reconhecidas; nada a escrever.' }
  # Pre-valida TODOS os alvos (existencia + anti-link) antes de criar
  # qualquer diretorio, backup ou escrita.
  foreach ($ch in $Proposal.changes) {
    if (-not (Test-Path -LiteralPath $ch.file)) { throw ("Arquivo sumiu antes da escrita: " + $ch.file) }
    Test-Mu99FileSafeForWrite -Path $ch.file -AttributeReader $AttributeReader -FsutilRunner $FsutilRunner | Out-Null
  }
  $backupDir = Join-Path $DestinationRoot 'backups'
  if (-not (Test-Path -LiteralPath $backupDir)) {
    if ($PSCmdlet.ShouldProcess($backupDir, 'Criar diretorio de backups')) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
    else { return @() }
  }
  $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
  $backups = @()
  foreach ($ch in $Proposal.changes) {
    $src = $ch.file
    if (-not (Test-Path -LiteralPath $src)) { throw ("Arquivo sumiu antes da escrita: " + $src) }
    # Guarda anti-link (revalidado; nada e escrito atraves de link).
    Test-Mu99FileSafeForWrite -Path $src -AttributeReader $AttributeReader -FsutilRunner $FsutilRunner | Out-Null
    $origBytes = [System.IO.File]::ReadAllBytes($src)
    $sha = ''
    $s = [System.Security.Cryptography.SHA256]::Create()
    try { $h = $s.ComputeHash($origBytes); $sha = (($h | ForEach-Object { $_.ToString('x2') }) -join '') } finally { $s.Dispose() }
    $leaf = [System.IO.Path]::GetFileName($src) + '.' + $stamp + '.bak'
    $bakPath = Join-Path $backupDir $leaf
    $k = 0
    while (Test-Path -LiteralPath $bakPath) { $k++; $bakPath = Join-Path $backupDir ([System.IO.Path]::GetFileName($src) + '.' + $stamp + '-' + $k + '.bak') }
    if ($PSCmdlet.ShouldProcess($src, ("Backup + aplicar " + $ch.key + ' -> ' + $ch.after))) {
      [System.IO.File]::WriteAllBytes($bakPath, $origBytes)
      $backups += $bakPath
      # Aplica preservando encoding/BOM/line endings: edicao textual minima.
      $f = Read-Mu99FileBytes -Path $src
      $newText = $f.text
      if ($ch.key -eq '"TUIP"') { $newText = $newText.Replace('"TUIP"', ('"' + $Proposal.serverAddress + '"')) }
      elseif ($ch.key -eq 'STUIP') { $newText = [regex]::Replace($newText, '(?m)(^|\s)STUIP(\s|$)', ('$1' + $Proposal.serverAddress + '$2'), 1) }
      elseif ($ch.key -eq 'TUIP') {
        if ($src -like '*MapServerInfo.dat') { $newText = [regex]::Replace($newText, '(?m)(^|\s)TUIP(\s|$)', ('$1' + $Proposal.serverAddress + '$2'), 1) }
        else { $newText = $newText.Replace('"TUIP"', ('"' + $Proposal.serverAddress + '"')) }
      }
      elseif ($ch.key -eq 'IpAddress') { $newText = [regex]::Replace($newText, '(?im)^\s*IpAddress\s*=\s*TUIP\s*$', ('IpAddress = ' + $Proposal.serverAddress), 1) }
      else { throw ("Chave nao suportada (sem broad replace): " + $ch.key) }
      if ($f.hasBom) {
        $utf8 = New-Object System.Text.UTF8Encoding($true)
        [System.IO.File]::WriteAllText($src, $newText, $utf8)
      } else {
        $latin = [System.Text.Encoding]::GetEncoding(1252)
        [System.IO.File]::WriteAllBytes($src, $latin.GetBytes($newText))
      }
    }
  }
  return $backups
}

# =============================================================
# Banco SQL (Task 5)
# =============================================================

$script:Mu99SqlExecutor = $null

function Get-Mu99SqlExecutor {
  if ($script:Mu99SqlExecutor) { return $script:Mu99SqlExecutor }
  return {
    param([string]$SqlInstance, [string]$Query, [pscredential]$Credential)
    Add-Type -AssemblyName System.Data -ErrorAction SilentlyContinue
    $csb = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
    $csb['Data Source'] = $SqlInstance
    $csb['Initial Catalog'] = 'master'
    $csb['Connect Timeout'] = 15
    if ($Credential) {
      $csb['Integrated Security'] = $false
      $csb['User ID'] = $Credential.UserName
      $csb['Password'] = $Credential.GetNetworkCredential().Password
    } else { $csb['Integrated Security'] = $true }
    $con = New-Object System.Data.SqlClient.SqlConnection($csb.ConnectionString)
    try {
      $con.Open()
      $cmd = $con.CreateCommand()
      $cmd.CommandText = $Query
      $cmd.CommandTimeout = 120
      $rdr = $cmd.ExecuteReader()
      $rows = @()
      try {
        while ($rdr.Read()) {
          $row = @{}
          for ($i = 0; $i -lt $rdr.FieldCount; $i++) { $row[$rdr.GetName($i)] = $rdr.GetValue($i) }
          $rows += [pscustomobject]$row
        }
      } finally { $rdr.Dispose() }
      return $rows
    } finally { $con.Dispose() }
  }
}

function Test-Mu99LocalInstanceName {
  [CmdletBinding()]
  param([string]$SqlInstance)
  if ([string]::IsNullOrWhiteSpace($SqlInstance)) { return $false }
  if ($SqlInstance -match '^(?i)(localhost|127\.0\.0\.1|\.|\(local\))([\\/].*)?$') { return $true }
  if ($SqlInstance -match '^(?i)[A-Z0-9_.\-]+\\[A-Z0-9_.\-]+$') {
    #_named local instance_ sem host remoto aparente
    if ($SqlInstance -match '[\\/]{2}|\b(tcp|http):') { return $false }
    return $true
  }
  return $false
}

function Test-Mu99SqlInstance {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string]$SqlInstance,
    [pscredential]$Credential = $null,
    [scriptblock]$SqlExecutor = $null
  )
  if (-not (Test-Mu99LocalInstanceName -SqlInstance $SqlInstance)) {
    throw ("SqlInstance remota nao suportada por padrao (use instancia local explicita): " + $SqlInstance)
  }
  $exec = $SqlExecutor
  if (-not $exec) { $exec = Get-Mu99SqlExecutor }
  try {
    $rows = & $exec $SqlInstance 'SELECT SERVERPROPERTY(''ProductVersion'') AS ProductVersion, SERVERPROPERTY(''Edition'') AS Edition, DB_NAME() AS CurrentDb' $Credential
    $v = ''; $e = ''
    if ($rows -and $rows.Count -gt 0) { $v = '' + $rows[0].ProductVersion; $e = '' + $rows[0].Edition }
    return [pscustomobject]@{ instance = $SqlInstance; reachable = $true; productVersion = $v; edition = $e }
  } catch {
    $msg = ConvertTo-Mu99RedactedText -Text $_.Exception.Message
    throw ("Falha de conexao SQL em " + $SqlInstance + ": " + $msg)
  }
}

function Get-Mu99SqlCredential {
  [CmdletBinding()]
  param()
  Write-Warning 'Autenticacao Windows indisponivel/recusada; solicitando credencial SQL interativamente (senha nao vai para linha de comando/log).'
  $cred = Get-Credential -Message 'Informe a credencial SQL local (somente se a Autenticacao Windows falhar)'
  if (-not $cred) { throw 'Credencial nao informada; operacao de banco abortada.' }
  return $cred
}

function Quote-Mu99SqlIdentifier {
  param([string]$Name)
  return ('[' + $Name.Replace(']', ']]') + ']')
}

function Get-Mu99BackupMetadata {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string]$BackupPath,
    [Parameter(Mandatory = $true)][string]$SqlInstance,
    [pscredential]$Credential = $null,
    [scriptblock]$SqlExecutor = $null
  )
  if (-not ($BackupPath -like '*DB\MuOnline.bak' -or $BackupPath -like '*DB/MuOnline.bak')) {
    throw ("Somente DB\MuOnline.bak e aceito (recusado): " + $BackupPath)
  }
  if (-not (Test-Path -LiteralPath $BackupPath)) { throw ("Backup nao encontrado: " + $BackupPath) }
  $exec = $SqlExecutor
  if (-not $exec) { $exec = Get-Mu99SqlExecutor }
  $q = $BackupPath.Replace("'", "''")
  $header = @(& $exec $SqlInstance ("RESTORE HEADERONLY FROM DISK = N'" + $q + "'") $Credential)
  $filelist = @(& $exec $SqlInstance ("RESTORE FILELISTONLY FROM DISK = N'" + $q + "'") $Credential)
  $verify = @(& $exec $SqlInstance ("RESTORE VERIFYONLY FROM DISK = N'" + $q + "'") $Credential)
  if ($header.Count -eq 0) { throw ("Backup invalido (HEADERONLY vazio, VERIFYONLY nao confirmado): " + $BackupPath) }
  return [pscustomobject]@{
    backupPath = $BackupPath
    header = $header
    fileList = $filelist
    verify = $verify
    valid = $true
  }
}

function Invoke-Mu99DatabaseRestore {
  [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
  param(
    [Parameter(Mandatory = $true)][string]$BackupPath,
    [Parameter(Mandatory = $true)][string]$SqlInstance,
    [string]$DatabaseName = '',
    [Parameter(Mandatory = $true)][string]$BackupRoot,
    [switch]$ConfirmDatabaseOverwrite,
    [pscredential]$Credential = $null,
    [scriptblock]$SqlExecutor = $null
  )
  if (-not ($BackupPath -like '*DB\MuOnline.bak' -or $BackupPath -like '*DB/MuOnline.bak')) {
    throw ("Somente DB\MuOnline.bak pode ser restaurado (recusado): " + $BackupPath)
  }
  if (-not (Test-Path -LiteralPath $BackupPath)) { throw ("Backup nao encontrado: " + $BackupPath) }
  if ([string]::IsNullOrWhiteSpace($DatabaseName)) { throw 'DatabaseName nao informado.' }
  if ($DatabaseName -match '[;\x27"]|\s|--') { throw ("DatabaseName invalido: " + $DatabaseName) }
  if (-not (Test-Mu99LocalInstanceName -SqlInstance $SqlInstance)) {
    throw ("SqlInstance remota nao suportada: " + $SqlInstance)
  }
  $exec = $SqlExecutor
  if (-not $exec) { $exec = Get-Mu99SqlExecutor }
  # Metadados + VERIFYONLY antes de qualquer escrita
  $meta = Get-Mu99BackupMetadata -BackupPath $BackupPath -SqlInstance $SqlInstance -Credential $Credential -SqlExecutor $exec
  if (-not $meta.valid) { throw 'Backup invalido (VERIFYONLY falhou); restauracao abortada.' }
  $dbId = Quote-Mu99SqlIdentifier $DatabaseName
  $dbQ = $DatabaseName.Replace("'", "''")
  $existing = @(& $exec $SqlInstance ("SELECT name, state_desc FROM sys.databases WHERE name = N'" + $dbQ + "'") $Credential)
  if ($existing.Count -gt 0 -and (-not $ConfirmDatabaseOverwrite)) {
    throw ("Banco " + $DatabaseName + " ja existe; informe -ConfirmDatabaseOverwrite explicito para sobrescrever. Nada foi alterado.")
  }
  if ($existing.Count -gt 0) {
    $sessions = @(& $exec $SqlInstance ("SELECT session_id FROM sys.dm_exec_sessions WHERE database_id = DB_ID(N'" + $dbQ + "')") $Credential)
    if ($sessions.Count -gt 0) { throw ("Banco " + $DatabaseName + " em uso (" + $sessions.Count + " sessoes); abortando sem derrubar sessoes.") }
  }
  if (-not (Test-Path -LiteralPath $BackupRoot)) {
    if ($PSCmdlet.ShouldProcess($BackupRoot, 'Criar diretorio de backup pre-restore')) { New-Item -ItemType Directory -Path $BackupRoot | Out-Null }
    else { return $null }
  }
  $preBackupPath = $null
  if ($existing.Count -gt 0) {
    $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
    $preBackupPath = Join-Path $BackupRoot ($DatabaseName + '-pre-restore-' + $stamp + '.bak')
    if ($PSCmdlet.ShouldProcess($preBackupPath, ("Backup previo do banco " + $DatabaseName))) {
      $pbq = $preBackupPath.Replace("'", "''")
      & $exec $SqlInstance ("BACKUP DATABASE " + $dbId + " TO DISK = N'" + $pbq + "' WITH INIT, CHECKSUM") $Credential | Out-Null
      & $exec $SqlInstance ("RESTORE VERIFYONLY FROM DISK = N'" + $pbq + "'") $Credential | Out-Null
    } else { return $null }
  }
  # Espaco livre minimo (heuristica: 3x o .bak)
  try {
    $need = (Get-Item -LiteralPath $BackupPath).Length * 3
    $free = Get-Mu99DestinationFreeBytes -Path $BackupRoot
    if (($free -gt 0) -and ($need -gt $free)) {
      $driveRoot = [System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($BackupRoot))
      throw ("Espaco insuficiente para restauracao em " + $driveRoot)
    }
  } catch { if ($_.Exception.Message -match 'Espaco insuficiente') { throw } }
  if ($PSCmdlet.ShouldProcess($DatabaseName, ("Restaurar DB\MuOnline.bak sobre " + $DatabaseName + ' (instancia ' + $SqlInstance + ')'))) {
    $bq = $BackupPath.Replace("'", "''")
    & $exec $SqlInstance ("RESTORE DATABASE " + $dbId + " FROM DISK = N'" + $bq + "' WITH REPLACE, RECOVERY") $Credential | Out-Null
  } else { return $null }
  return [pscustomobject]@{
    database = $DatabaseName
    instance = $SqlInstance
    backupUsed = $BackupPath
    preRestoreBackup = $preBackupPath
  }
}

# =============================================================
# Inicializacao e firewall (Task 6)
# =============================================================

$script:Mu99ProcessStarter = $null
$script:Mu99FirewallLister = $null
$script:Mu99FirewallCreator = $null
$script:Mu99FirewallRemover = $null
$script:Mu99ForceAdmin = $null

function Test-Mu99IsElevated {
  [CmdletBinding()]
  param()
  if ($null -ne $script:Mu99ForceAdmin) { return [bool]$script:Mu99ForceAdmin }
  try {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $pr = New-Object Security.Principal.WindowsPrincipal($id)
    return $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch { return $false }
}

function Get-Mu99ProcessStarter {
  if ($script:Mu99ProcessStarter) { return $script:Mu99ProcessStarter }
  return {
    param([string]$ExePath, [string]$WorkingDirectory)
    $p = Start-Process -FilePath $ExePath -WorkingDirectory $WorkingDirectory -PassThru
    return [pscustomobject]@{ Id = $p.Id; StartTime = (Get-Date) }
  }
}

function Start-Mu99Components {
  [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
  param(
    [Parameter(Mandatory = $true)][string]$ComponentManifestPath,
    [string]$ServerRoot = '',
    [switch]$AcceptUnsignedBinaries,
    [scriptblock]$ProcessStarter = $null
  )
  if (-not (Test-Path -LiteralPath $ComponentManifestPath)) { throw ("Manifesto nao encontrado: " + $ComponentManifestPath) }
  $json = [System.IO.File]::ReadAllText($ComponentManifestPath)
  $manifest = $json | ConvertFrom-Json
  if (-not $manifest.components -or $manifest.components.Count -eq 0) { throw 'Manifesto sem componentes; preencha path/workingDirectory/order e revise antes de iniciar.' }
  $orders = @()
  foreach ($c in $manifest.components) {
    if ([string]::IsNullOrWhiteSpace($c.name)) { throw 'Componente sem name; manifesto nao confirmado.' }
    if ([string]::IsNullOrWhiteSpace($c.path)) { throw ("Componente sem path: " + $c.name) }
    if ([string]::IsNullOrWhiteSpace($c.workingDirectory)) { throw ("Componente sem workingDirectory: " + $c.name) }
    if ($null -eq $c.order) { throw ("Componente sem order confirmada: " + $c.name + '; preencha a ordem a partir da documentacao da release.') }
    try { $ord = [int]$c.order } catch { throw ("order invalida em " + $c.name) }
    $orders += $ord
    $exeFull = $c.path
    if (-not [System.IO.Path]::IsPathRooted($exeFull)) {
      if ([string]::IsNullOrWhiteSpace($ServerRoot)) { throw ("path relativo exige -ServerRoot/DestinationRoot: " + $c.path) }
      $exeFull = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($ServerRoot, $exeFull))
    }
    $rootForCheck = $ServerRoot
    if ([string]::IsNullOrWhiteSpace($rootForCheck)) { $rootForCheck = [System.IO.Path]::GetDirectoryName($ComponentManifestPath) }
    if (-not (Test-Mu99PathWithinRoot -Root $rootForCheck -Candidate $exeFull)) {
      throw ("Componente fora da raiz do servidor (recusado): " + $c.path)
    }
    if (-not (Test-Path -LiteralPath $exeFull)) { throw ("Executavel nao encontrado: " + $exeFull) }
    if ($exeFull -match '(?i)\.(bat|cmd|ps1)$') { throw ("Tipo de arquivo nao permitido para inicio automatico: " + $exeFull) }
    if ($exeFull -match '(?i)startup\.exe$') { throw ("StartUp.exe nao e iniciado automaticamente; inicie componentes confirmados individualmente.") }
    try {
      $sig = Get-AuthenticodeSignature -LiteralPath $exeFull -ErrorAction SilentlyContinue
      $signed = ($sig -and ($sig.Status -eq 'Valid'))
    } catch { $signed = $false }
    if ((-not $signed) -and (-not $AcceptUnsignedBinaries) -and (-not $AcceptUnsignedBinaries.IsPresent)) {
      throw ("Binario sem assinatura valida exige -AcceptUnsignedBinaries explicito: " + $exeFull)
    }
  }
  $sorted = @($manifest.components | Sort-Object order)
  $starter = $ProcessStarter
  if (-not $starter) { $starter = Get-Mu99ProcessStarter }
  $results = @()
  foreach ($c in $sorted) {
    $exeFull = $c.path
    if (-not [System.IO.Path]::IsPathRooted($exeFull)) { $exeFull = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($ServerRoot, $exeFull)) }
    $wd = $c.workingDirectory
    if (-not [System.IO.Path]::IsPathRooted($wd)) {
      if ($ServerRoot) { $wd = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($ServerRoot, $wd)) }
      else { $wd = [System.IO.Path]::GetDirectoryName($exeFull) }
    }
    if ($PSCmdlet.ShouldProcess($exeFull, ("Iniciar componente " + $c.name + ' (ordem ' + $c.order + ')'))) {
      $r = & $starter $exeFull $wd
      $results += [pscustomobject]@{ name = $c.name; path = $exeFull; pid = $r.Id; startedAt = $r.StartTime.ToString('o'); workingDirectory = $wd }
    }
  }
  return $results
}

$script:Mu99ListenerAdapter = $null
$script:Mu99ServiceAdapter = $null

function Get-Mu99ObservedAdminPorts {
  <#
  .SYNOPSIS
    Deteccao somente leitura de portas administrativas: conhecidas (SQL/RDP),
    derivadas de servicos observados e listeners locais com processo dono.
    Nunca altera firewall. Adaptadores injetaveis para testes.
    listenersVerified/servicesVerified indicam se a coleta foi possivel;
    quando falso, os modos de firewall bloqueiam (fail-closed).
  #>
  [CmdletBinding()]
  param(
    [scriptblock]$ListenerAdapter = $null,
    [scriptblock]$ServiceAdapter = $null
  )
  $wellKnown = @(1433, 1434, 3389)
  $servicePorts = @()
  $serviceNames = @()
  $servicesVerified = $false
  $svcEnum = $ServiceAdapter
  if (-not $svcEnum) { $svcEnum = $script:Mu99ServiceAdapter }
  if (-not $svcEnum) {
    $svcEnum = {
      if (-not (Get-Command Get-Service -ErrorAction SilentlyContinue)) { throw 'Get-Service indisponivel nesta maquina.' }
      $found = @()
      $svcs = Get-Service -ErrorAction Stop | Where-Object { $_.Name -like 'MSSQL*' -or $_.DisplayName -like '*SQL Server*' -or $_.Name -eq 'TermService' }
      foreach ($s in $svcs) { $found += [pscustomobject]@{ name = $s.Name; displayName = $s.DisplayName; status = $s.Status.ToString() } }
      return $found
    }.GetNewClosure()
  }
  $observedServices = @()
  try { $observedServices = @(& $svcEnum); $servicesVerified = $true } catch { $observedServices = @(); $servicesVerified = $false }
  foreach ($s in $observedServices) {
    $nm = ''
    try { $nm = [string]$s.name } catch {}
    if ([string]::IsNullOrWhiteSpace($nm)) { continue }
    if ($serviceNames -notcontains $nm) { $serviceNames += $nm }
    $extra = @()
    try { if ($null -ne $s.ports) { $extra = @($s.ports) } } catch {}
    if ($nm -like 'MSSQL*' -or $nm -like '*SQL*') { $extra += @(1433, 1434) }
    if (($nm -eq 'TermService') -or ($nm -like '*RDP*' ) -or ($nm -like '*RemoteDesktop*')) { $extra += @(3389) }
    foreach ($p in $extra) {
      $pi = 0
      try { $pi = [int]$p } catch { continue }
      if (($pi -gt 0) -and ($pi -le 65535) -and ($servicePorts -notcontains $pi)) { $servicePorts += $pi }
    }
  }
  $lstEnum = $ListenerAdapter
  if (-not $lstEnum) { $lstEnum = $script:Mu99ListenerAdapter }
  if (-not $lstEnum) {
    $lstEnum = {
      if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) { throw 'Get-NetTCPConnection indisponivel nesta maquina.' }
      $rows = @()
      $conns = Get-NetTCPConnection -State Listen -ErrorAction Stop
      foreach ($c in $conns) {
        $proc = ''
        try {
          $pr = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
          if ($pr) { $proc = $pr.ProcessName }
        } catch {}
        $rows += [pscustomobject]@{ port = [int]$c.LocalPort; process = $proc }
      }
      return $rows
    }.GetNewClosure()
  }
  $listeners = @()
  $listenersVerified = $false
  $testListenersJson = [System.Environment]::GetEnvironmentVariable('MU99_TEST_LISTENERS_JSON')
  if (-not [string]::IsNullOrWhiteSpace($testListenersJson)) {
    # TEST-ONLY seam (documentado): substitui a enumeracao real por linhas
    # explicitas, para atravessar fronteiras de escopo/processo (& dispatch)
    # nos testes. Producao nunca define esta variavel.
    try {
      $parsed = ($testListenersJson | ConvertFrom-Json)
      $listeners = @($parsed)
      $listenersVerified = $true
    } catch { $listeners = @(); $listenersVerified = $false }
  } else {
    try { $listeners = @(& $lstEnum); $listenersVerified = $true } catch { $listeners = @(); $listenersVerified = $false }
  }
  $cleanListeners = @()
  foreach ($l in $listeners) {
    try {
      $pi = [int]$l.port
      if (($pi -le 0) -or ($pi -gt 65535)) { continue }
      $pn = ''
      try { $pn = [string]$l.process } catch {}
      $cleanListeners += [pscustomobject]@{ port = $pi; process = $pn }
    } catch {}
  }
  if (-not [string]::IsNullOrWhiteSpace([System.Environment]::GetEnvironmentVariable('MU99_TEST_FORCE_SERVICES_UNVERIFIED'))) { $servicesVerified = $false }
  # Listeners em portas administrativas ou pertencentes a processos de
  # sistema/administracao entram no conjunto de colisao. Listeners de
  # processos comuns (ex.: os proprios componentes MU ja iniciados) ficam
  # apenas registrados para revisao do operador, sem bloquear.
  # Listeners SEM dono identificavel sao rastreados a parte: se ocuparem uma
  # porta aprovada, os modos recusam (fail-closed), pois nao ha como provar
  # que nao sao servico administrativo (ex.: Get-Process negado sem elevacao).
  $adminProcPattern = '(?i)(^sqlservr$|^sqlagent|^ssms$|^svchost$|^system$|^services$|^lsass$|^wininit$|^msdtc$|^termservice$|^mstsc$|^rdpclip$|sql)'
  $adminListenerPorts = @()
  foreach ($l in $cleanListeners) {
    $onAdminPort = (($wellKnown -contains $l.port) -or ($servicePorts -contains $l.port))
    $adminProc = ((-not [string]::IsNullOrWhiteSpace($l.process)) -and ($l.process -match $adminProcPattern))
    if ($onAdminPort -or $adminProc) {
      if ($adminListenerPorts -notcontains $l.port) { $adminListenerPorts += $l.port }
    }
  }
  # TEST-ONLY seam (documentado): permite a regressao injetar portas
  # administrativas e forcar o estado nao-verificado atraves de fronteiras
  # de escopo/processo (o dispatch via & nao enxerga $script:). Producao
  # nunca define estas variaveis. Ambas as direcoes sao fail-closed: so
  # restringem (unem portas) ou bloqueiam (forca nao-verificado).
  try {
    $envExtra = [System.Environment]::GetEnvironmentVariable('MU99_TEST_EXTRA_ADMIN_PORTS')
    if (-not [string]::IsNullOrWhiteSpace($envExtra)) {
      $addedTestPort = $false
      foreach ($tok in ($envExtra -split ',')) {
        $pi = 0
        if ([int]::TryParse($tok.Trim(), [ref]$pi) -and ($pi -gt 0) -and ($pi -le 65535) -and ($servicePorts -notcontains $pi)) {
          $servicePorts += $pi
          $addedTestPort = $true
        }
      }
      if ($addedTestPort -and ($serviceNames -notcontains 'test-override(MU99_TEST_EXTRA_ADMIN_PORTS)')) {
        $serviceNames += 'test-override(MU99_TEST_EXTRA_ADMIN_PORTS)'
      }
    }
  } catch {}
  if (-not [string]::IsNullOrWhiteSpace([System.Environment]::GetEnvironmentVariable('MU99_TEST_FORCE_LISTENERS_UNVERIFIED'))) { $listenersVerified = $false }
  $admin = @()
  foreach ($p in ($wellKnown + $servicePorts)) { if ($admin -notcontains $p) { $admin += $p } }
  $admin = @($admin | Sort-Object)
  $unknownOwnerPorts = @()
  foreach ($l in $cleanListeners) {
    if ([string]::IsNullOrWhiteSpace($l.process) -and ($unknownOwnerPorts -notcontains $l.port)) {
      $unknownOwnerPorts += $l.port
    }
  }
  $unknownOwnerPorts = @($unknownOwnerPorts | Sort-Object)
  $identityVerified = $true
  foreach ($l in $cleanListeners) {
    if ([string]::IsNullOrWhiteSpace($l.process)) { $identityVerified = $false; break }
  }
  $collision = @()
  foreach ($p in ($admin + $adminListenerPorts + $unknownOwnerPorts)) { if ($collision -notcontains $p) { $collision += $p } }
  $collision = @($collision | Sort-Object)
  return [pscustomobject]@{
    wellKnownPorts = $wellKnown
    servicePorts = @($servicePorts | Sort-Object)
    serviceNames = $serviceNames
    servicesVerified = $servicesVerified
    listeners = $cleanListeners
    listenersVerified = $listenersVerified
    listenersIdentityVerified = $identityVerified
    unknownOwnerPorts = $unknownOwnerPorts
    adminListenerPorts = @($adminListenerPorts | Sort-Object)
    adminPorts = $admin
    collisionPorts = $collision
  }
}

function Get-Mu99FirewallPlan {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][int[]]$ApprovedGamePorts,
    [string[]]$ApprovedProtocols = @('TCP'),
    [int[]]$DetectedAdminPorts = @()
  )
  if ($null -eq $ApprovedGamePorts -or $ApprovedGamePorts.Count -eq 0) { throw 'Nenhuma porta aprovada; plano vazio recusado.' }
  $blocked = @(1433,1434,3389)
  $protos = @($ApprovedProtocols)
  if ($protos.Count -eq 0) { $protos = @('TCP') }
  foreach ($pr in $protos) { if ($pr -notin @('TCP','UDP')) { throw ("Protocolo nao suportado: " + $pr) } }
  $plan = @()
  foreach ($p in $ApprovedGamePorts) {
    if ($p -le 0 -or $p -gt 65535) { throw ("Porta invalida: " + $p) }
    if ($blocked -contains $p) { throw ("Porta administrativa proibida (SQL/RDP): " + $p) }
    if ($DetectedAdminPorts -contains $p) { throw ("Porta detectada como administrativa (recusada): " + $p) }
    foreach ($pr in $protos) {
      $plan += [pscustomobject]@{
        name = ("MU99-Pilot-" + $pr + "-" + $p)
        port = $p
        protocol = $pr
        direction = 'Inbound'
        action = 'Allow'
        description = 'MU99 piloto: porta de jogo aprovada pelo operador'
      }
    }
  }
  return $plan
}

function Add-Mu99FirewallRules {
  [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
  param(
    [Parameter(Mandatory = $true)][object[]]$Plan,
    [Parameter(Mandatory = $true)][string]$DestinationRoot,
    [scriptblock]$FirewallCreator = $null
  )
  $isAdmin = Test-Mu99IsElevated
  if (-not $isAdmin) { throw 'AplicarFirewall exige PowerShell elevado (administrador). Nada foi alterado.' }
  foreach ($r in $Plan) {
    if ($r.port -in @(1433,1434,3389)) { throw ("Regra para porta proibida recusada: " + $r.port) }
    if ($r.name -notlike 'MU99-Pilot-*') { throw ("Nome de regra fora do padrao do script (recusado): " + $r.name) }
  }
  $creator = $FirewallCreator
  if (-not $creator) {
    if ($script:Mu99FirewallCreator) { $creator = $script:Mu99FirewallCreator }
    else {
      $creator = {
        param($Rule)
        New-NetFirewallRule -DisplayName $Rule.name -Name $Rule.name -Description $Rule.description -Direction Inbound -Action Allow -Protocol $Rule.protocol -LocalPort $Rule.port | Out-Null
        return $Rule.name
      }
    }
  }
  $stateDir = Join-Path $DestinationRoot 'state'
  if (-not (Test-Path -LiteralPath $stateDir)) {
    if ($PSCmdlet.ShouldProcess($stateDir, 'Criar diretorio de estado')) { New-Item -ItemType Directory -Path $stateDir | Out-Null }
    else { return @() }
  }
  $manifestPath = Join-Path $stateDir 'firewall-manifest.json'
  if (Test-Path -LiteralPath $manifestPath) { throw ("Manifesto de firewall ja existe; recusa de sobrescrita: " + $manifestPath) }
  $created = @()
  foreach ($r in $Plan) {
    if ($PSCmdlet.ShouldProcess($r.name, ("Criar regra de firewall " + $r.protocol + '/' + $r.port))) {
      $idOut = & $creator $r
      $created += [pscustomobject]@{ name = $r.name; port = $r.port; protocol = $r.protocol; id = $idOut }
    }
  }
  if ($PSCmdlet.ShouldProcess($manifestPath, 'Gravar manifesto de regras do script')) {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($manifestPath, ($created | ConvertTo-Json -Depth 5), $utf8)
  }
  return ($created | ForEach-Object { $_.name })
}

function Remove-Mu99FirewallRules {
  [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
  param(
    [Parameter(Mandatory = $true)][string]$DestinationRoot,
    [scriptblock]$FirewallRemover = $null,
    [scriptblock]$FirewallLister = $null
  )
  $isAdmin = Test-Mu99IsElevated
  if (-not $isAdmin) { throw 'ReverterFirewall exige PowerShell elevado (administrador). Nada foi alterado.' }
  $manifestPath = Join-Path (Join-Path $DestinationRoot 'state') 'firewall-manifest.json'
  if (-not (Test-Path -LiteralPath $manifestPath)) { throw ("Manifesto de firewall nao encontrado: " + $manifestPath) }
  $owned = ([System.IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json)
  $remover = $FirewallRemover
  if (-not $remover) {
    if ($script:Mu99FirewallRemover) { $remover = $script:Mu99FirewallRemover }
    else {
      $remover = {
        param($RuleName)
        Remove-NetFirewallRule -Name $RuleName -ErrorAction Stop
        return $RuleName
      }
    }
  }
  $removed = @()
  foreach ($o in $owned) {
    if ($o.name -notlike 'MU99-Pilot-*') { throw ("Entrada estranha no manifesto; reversao abortada (preserva regras alheias): " + $o.name) }
    if ($PSCmdlet.ShouldProcess($o.name, 'Remover regra criada pelo script')) {
      & $remover $o.name | Out-Null
      $removed += $o.name
    }
  }
  return $removed
}

function Resolve-Mu99ServerRoot {
  <#
  .SYNOPSIS
    Resolve a raiz do servidor: <DestinationRoot>\server quando o staging
    segregado existe; senao o proprio DestinationRoot (layouts planos).
  #>
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$DestinationRoot)
  $seg = Join-Path $DestinationRoot 'server'
  if (Test-Path -LiteralPath $seg) { return $seg }
  return $DestinationRoot
}

if ($ExportFunctionsOnly) { return }

# =============================================================
# Dispatch
# =============================================================

Assert-Mu99ModeRequirements -ModeName $Mode

switch ($Mode) {
  'Diagnostico' {
    $out = Invoke-Mu99Diagnostic -PackageZipPath $PackageZipPath -DestinationRoot $DestinationRoot -ArchiveToolPath $ArchiveToolPath
    Write-Output ("Diagnostico concluido. Relatorio: " + $out)
  }
  'PrepararArquivos' {
    if ($PSCmdlet.ShouldProcess($DestinationRoot, ("PrepararArquivos a partir de " + $PackageZipPath))) {
      $r = Invoke-Mu99StagePackage -PackageZipPath $PackageZipPath -DestinationRoot $DestinationRoot -ArchiveToolPath $ArchiveToolPath
      $repDir = Join-Path $DestinationRoot 'reports'
      if (-not (Test-Path -LiteralPath $repDir)) { New-Item -ItemType Directory -Path $repDir | Out-Null }
      $rp = Join-Path $repDir ("stage-" + (Get-Date).ToString('yyyyMMdd-HHmmss') + ".json")
      Write-Mu99Report -Path $rp -Report $r
      Write-Output ("Staging concluido: " + $r.stagingRoot + " (" + $r.fileCount + " arquivos). Relatorio: " + $rp)
    }
  }
  'ValidarDependencias' {
    $rep = Get-Mu99DependencyReport -ServerRoot (Resolve-Mu99ServerRoot -DestinationRoot $DestinationRoot)
    $repDir = Join-Path $DestinationRoot 'reports'
    if (-not (Test-Path -LiteralPath $repDir)) {
      if ($PSCmdlet.ShouldProcess($repDir, 'Criar diretorio de relatorios')) { New-Item -ItemType Directory -Path $repDir | Out-Null }
    }
    $rp = Join-Path $repDir ("dependencias-" + (Get-Date).ToString('yyyyMMdd-HHmmss') + ".json")
    Write-Mu99Report -Path $rp -Report $rep
    Write-Output ("Dependencias validadas (nada instalado). Relatorio: " + $rp)
  }
  'Configurar' {
    $serverRoot = Resolve-Mu99ServerRoot -DestinationRoot $DestinationRoot
    $clientRoot = ''
    $prop = Get-Mu99ConfigProposal -ServerRoot $serverRoot -ClientRoot $clientRoot -ServerAddress $ServerAddress
    if ($prop.blockers.Count -gt 0) {
      $repDir = Join-Path $DestinationRoot 'reports'
      if (-not (Test-Path -LiteralPath $repDir)) { New-Item -ItemType Directory -Path $repDir | Out-Null }
      Write-Mu99Report -Path (Join-Path $repDir ("config-bloqueado-" + (Get-Date).ToString('yyyyMMdd-HHmmss') + ".json")) -Report $prop
      throw ("Configurar bloqueado: " + ($prop.blockers -join ' | '))
    }
    Write-Output 'Proposta de configuracao:'
    $prop.changes | Format-Table file, key, before, after -AutoSize | Out-String | Write-Output
    $backs = Set-Mu99AddressConfiguration -Proposal $prop -DestinationRoot $DestinationRoot
    Write-Output ("Configuracao aplicada. Backups: " + ($backs -join '; '))
  }
  'Banco' {
    $serverDir = Resolve-Mu99ServerRoot -DestinationRoot $DestinationRoot
    $candidates = @(
      (Join-Path $serverDir 'DB\MuOnline.bak'),
      (Join-Path $DestinationRoot 'staging\DB\MuOnline.bak'),
      (Join-Path $DestinationRoot 'DB\MuOnline.bak')
    )
    $bak = ''
    foreach ($cand in $candidates) { if (Test-Path -LiteralPath $cand) { $bak = $cand; break } }
    if ([string]::IsNullOrWhiteSpace($bak)) { throw ("DB\MuOnline.bak nao localizado sob " + $DestinationRoot + " (esperado server\DB\MuOnline.bak, staging\DB\MuOnline.bak ou DB\MuOnline.bak). Rode PrepararArquivos antes.") }
    $cred = $null
    try { $chk = Test-Mu99SqlInstance -SqlInstance $SqlInstance }
    catch {
      if ($_.Exception.Message -match 'Falha de conexao') { $cred = Get-Mu99SqlCredential }
      else { throw }
    }
    $backupRoot = Join-Path $DestinationRoot 'backups'
    $res = Invoke-Mu99DatabaseRestore -BackupPath $bak -SqlInstance $SqlInstance -DatabaseName $DatabaseName -BackupRoot $backupRoot -ConfirmDatabaseOverwrite:$ConfirmDatabaseOverwrite -Credential $cred
    Write-Output ("Banco restaurado: " + $res.database + " @ " + $res.instance)
  }
  'PrepararCliente' {
    $clientDir = Join-Path $DestinationRoot 'client'
    if (Test-Path -LiteralPath $clientDir) {
      throw ("Pasta client/ ja existe; recusa de sobrescrita/mesclagem (original preservado): " + $clientDir)
    }
    $blobs = @(Get-ChildItem -LiteralPath $DestinationRoot -Recurse -Filter *.rar -File -ErrorAction SilentlyContinue | Where-Object { ($_.Name -like '*Client*') -and ($_.Name -like '*99b*') })
    if (@($blobs).Count -eq 0) { throw ("RAR do cliente nao localizado no staging; rode PrepararArquivos antes: " + $DestinationRoot) }
    if (@($blobs).Count -gt 1) { throw ("Multiplos RARs de cliente no staging; ambiguo, expansao bloqueada.") }
    $exp = Expand-Mu99NestedArchive -RarPath @($blobs)[0].FullName -DestinationDir $clientDir -ArchiveToolPath $ArchiveToolPath
    if ($null -eq $exp) { throw 'Expansao do cliente cancelada pelo operador; nada foi alterado.' }
    $serverRoot = Resolve-Mu99ServerRoot -DestinationRoot $DestinationRoot
    $prop = Get-Mu99ConfigProposal -ServerRoot $serverRoot -ClientRoot $clientDir -ServerAddress $ServerAddress
    $clientChanges = @($prop.changes | Where-Object { $_.file -like '*Config.ini' })
    if ($clientChanges.Count -eq 0) { throw ("PrepararCliente bloqueado: " + ($prop.blockers -join ' | ')) }
    $onlyClient = [pscustomobject]@{ serverAddress = $prop.serverAddress; changes = $clientChanges; blockers = @() }
    $backs = Set-Mu99AddressConfiguration -Proposal $onlyClient -DestinationRoot $DestinationRoot
    Write-Output ("Cliente preparado em staging (original preservado). Backups: " + ($backs -join '; '))
  }
  'Iniciar' {
    $res = Start-Mu99Components -ComponentManifestPath $ComponentManifestPath -ServerRoot $DestinationRoot -AcceptUnsignedBinaries:$AcceptUnsignedBinaries
    $res | Format-Table name, path, pid, startedAt -AutoSize | Out-String | Write-Output
  }
  'PlanoFirewall' {
    $protos = $ApprovedProtocols
    if (-not $protos -or $protos.Count -eq 0) { $protos = @('TCP') }
    $observed = Get-Mu99ObservedAdminPorts
    if (-not $observed.servicesVerified) {
      throw 'Servicos locais nao puderam ser verificados; plano de firewall bloqueado ate verificacao manual. Nada foi alterado.'
    }
    if (-not $observed.listenersVerified) {
      throw 'Listeners locais nao puderam ser verificados; plano de firewall bloqueado ate verificacao manual. Nada foi alterado.'
    }
    $unknownCollisions = @($ApprovedGamePorts | Where-Object { $observed.unknownOwnerPorts -contains $_ })
    if (@($unknownCollisions).Count -gt 0) {
      throw ("Porta(s) aprovada(s) ocupada(s) por processo desconhecido (dono nao identificavel: " + (@($unknownCollisions) -join ', ') + "); abrir seria inseguro. Pare o ocupante ou revise a aprovacao. Nada foi alterado.")
    }
    $collisions = @($ApprovedGamePorts | Where-Object { $observed.collisionPorts -contains $_ })
    if (@($collisions).Count -gt 0) {
      throw ("Porta(s) aprovada(s) colidem com porta(s) administrativa(s) observada(s) (" + (@($collisions) -join ', ') + "); revise a aprovacao. Nada foi alterado.")
    }
    $plan = Get-Mu99FirewallPlan -ApprovedGamePorts $ApprovedGamePorts -ApprovedProtocols $protos -DetectedAdminPorts $observed.collisionPorts
    $repDir = Join-Path $DestinationRoot 'reports'
    if ($DestinationRoot -and (-not (Test-Path -LiteralPath $repDir))) {
      if ($PSCmdlet.ShouldProcess($repDir, 'Criar diretorio de relatorios')) { New-Item -ItemType Directory -Path $repDir | Out-Null }
    }
    if ($DestinationRoot) {
      Write-Mu99Report -Path (Join-Path $repDir ("firewall-plano-" + (Get-Date).ToString('yyyyMMdd-HHmmss') + ".json")) -Report ([pscustomobject]@{ plan = $plan; observedAdminPorts = $observed })
    }
    Write-Output 'Plano de firewall (somente leitura; nada aplicado):'
    $plan | Format-Table name, protocol, port -AutoSize | Out-String | Write-Output
  }
  'AplicarFirewall' {
    $protos = $ApprovedProtocols
    if (-not $protos -or $protos.Count -eq 0) { $protos = @('TCP') }
    $observed = Get-Mu99ObservedAdminPorts
    if (-not $observed.servicesVerified) {
      throw 'Servicos locais nao puderam ser verificados; aplicacao de firewall bloqueada ate verificacao manual. Nada foi alterado.'
    }
    if (-not $observed.listenersVerified) {
      throw 'Listeners locais nao puderam ser verificados; aplicacao de firewall bloqueada ate verificacao manual. Nada foi alterado.'
    }
    $unknownCollisions = @($ApprovedGamePorts | Where-Object { $observed.unknownOwnerPorts -contains $_ })
    if (@($unknownCollisions).Count -gt 0) {
      throw ("Porta(s) aprovada(s) ocupada(s) por processo desconhecido (dono nao identificavel: " + (@($unknownCollisions) -join ', ') + "); abrir seria inseguro. Pare o ocupante ou revise a aprovacao. Nada foi alterado.")
    }
    $collisions = @($ApprovedGamePorts | Where-Object { $observed.collisionPorts -contains $_ })
    if (@($collisions).Count -gt 0) {
      throw ("Porta(s) aprovada(s) colidem com porta(s) administrativa(s) observada(s) (" + (@($collisions) -join ', ') + "); revise a aprovacao. Nada foi alterado.")
    }
    $plan = Get-Mu99FirewallPlan -ApprovedGamePorts $ApprovedGamePorts -ApprovedProtocols $protos -DetectedAdminPorts $observed.collisionPorts
    $names = Add-Mu99FirewallRules -Plan $plan -DestinationRoot $DestinationRoot
    Write-Output ("Regras criadas: " + ($names -join ', '))
  }
  'ReverterFirewall' {
    $names = Remove-Mu99FirewallRules -DestinationRoot $DestinationRoot
    Write-Output ("Regras removidas: " + ($names -join ', '))
  }
}
