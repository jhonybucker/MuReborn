$ErrorActionPreference = 'Stop'
# Harness nao interativo: nunca pedir confirmacao; ShouldProcess retorna $true
# (operadores manuais continuam recebendo prompts de ConfirmImpact=High).
$ConfirmPreference = 'None'
$script:Mu99PassCount = 0
$script:Mu99FailCount = 0
$script:Mu99Failures = @()

function Write-Mu99TestResult {
  param([string]$Name, [bool]$Passed, [string]$Detail = '')
  if ($Passed) {
    $script:Mu99PassCount++
    Write-Output ("PASS: " + $Name)
  } else {
    $script:Mu99FailCount++
    $script:Mu99Failures += $Name
    Write-Output ("FAIL: " + $Name + $(if ($Detail) { ' -- ' + $Detail } else { '' }))
  }
}

function Assert-Mu99True {
  param([bool]$Condition, [string]$Name, [string]$Detail = '')
  Write-Mu99TestResult -Name $Name -Passed ([bool]$Condition) -Detail $Detail
}

function Assert-Mu99Equal {
  param($Expected, $Actual, [string]$Name)
  $ok = ($Expected -eq $Actual)
  $detail = ''
  if (-not $ok) { $detail = ("expected=<" + $Expected + "> actual=<" + $Actual + ">") }
  Write-Mu99TestResult -Name $Name -Passed $ok -Detail $detail
}

function New-Mu99TempDir {
  $base = [System.IO.Path]::GetTempPath()
  $dir = Join-Path $base ('mu99-test-' + [System.Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $dir | Out-Null
  return $dir
}

function Remove-Mu99TempDir {
  param([string]$Dir)
  if ($Dir -and (Test-Path -LiteralPath $Dir)) {
    Remove-Item -LiteralPath $Dir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# Dot-source no escopo do script (nao dentro de funcao) para exportar funcoes.
$Mu99ScriptPath = Join-Path $PSScriptRoot '..\Install-MU99-Safe.ps1'

function Get-Mu99ScriptPath {
  return $Mu99ScriptPath
}

# ---------------------------------------------------------------
# Task 1: safety core
# ---------------------------------------------------------------
try {
  if (-not (Test-Path -LiteralPath $Mu99ScriptPath)) { throw ("Script nao encontrado: " + $Mu99ScriptPath) }
  . $Mu99ScriptPath -ExportFunctionsOnly
} catch {
  Write-Mu99TestResult -Name 'Task1: script carrega em modo ExportFunctionsOnly' -Passed $false -Detail $_.Exception.Message
  Write-Output ("TOTAL PASS=" + $script:Mu99PassCount + " FAIL=" + $script:Mu99FailCount)
  exit 1
}
Write-Mu99TestResult -Name 'Task1: script carrega em modo ExportFunctionsOnly' -Passed $true

# Test-Mu99PathWithinRoot
try {
  $root = Join-Path ([System.IO.Path]::GetTempPath()) ('mu99-root-' + [System.Guid]::NewGuid().ToString('N'))
  $child = Join-Path $root 'sub\file.txt'
  $okChild = Test-Mu99PathWithinRoot -Root $root -Candidate $child
  Assert-Mu99True -Condition $okChild -Name 'Task1: caminho filho dentro da raiz e aceito'
  $traversal = Join-Path $root '..\outside.txt'
  $okTrav = Test-Mu99PathWithinRoot -Root $root -Candidate $traversal
  Assert-Mu99True -Condition (-not $okTrav) -Name 'Task1: traversal com .. e rejeitado'
  $other = 'C:\Windows\System32\drivers\etc\hosts'
  if ($root.StartsWith('C:\', [System.StringComparison]::OrdinalIgnoreCase)) {
    $okOther = Test-Mu99PathWithinRoot -Root $root -Candidate $other
    Assert-Mu99True -Condition (-not $okOther) -Name 'Task1: caminho de outra raiz e rejeitado'
  } else {
    Write-Mu99TestResult -Name 'Task1: caminho de outra raiz e rejeitado (skip, temp fora de C:)' -Passed $true
  }
} catch {
  Write-Mu99TestResult -Name 'Task1: Test-Mu99PathWithinRoot executa sem excecao' -Passed $false -Detail $_.Exception.Message
}

# ConvertTo-Mu99RedactedText
try {
  $plain = 'ServerName = Mu Devs'
  $r1 = ConvertTo-Mu99RedactedText -Text $plain
  Assert-Mu99Equal -Expected $plain -Actual $r1 -Name 'Task1: string normal permanece inalterada'
  $cases = @(
    'password=supersecret123',
    'Password = supersecret123',
    'pwd: hunter2value',
    'secret=abc123xyz',
    'token=tok_ABCDEF123',
    'credential=mycred99',
    'apiKey=AKIA-EXAMPLE-42',
    'Server=myhost;Password=supersecret123;User=sa'
  )
  foreach ($c in $cases) {
    $r = ConvertTo-Mu99RedactedText -Text $c
    $leaked = $false
    foreach ($s in @('supersecret123','hunter2value','abc123xyz','tok_ABCDEF123','mycred99','AKIA-EXAMPLE-42')) {
      if ($r -and $r.Contains($s)) { $leaked = $true }
    }
    $masked = ($r -and $r.Contains('***'))
    Assert-Mu99True -Condition ((-not $leaked) -and $masked) -Name ("Task1: redacao mascara valor em [" + $c + "]")
  }
} catch {
  Write-Mu99TestResult -Name 'Task1: ConvertTo-Mu99RedactedText executa sem excecao' -Passed $false -Detail $_.Exception.Message
}

# Mode gating + report redaction (Task 1 Step 4)
try {
  $scriptPath = Get-Mu99ScriptPath
  $tokens = $null; $errors = $null
  $ast = [System.Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$tokens, [ref]$errors)
  $paramBlock = $ast.ParamBlock
  $modeParam = $paramBlock.Parameters | Where-Object { $_.Name.VariablePath.UserPath -eq 'Mode' }
  $hasDefault = $false
  if ($modeParam -ne $null) {
    $d = "$($modeParam.DefaultValue.Extent.Text)"
    if ($d -match 'Diagnostico') { $hasDefault = $true }
  }
  Assert-Mu99True -Condition $hasDefault -Name 'Task1: omissao de -Mode seleciona Diagnostico (default)'
  $text = [System.IO.File]::ReadAllText($scriptPath)
  $hasValidateSet = ($text -match 'ValidateSet.*Diagnostico.*PrepararArquivos.*ValidarDependencias.*Configurar.*Banco.*PrepararCliente.*Iniciar.*PlanoFirewall.*AplicarFirewall.*ReverterFirewall')
  Assert-Mu99True -Condition $hasValidateSet -Name 'Task1: modo fora do ValidateSet e rejeitado (10 modos)'
} catch {
  Write-Mu99TestResult -Name 'Task1: inspecao do bloco de parametros' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $scriptPath = Get-Mu99ScriptPath
    $failed = $false
    $msg = ''
    try {
      & $scriptPath -Mode 'Configurar' -DestinationRoot $tmp 2>&1 | Out-String | ForEach-Object { $msg += $_ }
    } catch { $failed = $true; $msg += $_.Exception.Message }
    # Configurar sem ServerAddress deve falhar antes de qualquer mutacao
    Assert-Mu99True -Condition ($failed -or ($msg -match 'ServerAddress')) -Name 'Task1: modo mutavel sem alvo obrigatorio falha antes do dispatch'
    $created = @(Get-ChildItem -LiteralPath $tmp -ErrorAction SilentlyContinue)
    Assert-Mu99True -Condition ($created.Count -eq 0) -Name 'Task1: falha de gating nao cria arquivos no destino'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task1: gating de modo mutavel' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $fixture = Join-Path $tmp 'orig StopConditions.txt'
    # nome simples sem espaco para evitar complicacao
    $fixture = Join-Path $tmp 'original.txt'
    [System.IO.File]::WriteAllText($fixture, "line1`r`nline2`r`n", (New-Object System.Text.UTF8Encoding($false)))
    $before = (Get-FileHash -LiteralPath $fixture -Algorithm SHA256).Hash
    $reportPath = Join-Path $tmp 'relatorio.json'
    $report = [pscustomobject]@{ mode = 'Teste'; password = 'supersecret123'; note = 'ok' }
    Write-Mu99Report -Path $reportPath -Report $report
    $content = [System.IO.File]::ReadAllText($reportPath)
    Assert-Mu99True -Condition (($content -match '\*\*\*') -and (-not ($content.Contains('supersecret123')))) -Name 'Task1: relatorio contem valores mascarados'
    $after = (Get-FileHash -LiteralPath $fixture -Algorithm SHA256).Hash
    Assert-Mu99Equal -Expected $before -Actual $after -Name 'Task1: fixture pre-existente permanece byte-identica'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task1: redacao de relatorio e preservacao de fixture' -Passed $false -Detail $_.Exception.Message
}

# ---------------------------------------------------------------
# Task 2: diagnostico somente leitura
# ---------------------------------------------------------------
function New-Mu99SyntheticPackage {
  param([string]$ZipPath)
  Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }
  $fs = [System.IO.File]::Create($ZipPath)
  try {
    $ar = New-Object System.IO.Compression.ZipArchive($fs, ([System.IO.Compression.ZipArchiveMode]::Create))
    try {
      $defs = @(
        'MuDevs Free - Release II Files 99b/[MUDevs - Free Release 2] Files 99b.rar',
        'MuDevs Free - Release II Files 99b/[MUDevs - Free Release 2] Client 99b.rar',
        'MuDevs Free - Release II Files 99b/Librerias.rar',
        'MuDevs Free - Release II Files 99b/DB/MuOnline.bak',
        'MuDevs Free - Release II Files 99b/pic/sample.jpg'
      )
      foreach ($d in $defs) {
        $e = $ar.CreateEntry($d)
        $w = New-Object System.IO.StreamWriter($e.Open())
        try { $w.Write(('synthetic-content-for:' + $d)) } finally { $w.Dispose() }
      }
    } finally { $ar.Dispose() }
  } finally { $fs.Dispose() }
}

try {
  $snap = Get-Mu99EnvironmentSnapshot
  Assert-Mu99True -Condition ((-not [string]::IsNullOrWhiteSpace($snap.os)) -and (-not [string]::IsNullOrWhiteSpace($snap.powershellVersion))) -Name 'Task2: snapshot expoe OS/PowerShell'
  Assert-Mu99True -Condition ($null -ne $snap.volumes) -Name 'Task2: snapshot expoe volumes/disco'
  Assert-Mu99True -Condition ($null -ne $snap.sqlCandidates) -Name 'Task2: snapshot expoe candidatos SQL'
  Assert-Mu99True -Condition ($null -ne $snap.archiveTools) -Name 'Task2: snapshot expoe ferramentas de arquivo'
} catch {
  Write-Mu99TestResult -Name 'Task2: Get-Mu99EnvironmentSnapshot' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $pkg = Join-Path $tmp 'pacote-sintetico.zip'
    New-Mu99SyntheticPackage -ZipPath $pkg
    $beforePkg = (Get-FileHash -LiteralPath $pkg -Algorithm SHA256).Hash
    $out = New-Mu99TempDir
    try {
      $inv = Get-Mu99PackageInventory -PackageZipPath $pkg
      Assert-Mu99True -Condition ($inv.hasServerRar -and $inv.hasClientRar -and $inv.hasLibrariesRar) -Name 'Task2: inventario identifica os tres RARs aninhados'
      Assert-Mu99True -Condition ($inv.hasMuOnlineBak) -Name 'Task2: inventario identifica DB MuOnline.bak'
      Assert-Mu99True -Condition (($inv.sha256 -match '^[0-9a-f]{64}$')) -Name 'Task2: inventario expoe SHA-256'
      Assert-Mu99True -Condition (($inv.executableSignature -eq 'pending-until-staging')) -Name 'Task2: assinatura de executavel pendente ate o staging'
      $rep = Invoke-Mu99Diagnostic -PackageZipPath $pkg -DestinationRoot $out
      Assert-Mu99True -Condition (Test-Path -LiteralPath $rep) -Name 'Task2: diagnostico gera novo relatorio'
      $content = [System.IO.File]::ReadAllText($rep)
      Assert-Mu99True -Condition (($content -match 'sha256') -and ($content -match 'blockers')) -Name 'Task2: relatorio contem hash e bloqueios'
      Assert-Mu99True -Condition (-not ($content.Contains('synthetic-secret-zzz'))) -Name 'Task2: relatorio nao vaza segredos'
      $afterPkg = (Get-FileHash -LiteralPath $pkg -Algorithm SHA256).Hash
      Assert-Mu99Equal -Expected $beforePkg -Actual $afterPkg -Name 'Task2: pacote fixture permanece inalterado (somente leitura)'
    } finally { Remove-Mu99TempDir -Dir $out }
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task2: inventario + diagnostico sintetico' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $out = Join-Path $tmp 'out'
    New-Item -ItemType Directory -Path $out | Out-Null
    $prior = Join-Path $out 'reports' | Join-Path -ChildPath 'x'
    # diagnostico com pacote ausente deve gerar relatorio de falha sem extrair e sem sobrescrever relatorio previo
    $first = Invoke-Mu99Diagnostic -PackageZipPath (Join-Path $tmp 'nao-existe.zip') -DestinationRoot $out
    Assert-Mu99True -Condition (Test-Path -LiteralPath $first) -Name 'Task2: pacote ausente gera relatorio de falha'
    $c1 = [System.IO.File]::ReadAllText($first)
    Assert-Mu99True -Condition (($c1 -match 'packageError') -and ($c1 -match 'nao-existe')) -Name 'Task2: relatorio de falha menciona o erro'
    $h1 = (Get-FileHash -LiteralPath $first -Algorithm SHA256).Hash
    Start-Sleep -Seconds 2
    $second = Invoke-Mu99Diagnostic -PackageZipPath (Join-Path $tmp 'nao-existe.zip') -DestinationRoot $out
    Assert-Mu99True -Condition ($second -ne $first) -Name 'Task2: segundo relatorio nao sobrescreve o anterior'
    $h1b = (Get-FileHash -LiteralPath $first -Algorithm SHA256).Hash
    Assert-Mu99Equal -Expected $h1 -Actual $h1b -Name 'Task2: relatorio previo preservado'
    # ZIP corrompido
    $bad = Join-Path $tmp 'corrompido.zip'
    [System.IO.File]::WriteAllBytes($bad, (0..255 | ForEach-Object { [byte]($_ % 256) }))
    $threw = $false
    try { Get-Mu99PackageInventory -PackageZipPath $bad | Out-Null } catch { $threw = $true }
    Assert-Mu99True -Condition $threw -Name 'Task2: ZIP corrompido falha no inventario'
    $badRep = Invoke-Mu99Diagnostic -PackageZipPath $bad -DestinationRoot $out
    Assert-Mu99True -Condition (Test-Path -LiteralPath $badRep) -Name 'Task2: ZIP corrompido gera relatorio de falha sem extracao'
    $noStage = @(Get-ChildItem -LiteralPath $out -Recurse -Filter *.rar -File -ErrorAction SilentlyContinue)
    Assert-Mu99True -Condition ($noStage.Count -eq 0) -Name 'Task2: falha nao extrai nada'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task2: casos pacote ausente/corrompido' -Passed $false -Detail $_.Exception.Message
}

# ---------------------------------------------------------------
# Task 3: staging seguro
# ---------------------------------------------------------------
try {
  $tmp = New-Mu99TempDir
  try {
    $root = Join-Path $tmp 'stage'
    Assert-Mu99True -Condition (Test-Mu99ArchiveEntryPath -Root $root -EntryName 'server/ConnectServer/ServerList.dat') -Name 'Task3: entrada relativa normal e aceita'
    Assert-Mu99True -Condition (-not (Test-Mu99ArchiveEntryPath -Root $root -EntryName '..\outside.txt')) -Name 'Task3: traversal .. e rejeitado'
    Assert-Mu99True -Condition (-not (Test-Mu99ArchiveEntryPath -Root $root -EntryName 'C:\Windows\Temp\evil.txt')) -Name 'Task3: caminho absoluto (drive) e rejeitado'
    Assert-Mu99True -Condition (-not (Test-Mu99ArchiveEntryPath -Root $root -EntryName '\\server\share\evil.txt')) -Name 'Task3: caminho UNC e rejeitado'
    Assert-Mu99True -Condition (-not (Test-Mu99ArchiveEntryPath -Root $root -EntryName 'a/../../evil2.txt')) -Name 'Task3: traversal apos normalizacao e rejeitado'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task3: validacao de entradas de arquivo' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $fx = Join-Path $PSScriptRoot 'fixtures'
    $safeZip = Join-Path $fx 'safe-archive.zip'
    $hostileZip = Join-Path $fx 'hostile-path-archive.zip'
    Assert-Mu99True -Condition ((Test-Path -LiteralPath $safeZip) -and (Test-Path -LiteralPath $hostileZip)) -Name 'Task3: fixtures safe/hostile existem no repo'
    # Staging do arquivo seguro
    $dest1 = Join-Path $tmp 'stage-safe'
    $r1 = Invoke-Mu99StagePackage -PackageZipPath $safeZip -DestinationRoot $dest1
    Assert-Mu99True -Condition ((Test-Path -LiteralPath (Join-Path $dest1 'server/ConnectServer/ServerList.dat')) -and ($r1.fileCount -ge 4)) -Name 'Task3: staging seguro extrai entradas validas'
    # Staging do arquivo hostil deve falhar fechado, sem sentinela fora do destino
    $sentinelParent = Join-Path $tmp 'SENTINEL-OUTSIDE.txt'
    if (Test-Path -LiteralPath $sentinelParent) { Remove-Item -LiteralPath $sentinelParent -Force }
    $destH = Join-Path $tmp 'stage-hostil'
    $threwH = $false
    try { Invoke-Mu99StagePackage -PackageZipPath $hostileZip -DestinationRoot $destH | Out-Null } catch { $threwH = $true }
    Assert-Mu99True -Condition $threwH -Name 'Task3: staging hostil e recusado'
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath $sentinelParent)) -Name 'Task3: nenhuma sentinela fora do staging'
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $tmp 'outside.txt'))) -Name 'Task3: traversal nao escreve fora do destino'
    # Destino duplicado: segunda chamada com o mesmo destino falha sem sobrescrever
    $threwDup = $false
    try { Invoke-Mu99StagePackage -PackageZipPath $safeZip -DestinationRoot $dest1 | Out-Null } catch { $threwDup = $true }
    Assert-Mu99True -Condition $threwDup -Name 'Task3: destino existente nunca e sobrescrito'
    Assert-Mu99True -Condition (Test-Path -LiteralPath (Join-Path $dest1 'server/ConnectServer/ServerList.dat')) -Name 'Task3: destino previo preservado apos duplicata'
    # Extrator indisponivel (caminho explicito invalido) com pacote contendo .rar
    $rarPkg = Join-Path $tmp 'compacote.zip'
    Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
    $cfs = [System.IO.File]::Create($rarPkg)
    try {
      $car = New-Object System.IO.Compression.ZipArchive($cfs, ([System.IO.Compression.ZipArchiveMode]::Create))
      try {
        $ce = $car.CreateEntry('bundle/inner.rar')
        $cw = New-Object System.IO.StreamWriter($ce.Open())
        try { $cw.Write('rar-falso') } finally { $cw.Dispose() }
      } finally { $car.Dispose() }
    } finally { $cfs.Dispose() }
    $threwTool = $false
    try { Invoke-Mu99StagePackage -PackageZipPath $rarPkg -DestinationRoot (Join-Path $tmp 'stage-rar') -ArchiveToolPath 'Z:\nao-existe\7z.exe' | Out-Null } catch { $threwTool = $true }
    Assert-Mu99True -Condition $threwTool -Name 'Task3: extrator indisponivel causa parada limpa'
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $tmp 'stage-rar'))) -Name 'Task3: falha de extrator nao cria destino'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task3: staging safe/hostil/duplicado/ferramenta' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $fx = Join-Path $PSScriptRoot 'fixtures'
    $safeZip = Join-Path $fx 'safe-archive.zip'
    # -WhatIf nao cria diretorio
    $destW = Join-Path $tmp 'stage-whatif'
    Invoke-Mu99StagePackage -PackageZipPath $safeZip -DestinationRoot $destW -WhatIf | Out-Null
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath $destW)) -Name 'Task3: -WhatIf nao cria staging'
    # Espaco insuficiente (simulado via override do helper) para antes da extracao
    $destS = Join-Path $tmp 'stage-sem-espaco'
    $origHelper = (Get-Command Get-Mu99DestinationFreeBytes -CommandType Function -ErrorAction SilentlyContinue)
    function Get-Mu99DestinationFreeBytes { param([string]$Path) return [long]1 }
    $threwSpace = $false
    try { Invoke-Mu99StagePackage -PackageZipPath $safeZip -DestinationRoot $destS | Out-Null } catch { $threwSpace = ($_.Exception.Message -match 'Espaco insuficiente') }
    Assert-Mu99True -Condition $threwSpace -Name 'Task3: espaco insuficiente para antes da extracao'
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath $destS)) -Name 'Task3: sem espaco nao cria destino parcial'
    Remove-Item -LiteralPath 'function:Get-Mu99DestinationFreeBytes' -Force -ErrorAction SilentlyContinue
    # ZIP corrompido nao gera overwrite parcial
    $bad = Join-Path $tmp 'bad.zip'
    [System.IO.File]::WriteAllBytes($bad, (0..255 | ForEach-Object { [byte]($_ % 256) }))
    $destB = Join-Path $tmp 'stage-bad'
    $threwBad = $false
    try { Invoke-Mu99StagePackage -PackageZipPath $bad -DestinationRoot $destB | Out-Null } catch { $threwBad = $true }
    Assert-Mu99True -Condition $threwBad -Name 'Task3: RAR/ZIP corrompido para sem overwrite parcial'
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath $destB)) -Name 'Task3: corrompido nao deixa destino parcial'
    # RAR aninhado corrompido: inventario falha sem extrair/executar
    $garbageRar = Join-Path $tmp 'lixo.rar'
    [System.IO.File]::WriteAllBytes($garbageRar, (0..127 | ForEach-Object { [byte]($_ % 251) }))
    $tool = ''
    try {
      $snap = Get-Mu99EnvironmentSnapshot
      foreach ($t in $snap.archiveTools) { if ($t -match '(UnRAR|Rar|7z)\.exe$') { $tool = $t; break } }
    } catch {}
    if ($tool) {
      $threwRar = $false
      try { Get-Mu99NestedRarInventory -RarPath $garbageRar -ArchiveToolPath $tool | Out-Null } catch { $threwRar = $true }
      Assert-Mu99True -Condition $threwRar -Name 'Task3: RAR corrompido falha no inventario'
    } else {
      Write-Mu99TestResult -Name 'Task3: RAR corrompido falha no inventario (skip, sem extrator)' -Passed $true
    }
  } finally {
    Remove-Item -LiteralPath 'function:Get-Mu99DestinationFreeBytes' -Force -ErrorAction SilentlyContinue
    Remove-Mu99TempDir -Dir $tmp
  }
} catch {
  Remove-Item -LiteralPath 'function:Get-Mu99DestinationFreeBytes' -Force -ErrorAction SilentlyContinue
  Write-Mu99TestResult -Name 'Task3: casos WhatIf/espaco/corrompido' -Passed $false -Detail $_.Exception.Message
}

# ---------------------------------------------------------------
# Task 4: dependencias e configuracao
# ---------------------------------------------------------------
function Copy-Mu99ConfigFixtures {
  param([string]$ServerRoot, [string]$ClientRoot)
  $fx = Join-Path $PSScriptRoot 'fixtures\config'
  $csDir = Join-Path $ServerRoot 'ConnectServer'
  $dataDir = Join-Path $ServerRoot 'Data'
  if (-not (Test-Path -LiteralPath $csDir)) { New-Item -ItemType Directory -Path $csDir | Out-Null }
  if (-not (Test-Path -LiteralPath $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }
  if (-not (Test-Path -LiteralPath $ClientRoot)) { New-Item -ItemType Directory -Path $ClientRoot | Out-Null }
  Copy-Item -LiteralPath (Join-Path $fx 'ServerList.dat') -Destination (Join-Path $csDir 'ServerList.dat') -Force
  Copy-Item -LiteralPath (Join-Path $fx 'MapServerInfo.dat') -Destination (Join-Path $dataDir 'MapServerInfo.dat') -Force
  Copy-Item -LiteralPath (Join-Path $fx 'Config.ini') -Destination (Join-Path $ClientRoot 'Config.ini') -Force
}

try {
  $tmp = New-Mu99TempDir
  try {
    $srv = Join-Path $tmp 'server'
    $cli = Join-Path $tmp 'client'
    New-Item -ItemType Directory -Path $srv | Out-Null
    Copy-Mu99ConfigFixtures -ServerRoot $srv -ClientRoot $cli
    $prop = Get-Mu99ConfigProposal -ServerRoot $srv -ClientRoot $cli -ServerAddress '203.0.113.10'
    Assert-Mu99True -Condition ($prop.blockers.Count -eq 0) -Name 'Task4: proposta valida sem bloqueios'
    Assert-Mu99True -Condition ($prop.changes.Count -eq 3) -Name 'Task4: proposta mira exatamente 3 entradas TUIP/STUIP'
    $keys = @($prop.changes | ForEach-Object { $_.key }) -join ','
    Assert-Mu99True -Condition (($keys -match '"TUIP"') -and ($keys -match 'STUIP') -and ($keys -match 'IpAddress')) -Name 'Task4: proposta cobre ServerList/MapServerInfo/Config.ini'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task4: proposta nos formatos conhecidos' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $fx = Join-Path $PSScriptRoot 'fixtures\config'
    # Arquivos ausentes
    $empty = Join-Path $tmp 'vazio'
    New-Item -ItemType Directory -Path $empty | Out-Null
    $p0 = Get-Mu99ConfigProposal -ServerRoot $empty -ClientRoot (Join-Path $tmp 'nocli') -ServerAddress '203.0.113.10'
    Assert-Mu99True -Condition ($p0.blockers.Count -ge 3 -and $p0.changes.Count -eq 0) -Name 'Task4: arquivos ausentes geram bloqueios sem escrita proposta'
    # Chaves duplicadas
    $dup = Join-Path $tmp 'dup'
    $dupCs = Join-Path $dup 'ConnectServer'
    New-Item -ItemType Directory -Path $dupCs -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $fx 'ServerList-dup.dat') -Destination (Join-Path $dupCs 'ServerList.dat') -Force
    $pDup = Get-Mu99ConfigProposal -ServerRoot $dup -ServerAddress '203.0.113.10'
    Assert-Mu99True -Condition (($pDup.blockers -join '|') -match 'duplicadas') -Name 'Task4: chaves duplicadas geram bloqueio'
    Assert-Mu99True -Condition (@($pDup.changes | Where-Object { $_.file -like '*ServerList*' }).Count -eq 0) -Name 'Task4: duplicadas nao geram escrita'
    # Sintaxe desconhecida
    $unk = Join-Path $tmp 'unk'
    $unkCs = Join-Path $unk 'ConnectServer'
    New-Item -ItemType Directory -Path $unkCs -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $fx 'ServerList-unknown.dat') -Destination (Join-Path $unkCs 'ServerList.dat') -Force
    $pUnk = Get-Mu99ConfigProposal -ServerRoot $unk -ServerAddress '203.0.113.10'
    Assert-Mu99True -Condition (($pUnk.blockers -join '|') -match 'TUIP') -Name 'Task4: sintaxe desconhecida gera bloqueio'
    # Ambiguos nao alteram bytes originais
    $hBefore = (Get-FileHash -LiteralPath (Join-Path $dupCs 'ServerList.dat') -Algorithm SHA256).Hash
    $threw = $false
    try { Set-Mu99AddressConfiguration -Proposal $pDup -DestinationRoot (Join-Path $tmp 'out-dup') | Out-Null } catch { $threw = $true }
    Assert-Mu99True -Condition $threw -Name 'Task4: proposta ambigua nao e escrita (falha fechada)'
    $hAfter = (Get-FileHash -LiteralPath (Join-Path $dupCs 'ServerList.dat') -Algorithm SHA256).Hash
    Assert-Mu99Equal -Expected $hBefore -Actual $hAfter -Name 'Task4: original ambiguo permanece byte-identico'
    # Entrada ANSI vs BOM: proposta reconhece ambas
    $bomDir = Join-Path $tmp 'bom'
    $bomCs = Join-Path $bomDir 'ConnectServer'
    $bomData = Join-Path $bomDir 'Data'
    New-Item -ItemType Directory -Path $bomCs -Force | Out-Null
    New-Item -ItemType Directory -Path $bomData -Force | Out-Null
    $raw = [System.IO.File]::ReadAllBytes((Join-Path $fx 'ServerList.dat'))
    $withBom = (New-Object System.Text.UTF8Encoding($true)).GetPreamble() + $raw
    [System.IO.File]::WriteAllBytes((Join-Path $bomCs 'ServerList.dat'), $withBom)
    Copy-Item -LiteralPath (Join-Path $fx 'MapServerInfo.dat') -Destination (Join-Path $bomData 'MapServerInfo.dat') -Force
    $pBom = Get-Mu99ConfigProposal -ServerRoot $bomDir -ServerAddress '203.0.113.10'
    Assert-Mu99True -Condition (@($pBom.changes | Where-Object { $_.file -like '*ServerList*' }).Count -eq 1) -Name 'Task4: entrada BOM e reconhecida'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task4: casos ausente/duplicado/desconhecido/BOM' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $srv = Join-Path $tmp 'server'
    $cli = Join-Path $tmp 'client'
    $out = Join-Path $tmp 'out'
    New-Item -ItemType Directory -Path $srv | Out-Null
    New-Item -ItemType Directory -Path $out | Out-Null
    Copy-Mu99ConfigFixtures -ServerRoot $srv -ClientRoot $cli
    $slPath = Join-Path $srv 'ConnectServer\ServerList.dat'
    $msPath = Join-Path $srv 'Data\MapServerInfo.dat'
    $ciPath = Join-Path $cli 'Config.ini'
    $hSl = (Get-FileHash -LiteralPath $slPath -Algorithm SHA256).Hash
    $hMs = (Get-FileHash -LiteralPath $msPath -Algorithm SHA256).Hash
    $hCi = (Get-FileHash -LiteralPath $ciPath -Algorithm SHA256).Hash
    # -WhatIf deixa tudo byte-identico
    $propW = Get-Mu99ConfigProposal -ServerRoot $srv -ClientRoot $cli -ServerAddress '203.0.113.10'
    Set-Mu99AddressConfiguration -Proposal $propW -DestinationRoot $out -WhatIf | Out-Null
    Assert-Mu99Equal -Expected $hSl -Actual (Get-FileHash -LiteralPath $slPath -Algorithm SHA256).Hash -Name 'Task4: -WhatIf preserva ServerList.dat'
    Assert-Mu99Equal -Expected $hMs -Actual (Get-FileHash -LiteralPath $msPath -Algorithm SHA256).Hash -Name 'Task4: -WhatIf preserva MapServerInfo.dat'
    Assert-Mu99Equal -Expected $hCi -Actual (Get-FileHash -LiteralPath $ciPath -Algorithm SHA256).Hash -Name 'Task4: -WhatIf preserva Config.ini'
    # Mudanca confirmada cria backups com SHA-256 do original
    $prop = Get-Mu99ConfigProposal -ServerRoot $srv -ClientRoot $cli -ServerAddress '203.0.113.10'
    $backs = Set-Mu99AddressConfiguration -Proposal $prop -DestinationRoot $out
    Assert-Mu99True -Condition ($backs.Count -eq 3) -Name 'Task4: mudanca confirmada cria 3 backups'
    $bHashes = @(Get-ChildItem -LiteralPath (Join-Path $out 'backups') -File | ForEach-Object { (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash })
    Assert-Mu99True -Condition (($bHashes -contains $hSl) -and ($bHashes -contains $hMs) -and ($bHashes -contains $hCi)) -Name 'Task4: backups conferem com SHA-256 dos originais'
    $newSl = [System.IO.File]::ReadAllText($slPath)
    $newMs = [System.IO.File]::ReadAllText($msPath)
    $newCi = [System.IO.File]::ReadAllText($ciPath)
    Assert-Mu99True -Condition (($newSl -match '203\.0\.113\.10') -and ($newMs -match '203\.0\.113\.10') -and ($newCi -match '203\.0\.113\.10')) -Name 'Task4: novo endereco aplicado nos 3 arquivos'
    Assert-Mu99True -Condition ((-not ($newSl.Contains('TUIP'))) -and (-not ($newMs.Contains('STUIP'))) -and (-not ($newCi.Contains('= TUIP')))) -Name 'Task4: placeholders substituidos'
    # Relatorio redigido sem senha/token de exemplo
    $dep = Get-Mu99DependencyReport -ServerRoot $srv
    $repPath = Join-Path $out 'dep.json'
    $wrap = [pscustomobject]@{ dependencies = $dep; password = 'hunter2value'; token = 'tok_ABCDEF123' }
    Write-Mu99Report -Path $repPath -Report $wrap
    $rc = [System.IO.File]::ReadAllText($repPath)
    Assert-Mu99True -Condition ((-not ($rc.Contains('hunter2value'))) -and (-not ($rc.Contains('tok_ABCDEF123'))) -and ($rc -match '\*\*\*')) -Name 'Task4: relatorio nao expoe senha/token'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task4: escrita reversivel e redacao' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $srv = Join-Path $tmp 'server'
    $cli = Join-Path $tmp 'client'
    $out = Join-Path $tmp 'out'
    New-Item -ItemType Directory -Path $srv | Out-Null
    New-Item -ItemType Directory -Path $out | Out-Null
    Copy-Mu99ConfigFixtures -ServerRoot $srv -ClientRoot $cli
    $msPath = Join-Path $srv 'Data\MapServerInfo.dat'
    # Regressao: endereco iniciado em digito nao pode vazar "$1" literal no arquivo.
    $propD = Get-Mu99ConfigProposal -ServerRoot $srv -ClientRoot $cli -ServerAddress '102.165.46.30'
    Set-Mu99AddressConfiguration -Proposal $propD -DestinationRoot $out | Out-Null
    $newMsD = [System.IO.File]::ReadAllText($msPath)
    Assert-Mu99True -Condition ((-not ($newMsD.Contains('$'))) -and ($newMsD -match '(?m)(^|\s)102\.165\.46\.30(\s|$)')) -Name 'Task4: STUIP com endereco iniciado em digito nao vaza $1'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task4: regressao $1 em endereco com digito inicial' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $srv = Join-Path $tmp 'server'
    New-Item -ItemType Directory -Path $srv | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $srv 'GameServer.exe'), 'binario-falso-nao-executar')
    [System.IO.File]::WriteAllText((Join-Path $srv 'vcredist_x86.exe'), 'instalador-falso-nao-executar')
    $before = @(Get-ChildItem -LiteralPath $srv -Recurse -File | ForEach-Object { $_.FullName })
    $dep = Get-Mu99DependencyReport -ServerRoot $srv
    $after = @(Get-ChildItem -LiteralPath $srv -Recurse -File | ForEach-Object { $_.FullName })
    Assert-Mu99True -Condition ($before.Count -eq $after.Count) -Name 'Task4: dependencias nao instalam nem alteram nada'
    Assert-Mu99True -Condition ($dep.installsNothing -eq $true) -Name 'Task4: relatorio declara que nada instala'
    Assert-Mu99True -Condition ($dep.unknowns.Count -ge 2) -Name 'Task4: desconhecidos de compatibilidade listados'
    Assert-Mu99True -Condition ((@($dep.runtimeInstallersFound).Count -ge 1)) -Name 'Task4: instaladores de runtime detectados sem execucao'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task4: relatorio de dependencias' -Passed $false -Detail $_.Exception.Message
}

# ---------------------------------------------------------------
# Task 5: SQL com executor falso (sem banco real)
# ---------------------------------------------------------------
function New-Mu99FakeSqlExecutor {
  param(
    [string[]]$ExistingDatabases = @(),
    [int]$ActiveSessions = 0,
    [switch]$EmptyHeader,
    [string]$ThrowMessage = ''
  )
  $state = [pscustomobject]@{
    queries = @()
    existing = $ExistingDatabases
    sessions = $ActiveSessions
    emptyHeader = $EmptyHeader.IsPresent
    throwMessage = $ThrowMessage
  }
  $sb = {
    param($SqlInstance, $Query, $Credential)
    $state.queries += $Query
    if ($state.throwMessage) { throw $state.throwMessage }
    if ($Query -match 'RESTORE HEADERONLY') {
      if ($state.emptyHeader) { return @() }
      return @([pscustomobject]@{ BackupName = 'MuOnline'; DatabaseName = 'MuOnline'; BackupSize = 3500000 })
    }
    if ($Query -match 'RESTORE FILELISTONLY') { return @([pscustomobject]@{ LogicalName = 'MuOnline'; PhysicalName = 'C:\SQL\MuOnline.mdf' }) }
    if ($Query -match 'RESTORE VERIFYONLY') { return @() }
    if ($Query -match 'FROM sys.databases') {
      $out = @()
      foreach ($db in $state.existing) { $out += [pscustomobject]@{ name = $db; state_desc = 'ONLINE' } }
      return $out
    }
    if ($Query -match 'dm_exec_sessions') {
      $out = @()
      for ($i = 0; $i -lt $state.sessions; $i++) { $out += [pscustomobject]@{ session_id = (50 + $i) } }
      return $out
    }
    if ($Query -match 'BACKUP DATABASE') { return @() }
    if ($Query -match 'RESTORE DATABASE') { return @() }
    if ($Query -match 'InstanceDefaultDataPath') { return @([pscustomobject]@{ DataPath = 'C:\SQLData\' }) }
    if ($Query -match 'SERVERPROPERTY') { return @([pscustomobject]@{ ProductVersion = '15.0.0'; Edition = 'Express Edition'; CurrentDb = 'master' }) }
    return @()
  }.GetNewClosure()
  return [pscustomobject]@{ state = $state; executor = $sb }
}

function New-Mu99FakeBak {
  param([string]$Dir)
  $dbDir = Join-Path $Dir 'DB'
  if (-not (Test-Path -LiteralPath $dbDir)) { New-Item -ItemType Directory -Path $dbDir | Out-Null }
  $bak = Join-Path $dbDir 'MuOnline.bak'
  [System.IO.File]::WriteAllBytes($bak, (0..255 | ForEach-Object { [byte]($_ % 251) }))
  return $bak
}

try {
  $tmp = New-Mu99TempDir
  try {
    $bak = New-Mu99FakeBak -Dir $tmp
    $fake = New-Mu99FakeSqlExecutor
    $meta = Get-Mu99BackupMetadata -BackupPath $bak -SqlInstance '.\SQLEXPRESS' -SqlExecutor $fake.executor
    Assert-Mu99True -Condition ($meta.valid -eq $true) -Name 'Task5: metadados validos para MuOnline.bak'
    $qs = $fake.state.queries -join "`n"
    Assert-Mu99True -Condition (($qs -match 'HEADERONLY') -and ($qs -match 'FILELISTONLY') -and ($qs -match 'VERIFYONLY')) -Name 'Task5: sequencia HEADERONLY/FILELISTONLY/VERIFYONLY'
    Assert-Mu99True -Condition (($qs -match [regex]::Escape($bak.Replace("'", "''")))) -Name 'Task5: sequencia mira apenas DB MuOnline.bak'
    Assert-Mu99True -Condition (-not ($qs -match '\*\.bak')) -Name 'Task5: nenhum restore amplo de *.bak'
    # Restore novo banco (sem overwrite): VERIFYONLY antes do RESTORE
    $fake2 = New-Mu99FakeSqlExecutor
    $res = Invoke-Mu99DatabaseRestore -BackupPath $bak -SqlInstance '.\SQLEXPRESS' -DatabaseName 'MuOnline' -BackupRoot (Join-Path $tmp 'bk') -SqlExecutor $fake2.executor
    $q2 = $fake2.state.queries -join "`n"
    $iVerify = $q2.IndexOf('VERIFYONLY')
    $iRestore = $q2.IndexOf('RESTORE DATABASE')
    Assert-Mu99True -Condition (($iVerify -ge 0) -and ($iRestore -gt $iVerify)) -Name 'Task5: VERIFYONLY precede o restore'
    Assert-Mu99True -Condition ($q2 -match '\[MuOnline\]') -Name 'Task5: identificador de banco citado com seguranca'
    Assert-Mu99True -Condition ($res.database -eq 'MuOnline') -Name 'Task5: restore de banco novo retorna resumo'
    Assert-Mu99True -Condition ($q2 -match 'WITH REPLACE, RECOVERY, MOVE') -Name 'Task5: restore realoca arquivos com WITH MOVE'
    Assert-Mu99True -Condition ($q2 -match "MOVE N'MuOnline'") -Name 'Task5: MOVE usa nome logico do FILELISTONLY'
    # Banco existente sem switch: recusa
    $fake3 = New-Mu99FakeSqlExecutor -ExistingDatabases @('MuOnline')
    $refused = $false
    try { Invoke-Mu99DatabaseRestore -BackupPath $bak -SqlInstance '.\SQLEXPRESS' -DatabaseName 'MuOnline' -BackupRoot (Join-Path $tmp 'bk3') -SqlExecutor $fake3.executor | Out-Null } catch { $refused = ($_.Exception.Message -match 'ConfirmDatabaseOverwrite') }
    Assert-Mu99True -Condition $refused -Name 'Task5: banco existente sem switch e recusado'
    Assert-Mu99True -Condition (-not (($fake3.state.queries -join "`n") -match 'RESTORE DATABASE')) -Name 'Task5: recusa nao executa restore'
    # Banco em uso com switch: aborta sem derrubar sessoes
    $fake4 = New-Mu99FakeSqlExecutor -ExistingDatabases @('MuOnline') -ActiveSessions 2
    $inUse = $false
    try { Invoke-Mu99DatabaseRestore -BackupPath $bak -SqlInstance '.\SQLEXPRESS' -DatabaseName 'MuOnline' -BackupRoot (Join-Path $tmp 'bk4') -ConfirmDatabaseOverwrite -SqlExecutor $fake4.executor | Out-Null } catch { $inUse = ($_.Exception.Message -match 'em uso') }
    Assert-Mu99True -Condition $inUse -Name 'Task5: banco em uso aborta sem derrubar sessoes'
    Assert-Mu99True -Condition (-not (($fake4.state.queries -join "`n") -match 'RESTORE DATABASE')) -Name 'Task5: banco em uso nao executa restore'
    # Metadados invalidos: nunca restaura
    $fake5 = New-Mu99FakeSqlExecutor -EmptyHeader
    $badMeta = $false
    try { Invoke-Mu99DatabaseRestore -BackupPath $bak -SqlInstance '.\SQLEXPRESS' -DatabaseName 'MuOnline' -BackupRoot (Join-Path $tmp 'bk5') -ConfirmDatabaseOverwrite -SqlExecutor $fake5.executor | Out-Null } catch { $badMeta = ($_.Exception.Message -match 'invalido') }
    Assert-Mu99True -Condition $badMeta -Name 'Task5: metadados invalidos bloqueiam o restore'
    Assert-Mu99True -Condition (-not (($fake5.state.queries -join "`n") -match 'RESTORE DATABASE')) -Name 'Task5: metadados invalidos nao executam restore'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task5: construcao de comandos e guardas' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $bak = New-Mu99FakeBak -Dir $tmp
    $fakePass = 'FakePass123!'
    # .bak invalido (caminho errado): recusa antes de qualquer query
    $fake = New-Mu99FakeSqlExecutor
    $badBak = $false
    try { Get-Mu99BackupMetadata -BackupPath (Join-Path $tmp 'outro.bak') -SqlInstance '.\SQLEXPRESS' -SqlExecutor $fake.executor | Out-Null } catch { $badBak = ($_.Exception.Message -match 'MuOnline\.bak') }
    Assert-Mu99True -Condition $badBak -Name 'Task5: .bak fora de DB MuOnline.bak e recusado'
    Assert-Mu99True -Condition ($fake.state.queries.Count -eq 0) -Name 'Task5: .bak invalido nao emite queries'
    # Nome de banco ausente
    $fakeN = New-Mu99FakeSqlExecutor
    $noName = $false
    try { Invoke-Mu99DatabaseRestore -BackupPath $bak -SqlInstance '.\SQLEXPRESS' -DatabaseName '' -BackupRoot (Join-Path $tmp 'bkn') -SqlExecutor $fakeN.executor | Out-Null } catch { $noName = $true }
    Assert-Mu99True -Condition $noName -Name 'Task5: nome de banco ausente para sem restore'
    Assert-Mu99True -Condition (-not (($fakeN.state.queries -join "`n") -match 'RESTORE DATABASE')) -Name 'Task5: sem nome nao executa restore'
    # SQL remoto nao suportado
    $fakeR = New-Mu99FakeSqlExecutor
    $remote = $false
    try { Test-Mu99SqlInstance -SqlInstance 'tcp:203.0.113.99\SQL2019' -SqlExecutor $fakeR.executor | Out-Null } catch { $remote = ($_.Exception.Message -match 'remota') }
    Assert-Mu99True -Condition $remote -Name 'Task5: instancia remota e recusada'
    Assert-Mu99True -Condition ($fakeR.state.queries.Count -eq 0) -Name 'Task5: remoto nao abre conexao'
    # Espaco insuficiente (helper simulado)
    function Get-Mu99DestinationFreeBytes { param([string]$Path) return [long]1 }
    $fakeS = New-Mu99FakeSqlExecutor
    $noSpace = $false
    try { Invoke-Mu99DatabaseRestore -BackupPath $bak -SqlInstance '.\SQLEXPRESS' -DatabaseName 'MuOnline' -BackupRoot (Join-Path $tmp 'bks') -SqlExecutor $fakeS.executor | Out-Null } catch { $noSpace = ($_.Exception.Message -match 'Espaco insuficiente') }
    Assert-Mu99True -Condition $noSpace -Name 'Task5: disco insuficiente para sem restore'
    Assert-Mu99True -Condition (-not (($fakeS.state.queries -join "`n") -match 'RESTORE DATABASE')) -Name 'Task5: sem espaco nao executa restore'
    Remove-Item -LiteralPath 'function:Get-Mu99DestinationFreeBytes' -Force -ErrorAction SilentlyContinue
    # Credenciais invalidas / excecao SQL redigida, sem vazar senha falsa
    $fakeC = New-Mu99FakeSqlExecutor -ThrowMessage ("Login failed for user 'sa'. Senha usada: Password=" + $fakePass)
    $leaked = $false; $masked = $false
    try { Test-Mu99SqlInstance -SqlInstance '.\SQLEXPRESS' -SqlExecutor $fakeC.executor | Out-Null } catch { $leaked = $_.Exception.Message.Contains($fakePass); $masked = ($_.Exception.Message -match '\*\*\*') }
    Assert-Mu99True -Condition ((-not $leaked) -and $masked) -Name 'Task5: excecao SQL redigida sem vazar senha'
    $repPath = Join-Path $tmp 'erro-banco.json'
    $wrap = [pscustomobject]@{ instance = '.\SQLEXPRESS'; password = $fakePass; note = 'falha simulada' }
    Write-Mu99Report -Path $repPath -Report $wrap
    $rc = [System.IO.File]::ReadAllText($repPath)
    Assert-Mu99True -Condition ((-not ($rc.Contains($fakePass))) -and ($rc -match '\*\*\*')) -Name 'Task5: relatorio nao expoe senha falsa'
    # Nome malicioso nao executa nada
    $fakeM = New-Mu99FakeSqlExecutor
    $evil = $false
    try { Invoke-Mu99DatabaseRestore -BackupPath $bak -SqlInstance '.\SQLEXPRESS' -DatabaseName 'X; DROP TABLE users--' -BackupRoot (Join-Path $tmp 'bkm') -ConfirmDatabaseOverwrite -SqlExecutor $fakeM.executor | Out-Null } catch { $evil = $true }
    Assert-Mu99True -Condition $evil -Name 'Task5: nome de banco malicioso e rejeitado'
    Assert-Mu99True -Condition ($fakeM.state.queries.Count -eq 0) -Name 'Task5: nome malicioso nao emite queries'
  } finally {
    Remove-Item -LiteralPath 'function:Get-Mu99DestinationFreeBytes' -Force -ErrorAction SilentlyContinue
    Remove-Mu99TempDir -Dir $tmp
  }
} catch {
  Remove-Item -LiteralPath 'function:Get-Mu99DestinationFreeBytes' -Force -ErrorAction SilentlyContinue
  Write-Mu99TestResult -Name 'Task5: falhas e redacao de segredos' -Passed $false -Detail $_.Exception.Message
}

# ---------------------------------------------------------------
# Task 6: inicializacao e firewall com adaptadores simulados
# ---------------------------------------------------------------
function New-Mu99FakeProcessStarter {
  $state = [pscustomobject]@{ calls = @(); nextId = 5000 }
  $sb = {
    param($ExePath, $WorkingDirectory)
    $state.calls += [pscustomobject]@{ exe = $ExePath; workdir = $WorkingDirectory }
    $id = $state.nextId
    $state.nextId++
    return [pscustomobject]@{ Id = $id; StartTime = (Get-Date) }
  }.GetNewClosure()
  return [pscustomobject]@{ state = $state; starter = $sb }
}

function New-Mu99ServerWithExe {
  param([string]$Dir, [string]$RelPath = 'ConnectServer\ConnectServer.exe')
  if (-not (Test-Path -LiteralPath $Dir)) { New-Item -ItemType Directory -Path $Dir | Out-Null }
  $full = Join-Path $Dir $RelPath
  $parent = Split-Path -Parent $full
  if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
  [System.IO.File]::WriteAllText($full, 'binario-falso-nao-executar')
  return $full
}

function Write-Mu99Manifest {
  param([string]$Path, [object[]]$Components)
  $obj = [pscustomobject]@{ components = $Components }
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, ($obj | ConvertTo-Json -Depth 5), $utf8)
}

try {
  $tmp = New-Mu99TempDir
  try {
    $srv = Join-Path $tmp 'server'
    $exe = New-Mu99ServerWithExe -Dir $srv
    $fake = New-Mu99FakeProcessStarter
    # Manifesto valido com ordem confirmada
    $man = Join-Path $tmp 'manifest-ok.json'
    Write-Mu99Manifest -Path $man -Components @(
      [pscustomobject]@{ name = 'ConnectServer'; path = 'ConnectServer\ConnectServer.exe'; workingDirectory = 'ConnectServer'; order = 1 }
    )
    $res = Start-Mu99Components -ComponentManifestPath $man -ServerRoot $srv -AcceptUnsignedBinaries -ProcessStarter $fake.starter
    Assert-Mu99True -Condition ((@($res).Count -eq 1) -and ($res[0].pid -ge 5000)) -Name 'Task6: manifesto valido inicia com ordem confirmada (mock)'
    Assert-Mu99True -Condition ($fake.state.calls.Count -eq 1) -Name 'Task6: starter mock chamado uma vez'
    # Caminho fora da raiz: recusa
    $fakeO = New-Mu99FakeProcessStarter
    $manO = Join-Path $tmp 'manifest-out.json'
    Write-Mu99Manifest -Path $manO -Components @(
      [pscustomobject]@{ name = 'Evil'; path = '..\evil\game.exe'; workingDirectory = '.'; order = 1 }
    )
    $outside = $false
    try { Start-Mu99Components -ComponentManifestPath $manO -ServerRoot $srv -AcceptUnsignedBinaries -ProcessStarter $fakeO.starter | Out-Null } catch { $outside = ($_.Exception.Message -match 'fora da raiz') }
    Assert-Mu99True -Condition $outside -Name 'Task6: caminho fora da raiz e recusado'
    Assert-Mu99True -Condition ($fakeO.state.calls.Count -eq 0) -Name 'Task6: recusa nao lanca processo'
    # Executavel ausente
    $fakeM = New-Mu99FakeProcessStarter
    $manM = Join-Path $tmp 'manifest-miss.json'
    Write-Mu99Manifest -Path $manM -Components @(
      [pscustomobject]@{ name = 'Ghost'; path = 'ConnectServer\Ghost.exe'; workingDirectory = 'ConnectServer'; order = 1 }
    )
    $miss = $false
    try { Start-Mu99Components -ComponentManifestPath $manM -ServerRoot $srv -AcceptUnsignedBinaries -ProcessStarter $fakeM.starter | Out-Null } catch { $miss = ($_.Exception.Message -match 'nao encontrado') }
    Assert-Mu99True -Condition $miss -Name 'Task6: executavel ausente e recusado'
    # Ordem nao confirmada
    $fakeU = New-Mu99FakeProcessStarter
    $manU = Join-Path $tmp 'manifest-unord.json'
    [System.IO.File]::WriteAllText($manU, '{"components":[{"name":"ConnectServer","path":"ConnectServer\\ConnectServer.exe","workingDirectory":"ConnectServer"}]}')
    $unord = $false
    try { Start-Mu99Components -ComponentManifestPath $manU -ServerRoot $srv -AcceptUnsignedBinaries -ProcessStarter $fakeU.starter | Out-Null } catch { $unord = ($_.Exception.Message -match 'order') }
    Assert-Mu99True -Condition $unord -Name 'Task6: ordem nao confirmada e recusada'
    Assert-Mu99True -Condition ($fakeU.state.calls.Count -eq 0) -Name 'Task6: sem ordem nao lanca processo'
    # Nao assinado sem switch: recusa
    $fakeS = New-Mu99FakeProcessStarter
    $noSign = $false
    try { Start-Mu99Components -ComponentManifestPath $man -ServerRoot $srv -ProcessStarter $fakeS.starter | Out-Null } catch { $noSign = ($_.Exception.Message -match 'AcceptUnsignedBinaries') }
    Assert-Mu99True -Condition $noSign -Name 'Task6: nao assinado sem switch e recusado'
    Assert-Mu99True -Condition ($fakeS.state.calls.Count -eq 0) -Name 'Task6: sem switch nao lanca processo'
    # .bat recusado
    $batFull = Join-Path $srv 'run.bat'
    [System.IO.File]::WriteAllText($batFull, 'eco falso')
    $fakeB = New-Mu99FakeProcessStarter
    $manB = Join-Path $tmp 'manifest-bat.json'
    Write-Mu99Manifest -Path $manB -Components @(
      [pscustomobject]@{ name = 'Lote'; path = 'run.bat'; workingDirectory = '.'; order = 1 }
    )
    $batBad = $false
    try { Start-Mu99Components -ComponentManifestPath $manB -ServerRoot $srv -AcceptUnsignedBinaries -ProcessStarter $fakeB.starter | Out-Null } catch { $batBad = $true }
    Assert-Mu99True -Condition $batBad -Name 'Task6: .bat nao e iniciado automaticamente'
    Assert-Mu99True -Condition ($fakeB.state.calls.Count -eq 0) -Name 'Task6: .bat nao lanca processo'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task6: manifesto de inicializacao' -Passed $false -Detail $_.Exception.Message
}

try {
  Assert-Mu99True -Condition (@(Get-Mu99FirewallPlan -ApprovedGamePorts @(44405) -ApprovedProtocols @('TCP')).Count -eq 1) -Name 'Task6: plano emite porta aprovada'
  $rejected = $false
  try { Get-Mu99FirewallPlan -ApprovedGamePorts @(1433) | Out-Null } catch { $rejected = $true }
  Assert-Mu99True -Condition $rejected -Name 'Task6: plano rejeita 1433 (SQL)'
  $rejected = $false
  try { Get-Mu99FirewallPlan -ApprovedGamePorts @(1434) | Out-Null } catch { $rejected = $true }
  Assert-Mu99True -Condition $rejected -Name 'Task6: plano rejeita 1434 (SQL)'
  $rejected = $false
  try { Get-Mu99FirewallPlan -ApprovedGamePorts @(3389) | Out-Null } catch { $rejected = $true }
  Assert-Mu99True -Condition $rejected -Name 'Task6: plano rejeita 3389 (RDP)'
  $rejected = $false
  try { Get-Mu99FirewallPlan -ApprovedGamePorts @(55901) -DetectedAdminPorts @(55901) | Out-Null } catch { $rejected = $true }
  Assert-Mu99True -Condition $rejected -Name 'Task6: plano rejeita porta administrativa detectada'
  $rejected = $false
  try { Get-Mu99FirewallPlan -ApprovedGamePorts @() | Out-Null } catch { $rejected = $true }
  Assert-Mu99True -Condition $rejected -Name 'Task6: plano recusa lista vazia'
  $plan = Get-Mu99FirewallPlan -ApprovedGamePorts @(44405,55901) -ApprovedProtocols @('TCP','UDP')
  $onlyApproved = @(($plan | Where-Object { ($_.port -notin @(44405,55901)) -or ($_.protocol -notin @('TCP','UDP')) })).Count -eq 0
  $namesOk = @(($plan | Where-Object { $_.name -notlike 'MU99-Pilot-*' })).Count -eq 0
  Assert-Mu99True -Condition ($onlyApproved -and $namesOk -and (@($plan).Count -eq 4)) -Name 'Task6: plano emite somente TCP/UDP aprovados com prefixo'
} catch {
  Write-Mu99TestResult -Name 'Task6: politica de plano de firewall' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $script:Mu99ForceAdmin = $true
    $plan = Get-Mu99FirewallPlan -ApprovedGamePorts @(44405,55901) -ApprovedProtocols @('TCP')
    # -WhatIf nao aciona adaptador nem manifesto
    $callState = [pscustomobject]@{ names = @() }
    $mockCreate = { param($Rule) $callState.names += $Rule.name; return $Rule.name }.GetNewClosure()
    $outW = Join-Path $tmp 'out-whatif'
    Add-Mu99FirewallRules -Plan $plan -DestinationRoot $outW -FirewallCreator $mockCreate -WhatIf | Out-Null
    Assert-Mu99True -Condition ($callState.names.Count -eq 0) -Name 'Task6: -WhatIf nao aciona adaptador de firewall'
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $outW 'state\firewall-manifest.json'))) -Name 'Task6: -WhatIf nao grava manifesto'
    # Apply real (mock) + rollback preserva regras alheias
    $out = Join-Path $tmp 'out'
    $created = @(Add-Mu99FirewallRules -Plan $plan -DestinationRoot $out -FirewallCreator $mockCreate)
    Assert-Mu99True -Condition (($created.Count -eq 2) -and ($callState.names.Count -eq 2)) -Name 'Task6: apply cria somente regras aprovadas (mock)'
    Assert-Mu99True -Condition (Test-Path -LiteralPath (Join-Path $out 'state\firewall-manifest.json')) -Name 'Task6: apply grava manifesto de posse'
    $removedState = [pscustomobject]@{ names = @() }
    $mockRemove = { param($RuleName) $removedState.names += $RuleName; return $RuleName }.GetNewClosure()
    $removed = @(Remove-Mu99FirewallRules -DestinationRoot $out -FirewallRemover $mockRemove)
    Assert-Mu99True -Condition (($removed.Count -eq 2) -and ($removedState.names.Count -eq 2)) -Name 'Task6: rollback remove somente regras proprias'
    Assert-Mu99True -Condition ((@(Compare-Object $removed $created -SyncWindow 0).Count -eq 0) -or (($removed -join '|') -eq ($created -join '|'))) -Name 'Task6: rollback confere com o manifesto'
    # Sem elevacao: nada muda
    $script:Mu99ForceAdmin = $false
    $denied = $false
    try { Add-Mu99FirewallRules -Plan $plan -DestinationRoot (Join-Path $tmp 'out2') -FirewallCreator $mockCreate | Out-Null } catch { $denied = ($_.Exception.Message -match 'elevado') }
    Assert-Mu99True -Condition $denied -Name 'Task6: apply sem elevacao e negado'
    # Manifesto estranho: reversao aborta (preserva alheias)
    $script:Mu99ForceAdmin = $true
    $outE = Join-Path $tmp 'out-evil'
    New-Item -ItemType Directory -Path (Join-Path $outE 'state') -Force | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $outE 'state\firewall-manifest.json'), '[{"name":"Regra-Alheia-3389","port":3389,"protocol":"TCP","id":"x"}]')
    $evilBlocked = $false
    try { Remove-Mu99FirewallRules -DestinationRoot $outE -FirewallRemover $mockRemove | Out-Null } catch { $evilBlocked = $true }
    Assert-Mu99True -Condition $evilBlocked -Name 'Task6: reversao com nome estranho aborta'
    Assert-Mu99True -Condition ($removedState.names.Count -eq 2) -Name 'Task6: reversao abortada nao remove nada a mais'
  } finally {
    $script:Mu99ForceAdmin = $null
    Remove-Mu99TempDir -Dir $tmp
  }
} catch {
  $script:Mu99ForceAdmin = $null
  Write-Mu99TestResult -Name 'Task6: apply/rollback com mocks' -Passed $false -Detail $_.Exception.Message
}

# ---------------------------------------------------------------
# Task 2B: inventario honesto de RARs (regressoes da revisao)
# ---------------------------------------------------------------
function New-Mu99NestedTestPackage {
  param([string]$ZipPath)
  Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }
  $fs = [System.IO.File]::Create($ZipPath)
  try {
    $ar = New-Object System.IO.Compression.ZipArchive($fs, ([System.IO.Compression.ZipArchiveMode]::Create))
    try {
      $defs = @(
        'MuDevs Free - Release II Files 99b/[MUDevs - Free Release 2] Files 99b.rar',
        'MuDevs Free - Release II Files 99b/[MUDevs - Free Release 2] Client 99b.rar',
        'MuDevs Free - Release II Files 99b/Librerias.rar',
        'MuDevs Free - Release II Files 99b/pic/nfo.txt'
      )
      foreach ($d in $defs) {
        $e = $ar.CreateEntry($d)
        $w = New-Object System.IO.StreamWriter($e.Open())
        try { $w.Write(('fake-rar-bytes-for:' + $d)) } finally { $w.Dispose() }
      }
    } finally { $ar.Dispose() }
  } finally { $fs.Dispose() }
}

function New-Mu99FakeRarTool {
  param([string]$Mode = 'ok')
  $state = [pscustomobject]@{ listCalls = @(); extractCalls = @(); mode = $Mode }
  $srv = @(
    [pscustomobject]@{ name = '[MUDevs - Free Release 2] Files 99b\ConnectServer\ServerList.dat'; size = 160 },
    [pscustomobject]@{ name = '[MUDevs - Free Release 2] Files 99b\ConnectServer\ConnectServer.ini'; size = 868 },
    [pscustomobject]@{ name = '[MUDevs - Free Release 2] Files 99b\Data\MapServerInfo.dat'; size = 184 },
    [pscustomobject]@{ name = '[MUDevs - Free Release 2] Files 99b\DB\MuOnline.bak'; size = 3496448 },
    [pscustomobject]@{ name = '[MUDevs - Free Release 2] Files 99b\GameServer\GameServer.exe'; size = 2638336 }
  )
  $libs = @(
    [pscustomobject]@{ name = 'Librerias\vcredist_x86.exe'; size = 5073240 },
    [pscustomobject]@{ name = 'Librerias\vc_redist.x86.exe'; size = 13767776 }
  )
  $cli = @(
    [pscustomobject]@{ name = '[MUDevs - Free Release 2] Client 99b\Config.ini'; size = 441 },
    [pscustomobject]@{ name = '[MUDevs - Free Release 2] Client 99b\main.exe'; size = 2199616 }
  )
  $listSb = {
    param($RarPathOrName)
    $state.listCalls += [string]$RarPathOrName
    if ($state.mode -eq 'list-error') { throw 'fake-list-boom' }
    # Classifica pelo NOME DO ARQUIVO (igual ao staged classifier do script),
    # nunca pela pasta externa do ZIP.
    $base = [string]$RarPathOrName
    $leaf = $base
    $sep = $leaf.LastIndexOf('\')
    $sep2 = $leaf.LastIndexOf('/')
    if ($sep2 -gt $sep) { $sep = $sep2 }
    if ($sep -ge 0) { $leaf = $leaf.Substring($sep + 1) }
    $out = @()
    if (($leaf -like '*Files*') -and ($leaf -like '*99b*')) { $out = @($srv) }
    elseif (($leaf -like '*Client*') -and ($leaf -like '*99b*')) { $out = @($cli) }
    elseif ($leaf -like '*Librerias*') { $out = @($libs) }
    else { throw ("fake-list: rar desconhecido: " + $base) }
    if ($state.mode -eq 'hostile-path') {
      $out = @($out) + @([pscustomobject]@{ name = '..\outside.txt'; size = 10 })
    } elseif ($state.mode -eq 'link') {
      $out = @($out) + @([pscustomobject]@{ name = '[MUDevs - Free Release 2] Files 99b\srvlink'; size = 0; linkHint = $true })
    } elseif ($state.mode -eq 'device-name') {
      $out = @($out) + @([pscustomobject]@{ name = '[MUDevs - Free Release 2] Files 99b\NUL.txt'; size = 10 })
    } elseif ($state.mode -eq 'empty') {
      $out = @()
    }
    return $out
  }.GetNewClosure()
  $extractSb = {
    param($RarPath, $DestDir, $FinalNames)
    $state.extractCalls += [pscustomobject]@{ rar = [string]$RarPath; dest = [string]$DestDir; count = @($FinalNames).Count }
    if ($state.mode -eq 'extract-error') { throw 'fake-extract-boom' }
    foreach ($n in @($FinalNames)) {
      $full = Join-Path $DestDir $n
      $parent = Split-Path -Parent $full
      if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
      [System.IO.File]::WriteAllText($full, ('synthetic-extracted:' + $n))
    }
  }.GetNewClosure()
  return [pscustomobject]@{ state = $state; listAdapter = $listSb; extractAdapter = $extractSb }
}

function Get-Mu99InvScratchLeftovers {
  $found = @(Get-ChildItem -LiteralPath ([System.IO.Path]::GetTempPath()) -Filter 'mu99-inv-*' -Directory -ErrorAction SilentlyContinue)
  return ,$found
}

try {
  $tmp = New-Mu99TempDir
  try {
    $pkg = Join-Path $tmp 'nested-pkg.zip'
    New-Mu99NestedTestPackage -ZipPath $pkg
    $fake = New-Mu99FakeRarTool -Mode 'ok'
    $inv = Get-Mu99PackageInventory -PackageZipPath $pkg -ListAdapter $fake.listAdapter
    Assert-Mu99True -Condition ($inv.nestedRarStatus -eq 'listed') -Name 'Task2B: listagem real marca listed'
    Assert-Mu99True -Condition (@($inv.nestedRars).Count -eq 3) -Name 'Task2B: tres RARs com status individual'
    Assert-Mu99True -Condition ((@($inv.nestedRars | Where-Object { $_.status -eq 'listed' }).Count) -eq 3) -Name 'Task2B: todos os RARs listados de verdade'
    Assert-Mu99True -Condition ($inv.hasMuOnlineBak) -Name 'Task2B: MuOnline.bak detectado VIA membro aninhado (sem entrada direta)'
    Assert-Mu99True -Condition (@($inv.detectedExecutables) -contains 'GameServer.exe') -Name 'Task2B: exe detectado via membro aninhado'
    Assert-Mu99True -Condition ((@($inv.detectedConfigs) -contains 'ServerList.dat') -and (@($inv.detectedConfigs) -contains 'Config.ini')) -Name 'Task2B: configs detectadas via membros aninhados'
    $srvEntry = @($inv.nestedRars | Where-Object { $_.rar -like '*Files 99b.rar' })
    Assert-Mu99True -Condition ((@($srvEntry).Count -eq 1) -and (@($srvEntry)[0].memberCount -eq 5)) -Name 'Task2B: RAR servidor com 5 membros reais'
    Assert-Mu99True -Condition ((Get-Mu99InvScratchLeftovers).Count -eq 0) -Name 'Task2B: temporario de materializacao removido'
    Assert-Mu99True -Condition ($fake.state.listCalls.Count -eq 3) -Name 'Task2B: adaptador chamado uma vez por RAR'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task2B: inventario com listagem real' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $pkg = Join-Path $tmp 'nested-pkg.zip'
    New-Mu99NestedTestPackage -ZipPath $pkg
    # Falha de listagem em qualquer RAR: honesto, sem excecao geral
    $fakeErr = New-Mu99FakeRarTool -Mode 'list-error'
    $invF = Get-Mu99PackageInventory -PackageZipPath $pkg -ListAdapter $fakeErr.listAdapter
    Assert-Mu99True -Condition ($invF.nestedRarStatus -eq 'list-failed') -Name 'Task2B: falha total marca list-failed (nao listed)'
    Assert-Mu99True -Condition ((@($invF.nestedRars | Where-Object { $_.status -eq 'list-failed' }).Count) -eq 3) -Name 'Task2B: cada RAR carrega seu erro'
    Assert-Mu99True -Condition ((@($invF.nestedRars)[0].error -match 'fake-list-boom')) -Name 'Task2B: erro de listagem registrado sem vazar segredo'
    Assert-Mu99True -Condition (-not $invF.hasMuOnlineBak) -Name 'Task2B: sem listagem nao afirma .bak'
    # Conteudo ilegivel + ferramenta real (quando houver): nunca "listed" falso
    $garbagePkg = Join-Path $tmp 'garbage-rar-pkg.zip'
    Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
    $gfs = [System.IO.File]::Create($garbagePkg)
    try {
      $gar = New-Object System.IO.Compression.ZipArchive($gfs, ([System.IO.Compression.ZipArchiveMode]::Create))
      try {
        $ge = $gar.CreateEntry('pkg/Files 99b.rar')
        $gw = New-Object System.IO.StreamWriter($ge.Open())
        try { $gw.Write('isto-nao-e-um-rar') } finally { $gw.Dispose() }
      } finally { $gar.Dispose() }
    } finally { $gfs.Dispose() }
    $invG = Get-Mu99PackageInventory -PackageZipPath $garbagePkg
    Assert-Mu99True -Condition ($invG.nestedRarStatus -ne 'listed') -Name 'Task2B: conteudo ilegivel nunca marca listed'
    Assert-Mu99True -Condition ((Get-Mu99InvScratchLeftovers).Count -eq 0) -Name 'Task2B: falha tambem limpa temporario'
    # Sem ferramenta e sem adaptador: pendente honesto
    $invP = Get-Mu99PackageInventory -PackageZipPath $pkg -ArchiveToolPath 'Z:\nao-existe\7z.exe'
    Assert-Mu99True -Condition ($invP.nestedRarStatus -eq 'pending-no-tool') -Name 'Task2B: sem extrator marca pending-no-tool'
    Assert-Mu99True -Condition ((@($invP.nestedRars | Where-Object { $_.status -eq 'pending-no-tool' }).Count) -eq 3) -Name 'Task2B: pendencia por RAR, sem extracao'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task2B: falhas honestas de listagem' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $pkg = Join-Path $tmp 'nested-pkg.zip'
    New-Mu99NestedTestPackage -ZipPath $pkg
    $fake = New-Mu99FakeRarTool -Mode 'ok'
    $out = New-Mu99TempDir
    try {
      $rep = Invoke-Mu99Diagnostic -PackageZipPath $pkg -DestinationRoot $out -ListAdapter $fake.listAdapter
      $content = [System.IO.File]::ReadAllText($rep)
      Assert-Mu99True -Condition (($content -match 'listed') -and ($content -match 'MuOnline\.bak')) -Name 'Task2B: diagnostico relata listagem real'
      Assert-Mu99True -Condition (-not ($content -match 'nao confirmado')) -Name 'Task2B: .bak confirmado nao gera bloqueio'
      Assert-Mu99True -Condition ((Get-Mu99InvScratchLeftovers).Count -eq 0) -Name 'Task2B: diagnostico nao deixa temporario'
    } finally { Remove-Mu99TempDir -Dir $out }
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task2B: diagnostico com listagem real' -Passed $false -Detail $_.Exception.Message
}

# ---------------------------------------------------------------
# Task 3B: expansao aninhada segregada (regressoes da revisao)
# ---------------------------------------------------------------
function New-Mu99DummyRar {
  param([string]$Path)
  [System.IO.File]::WriteAllBytes($Path, (0..63 | ForEach-Object { [byte]($_ % 251) }))
  return $Path
}

try {
  $tmp = New-Mu99TempDir
  try {
    $pkg = Join-Path $tmp 'nested-pkg.zip'
    New-Mu99NestedTestPackage -ZipPath $pkg
    $fake = New-Mu99FakeRarTool -Mode 'ok'
    $dest = Join-Path $tmp 'stage1'
    $r = Invoke-Mu99StagePackage -PackageZipPath $pkg -DestinationRoot $dest -ListAdapter $fake.listAdapter -ExtractAdapter $fake.extractAdapter
    Assert-Mu99True -Condition (Test-Path -LiteralPath (Join-Path $dest 'server\ConnectServer\ServerList.dat')) -Name 'Task3B: servidor expandido em server/ com raiz removida'
    Assert-Mu99True -Condition (Test-Path -LiteralPath (Join-Path $dest 'server\DB\MuOnline.bak')) -Name 'Task3B: DB do servidor presente apos expansao'
    Assert-Mu99True -Condition (Test-Path -LiteralPath (Join-Path $dest 'libraries\vcredist_x86.exe')) -Name 'Task3B: bibliotecas expandidas em libraries/'
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $dest 'client'))) -Name 'Task3B: cliente NAO extraido em PrepararArquivos'
    Assert-Mu99True -Condition (Test-Path -LiteralPath (Join-Path $dest 'MuDevs Free - Release II Files 99b\[MUDevs - Free Release 2] Client 99b.rar')) -Name 'Task3B: blob do cliente preservado como original'
    $kinds = @($r.nestedArchives | ForEach-Object { $_.kind + ':' + $_.status })
    Assert-Mu99True -Condition (($kinds -contains 'server:expanded') -and ($kinds -contains 'libraries:expanded') -and ($kinds -contains 'client:skipped-client')) -Name 'Task3B: relatorio segrega expandidos e cliente pulado'
    Assert-Mu99True -Condition ($fake.state.extractCalls.Count -eq 2) -Name 'Task3B: extrator chamado so para servidor/bibliotecas'
    Assert-Mu99True -Condition ($fake.state.listCalls.Count -eq 2) -Name 'Task3B: listagem previa so de servidor/bibliotecas'
    Assert-Mu99True -Condition ((@($fake.state.listCalls | Where-Object { $_ -like '*Client*' }).Count) -eq 0) -Name 'Task3B: cliente pulado sem sequer listar'
    $slContent = [System.IO.File]::ReadAllText((Join-Path $dest 'server\ConnectServer\ServerList.dat'))
    Assert-Mu99True -Condition ($slContent -match 'synthetic-extracted:') -Name 'Task3B: conteudo veio do extrator, nada executado'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task3B: staging com expansao segregada' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $pkg = Join-Path $tmp 'nested-pkg.zip'
    New-Mu99NestedTestPackage -ZipPath $pkg
    # Membro hostil: extrator nunca e chamado, nada do RAR e gravado
    $fakeH = New-Mu99FakeRarTool -Mode 'hostile-path'
    $destH = Join-Path $tmp 'stage-hostil'
    $threwH = $false
    try { Invoke-Mu99StagePackage -PackageZipPath $pkg -DestinationRoot $destH -ListAdapter $fakeH.listAdapter -ExtractAdapter $fakeH.extractAdapter | Out-Null } catch { $threwH = ($_.Exception.Message -match 'hostil') }
    Assert-Mu99True -Condition $threwH -Name 'Task3B: membro hostil bloqueia antes de gravar'
    Assert-Mu99True -Condition ($fakeH.state.extractCalls.Count -eq 0) -Name 'Task3B: extrator nao chamado com membro hostil'
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $destH 'server'))) -Name 'Task3B: nenhum membro gravado com lista hostil'
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $tmp 'outside.txt'))) -Name 'Task3B: traversal nao escapa do staging'
    # Membro link: extrator nunca e chamado
    $fakeL = New-Mu99FakeRarTool -Mode 'link'
    $destL = Join-Path $tmp 'stage-link'
    $threwL = $false
    try { Invoke-Mu99StagePackage -PackageZipPath $pkg -DestinationRoot $destL -ListAdapter $fakeL.listAdapter -ExtractAdapter $fakeL.extractAdapter | Out-Null } catch { $threwL = ($_.Exception.Message -match 'link') }
    Assert-Mu99True -Condition $threwL -Name 'Task3B: membro link bloqueia antes de gravar'
    Assert-Mu99True -Condition ($fakeL.state.extractCalls.Count -eq 0) -Name 'Task3B: extrator nao chamado com membro link'
    # Nome de dispositivo e RAR vazio: mesma barreira pre-gravacao
    $fakeD = New-Mu99FakeRarTool -Mode 'device-name'
    $threwD = $false
    try { Invoke-Mu99StagePackage -PackageZipPath $pkg -DestinationRoot (Join-Path $tmp 'stage-dev') -ListAdapter $fakeD.listAdapter -ExtractAdapter $fakeD.extractAdapter | Out-Null } catch { $threwD = $true }
    Assert-Mu99True -Condition $threwD -Name 'Task3B: nome de dispositivo bloqueia antes de gravar'
    Assert-Mu99True -Condition ($fakeD.state.extractCalls.Count -eq 0) -Name 'Task3B: extrator nao chamado com dispositivo'
    $fakeE = New-Mu99FakeRarTool -Mode 'empty'
    $threwE = $false
    try { Invoke-Mu99StagePackage -PackageZipPath $pkg -DestinationRoot (Join-Path $tmp 'stage-empty') -ListAdapter $fakeE.listAdapter -ExtractAdapter $fakeE.extractAdapter | Out-Null } catch { $threwE = $true }
    Assert-Mu99True -Condition $threwE -Name 'Task3B: RAR vazio/ilegivel bloqueia expansao'
    # RAR desconhecido no pacote: classificacao recusa
    $unkPkg = Join-Path $tmp 'unk-pkg.zip'
    Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
    $ufs = [System.IO.File]::Create($unkPkg)
    try {
      $uar = New-Object System.IO.Compression.ZipArchive($ufs, ([System.IO.Compression.ZipArchiveMode]::Create))
      try {
        $ue = $uar.CreateEntry('bundle/mystery.rar')
        $uw = New-Object System.IO.StreamWriter($ue.Open())
        try { $uw.Write('rar-misterioso') } finally { $uw.Dispose() }
      } finally { $uar.Dispose() }
    } finally { $ufs.Dispose() }
    $fakeU = New-Mu99FakeRarTool -Mode 'ok'
    $threwU = $false
    try { Invoke-Mu99StagePackage -PackageZipPath $unkPkg -DestinationRoot (Join-Path $tmp 'stage-unk') -ListAdapter $fakeU.listAdapter -ExtractAdapter $fakeU.extractAdapter | Out-Null } catch { $threwU = ($_.Exception.Message -match 'desconhecido') }
    Assert-Mu99True -Condition $threwU -Name 'Task3B: RAR desconhecido bloqueia expansao'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task3B: barreiras pre-gravacao' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $pkg = Join-Path $tmp 'nested-pkg.zip'
    New-Mu99NestedTestPackage -ZipPath $pkg
    # Erro do extrator: arvore parcial removida, erro original preservado
    $fakeX = New-Mu99FakeRarTool -Mode 'extract-error'
    $destX = Join-Path $tmp 'stage-xerr'
    $threwX = $false
    try { Invoke-Mu99StagePackage -PackageZipPath $pkg -DestinationRoot $destX -ListAdapter $fakeX.listAdapter -ExtractAdapter $fakeX.extractAdapter | Out-Null } catch { $threwX = ($_.Exception.Message -match 'fake-extract-boom') }
    Assert-Mu99True -Condition $threwX -Name 'Task3B: erro do extrator aborta com erro original'
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $destX 'server'))) -Name 'Task3B: falha remove arvore parcial'
    Assert-Mu99True -Condition (Test-Path -LiteralPath $destX) -Name 'Task3B: raiz do staging preservada (so a arvore parcial sai)'
    # Cancelamento (-WhatIf) direto na expansao: lista, mas nao grava
    $fakeW = New-Mu99FakeRarTool -Mode 'ok'
    $dummyRar = New-Mu99DummyRar -Path (Join-Path $tmp '[MUDevs - Free Release 2] Files 99b.rar')
    $destW = Join-Path $tmp 'exp-whatif'
    $resW = Expand-Mu99NestedArchive -RarPath $dummyRar -DestinationDir $destW -ListAdapter $fakeW.listAdapter -ExtractAdapter $fakeW.extractAdapter -WhatIf
    Assert-Mu99True -Condition ($null -eq $resW) -Name 'Task3B: -WhatIf retorna nulo sem gravar'
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath $destW)) -Name 'Task3B: -WhatIf nao cria diretorio'
    Assert-Mu99True -Condition ($fakeW.state.extractCalls.Count -eq 0) -Name 'Task3B: -WhatIf nao chama extrator'
    Assert-Mu99True -Condition ($fakeW.state.listCalls.Count -eq 1) -Name 'Task3B: -WhatIf ainda lista (somente leitura)'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task3B: erro e cancelamento do extrator' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $reparse = [System.IO.FileAttributes]::ReparsePoint
    $normal = [System.IO.FileAttributes]::Normal
    # Raiz pre-existente com reparse: bloqueia ANTES do extrator, preserva tudo
    $fakeR = New-Mu99FakeRarTool -Mode 'ok'
    $dummyRar = New-Mu99DummyRar -Path (Join-Path $tmp '[MUDevs - Free Release 2] Files 99b.rar')
    $destR = Join-Path $tmp 'exp-rootreparse'
    New-Item -ItemType Directory -Path $destR | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $destR 'sentinela.txt'), 'nao-apagar')
    $readerR = { param([string]$P) return $reparse }.GetNewClosure()
    $threwR = $false
    try { Expand-Mu99NestedArchive -RarPath $dummyRar -DestinationDir $destR -ListAdapter $fakeR.listAdapter -ExtractAdapter $fakeR.extractAdapter -AttributeReader $readerR | Out-Null } catch { $threwR = ($_.Exception.Message -match 'reparse point') }
    Assert-Mu99True -Condition $threwR -Name 'Task3B: raiz reparse bloqueia antes do extrator'
    Assert-Mu99True -Condition ($fakeR.state.extractCalls.Count -eq 0) -Name 'Task3B: extrator nao chamado com raiz reparse'
    Assert-Mu99True -Condition (([System.IO.File]::ReadAllText((Join-Path $destR 'sentinela.txt'))) -eq 'nao-apagar') -Name 'Task3B: conteudo pre-existente preservado (nada removido)'
    # Parent com reparse, destino ausente: bloqueia sem gravar nada
    $fakeP = New-Mu99FakeRarTool -Mode 'ok'
    $redir = Join-Path $tmp 'pai-redir'
    New-Item -ItemType Directory -Path $redir | Out-Null
    $destP = Join-Path $redir 'server'
    $st8 = [pscustomobject]@{ parent = $redir }
    $readerP = { param([string]$P) if ($P -eq $st8.parent) { return $reparse } return $normal }.GetNewClosure()
    $threwP = $false
    try { Expand-Mu99NestedArchive -RarPath $dummyRar -DestinationDir $destP -ListAdapter $fakeP.listAdapter -ExtractAdapter $fakeP.extractAdapter -AttributeReader $readerP | Out-Null } catch { $threwP = ($_.Exception.Message -match 'Pasta pai') }
    Assert-Mu99True -Condition $threwP -Name 'Task3B: parent reparse bloqueia antes do extrator'
    Assert-Mu99True -Condition ($fakeP.state.extractCalls.Count -eq 0) -Name 'Task3B: extrator nao chamado com parent reparse'
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath $destP)) -Name 'Task3B: nada gravado com parent reparse'
    # Limpeza insegura: reparse detectado na hora de limpar -> erro combinado, sem apagar
    $fakeC = New-Mu99FakeRarTool -Mode 'extract-error'
    $destC = Join-Path $tmp 'exp-limpeza'
    $stC = [pscustomobject]@{ calls = 0 }
    $readerC = {
      param([string]$P)
      $stC.calls++
      if ($stC.calls -ge 2) { return $reparse }
      return $normal
    }.GetNewClosure()
    $threwC = $false
    try { Expand-Mu99NestedArchive -RarPath $dummyRar -DestinationDir $destC -ListAdapter $fakeC.listAdapter -ExtractAdapter $fakeC.extractAdapter -AttributeReader $readerC | Out-Null } catch { $threwC = (($_.Exception.Message -match 'fake-extract-boom') -and ($_.Exception.Message -match 'LIMPEZA PENDENTE')) }
    Assert-Mu99True -Condition $threwC -Name 'Task3B: limpeza insegura gera erro combinado sem apagar'
    Assert-Mu99True -Condition ($fakeC.state.extractCalls.Count -eq 1) -Name 'Task3B: falha ocorreu no extrator (limpeza que foi recusada)'
    # Varredura pos-extracao com reparse: remove arvore e aborta.
    # O seam informa Directory para diretorios (senao a varredura nao desce).
    $fakeS = New-Mu99FakeRarTool -Mode 'ok'
    $destS = Join-Path $tmp 'exp-sweep'
    $readerS = {
      param([string]$P)
      if ($P -like '*ServerList.dat') { return $reparse }
      if (Test-Path -LiteralPath $P -PathType Container) { return [System.IO.FileAttributes]::Directory }
      return $normal
    }.GetNewClosure()
    $threwS = $false
    try { Expand-Mu99NestedArchive -RarPath $dummyRar -DestinationDir $destS -ListAdapter $fakeS.listAdapter -ExtractAdapter $fakeS.extractAdapter -AttributeReader $readerS | Out-Null } catch { $threwS = ($_.Exception.Message -match 'insegura') }
    Assert-Mu99True -Condition $threwS -Name 'Task3B: reparse pos-extracao aborta com remocao'
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath $destS)) -Name 'Task3B: arvore insegura removida'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task3B: raiz/parent reparse e limpeza segura' -Passed $false -Detail $_.Exception.Message
}

try {
  # Parser identifica links explicitamente; nomes benignos nao disparam
  $linkCases = @(
    'pasta\destino -> alvo',
    'archive: Symbolic Link to elsewhere',
    'entry (Hard Link) data',
    'Type=Link name record',
    'Type: Link something',
    '<SYMLINK> entry',
    'dir <JUNCTION> target',
    'perms lrwxrwxrwx root file'
  )
  foreach ($c in $linkCases) {
    Assert-Mu99True -Condition (Test-Mu99ListingLinkHint -Text $c) -Name ("Task3B: parser identifica link em [" + $c + "]")
  }
  $benignCases = @(
    'ConnectServer\ServerList.dat',
    'Librerias\vcredist_x86.exe',
    'Data\MapServerInfo.dat',
    'pasta\link.txt',
    'pasta\download_links.dat'
  )
  foreach ($c in $benignCases) {
    Assert-Mu99True -Condition (-not (Test-Mu99ListingLinkHint -Text $c)) -Name ("Task3B: parser nao dispara em benigno [" + $c + "]")
  }
  # Varredura unitaria: raiz reparse e arvore limpa
  $tmp = New-Mu99TempDir
  try {
    $reparse = [System.IO.FileAttributes]::ReparsePoint
    $normal = [System.IO.FileAttributes]::Normal
    $tree = Join-Path $tmp 'tree'
    New-Item -ItemType Directory -Path $tree | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $tree 'a.txt'), 'a')
    $vOk = @(Test-Mu99StagingTreeSafe -Root $tree)
    Assert-Mu99True -Condition (@($vOk).Count -eq 0) -Name 'Task3B: arvore limpa sem violacoes'
    $readerRoot = { param([string]$P) return $reparse }.GetNewClosure()
    $vRoot = @(Test-Mu99StagingTreeSafe -Root $tree -AttributeReader $readerRoot)
    Assert-Mu99True -Condition (((@($vRoot).Count -eq 1) -and (@($vRoot)[0].reason -eq 'root-reparse-point'))) -Name 'Task3B: varredura verifica a propria raiz'
    $vMissing = @(Test-Mu99StagingTreeSafe -Root (Join-Path $tmp 'ausente'))
    Assert-Mu99True -Condition (((@($vMissing).Count -eq 1) -and (@($vMissing)[0].reason -eq 'raiz-ausente'))) -Name 'Task3B: raiz ausente e violacao'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task3B: parser de links e varredura' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $scriptPath = Get-Mu99ScriptPath
    # Sem direitos: gating antes de qualquer toque no disco do cliente
    $failed = $false
    $msg = ''
    try { & $scriptPath -Mode 'PrepararCliente' -DestinationRoot $tmp -ServerAddress '203.0.113.10' 2>&1 | Out-String | ForEach-Object { $msg += $_ } } catch { $failed = $true; $msg += $_.Exception.Message }
    Assert-Mu99True -Condition ($failed -or ($msg -match 'ConfirmPrivateClientDistributionRights')) -Name 'Task3B: PrepararCliente sem direitos falha no gating'
    # Sem blob do cliente no staging: bloqueia antes do extrator
    $staged = Join-Path $tmp 'st1'
    New-Item -ItemType Directory -Path $staged | Out-Null
    $failed2 = $false
    try { & $scriptPath -Mode 'PrepararCliente' -DestinationRoot $staged -ServerAddress '203.0.113.10' -ConfirmPrivateClientDistributionRights 2>&1 | Out-Null } catch { $failed2 = ($_.Exception.Message -match 'RAR do cliente nao localizado') }
    Assert-Mu99True -Condition $failed2 -Name 'Task3B: PrepararCliente sem blob bloqueia antes do extrator'
    # client/ pre-existente: recusa sem tocar
    $staged2 = Join-Path $tmp 'st2'
    New-Item -ItemType Directory -Path (Join-Path $staged2 'client') -Force | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $staged2 'client\keep.txt'), 'keep')
    $failed3 = $false
    try { & $scriptPath -Mode 'PrepararCliente' -DestinationRoot $staged2 -ServerAddress '203.0.113.10' -ConfirmPrivateClientDistributionRights 2>&1 | Out-Null } catch { $failed3 = ($_.Exception.Message -match 'ja existe') }
    Assert-Mu99True -Condition $failed3 -Name 'Task3B: PrepararCliente com client/ existente recusa'
    Assert-Mu99True -Condition (([System.IO.File]::ReadAllText((Join-Path $staged2 'client\keep.txt'))) -eq 'keep') -Name 'Task3B: client/ pre-existente preservado'
    # Metade configuravel por funcoes: expansao do cliente + proposta de Config.ini
    $pkg = Join-Path $tmp 'nested-pkg.zip'
    New-Mu99NestedTestPackage -ZipPath $pkg
    $fake = New-Mu99FakeRarTool -Mode 'ok'
    $cliBlob = Join-Path $tmp 'cli-stage\[MUDevs - Free Release 2] Client 99b.rar'
    New-Item -ItemType Directory -Path (Split-Path -Parent $cliBlob) -Force | Out-Null
    [System.IO.File]::WriteAllBytes($cliBlob, [System.Text.Encoding]::ASCII.GetBytes('fake-client-rar'))
    $cliDir = Join-Path $tmp 'cli-out'
    $expCli = Expand-Mu99NestedArchive -RarPath $cliBlob -DestinationDir $cliDir -ListAdapter $fake.listAdapter -ExtractAdapter $fake.extractAdapter
    Assert-Mu99True -Condition (Test-Path -LiteralPath (Join-Path $cliDir 'Config.ini')) -Name 'Task3B: expansao do cliente expoe Config.ini (raiz removida)'
    # O extrator fake grava conteudo sintetico; aqui compomos o Config.ini real
    # (como dado) para provar a proposta sobre o cliente expandido.
    [System.IO.File]::WriteAllText((Join-Path $cliDir 'Config.ini'), "[MainInfo]`r`nIpAddress = TUIP`r`n")
    $srvRoot = Join-Path $tmp 'srv'
    New-Item -ItemType Directory -Path (Join-Path $srvRoot 'ConnectServer') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $srvRoot 'Data') -Force | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $srvRoot 'ConnectServer\ServerList.dat'), '"TUIP"')
    [System.IO.File]::WriteAllText((Join-Path $srvRoot 'Data\MapServerInfo.dat'), 'STUIP')
    $propCli = Get-Mu99ConfigProposal -ServerRoot $srvRoot -ClientRoot $cliDir -ServerAddress '203.0.113.10'
    Assert-Mu99True -Condition ((@($propCli.changes | Where-Object { $_.key -eq 'IpAddress' }).Count) -eq 1) -Name 'Task3B: proposta mira IpAddress do cliente expandido'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task3B: fluxo PrepararCliente' -Passed $false -Detail $_.Exception.Message
}

# ---------------------------------------------------------------
# Task 4B: guarda anti-link na escrita de configs (regressoes da revisao)
# ---------------------------------------------------------------
function New-Mu99Hardlink {
  param([string]$Target, [string]$LinkPath)
  $o = & fsutil hardlink create "$LinkPath" "$Target" 2>&1
  if ($LASTEXITCODE -ne 0) { throw ("fsutil hardlink create falhou: " + (@($o) -join "`n")) }
}

try {
  $tmp = New-Mu99TempDir
  try {
    $f1 = Join-Path $tmp 'normal.txt'
    [System.IO.File]::WriteAllText($f1, 'IpAddress = TUIP')
    Assert-Mu99True -Condition (Test-Mu99FileSafeForWrite -Path $f1) -Name 'Task4B: arquivo comum aprovado para escrita'
    Assert-Mu99True -Condition ((Get-Mu99FileLinkCount -Path $f1) -eq 1) -Name 'Task4B: contagem real de links = 1'
    # Hardlink real (fsutil, sem privilegio): escrita bloqueada
    $orig = Join-Path $tmp 'orig-hl.txt'
    [System.IO.File]::WriteAllText($orig, 'IpAddress = TUIP')
    $hl = Join-Path $tmp 'link-hl.txt'
    try {
      New-Mu99Hardlink -Target $orig -LinkPath $hl
      Assert-Mu99True -Condition ((Get-Mu99FileLinkCount -Path $hl) -eq 2) -Name 'Task4B: contagem real de links = 2'
      $blockedHl = $false
      try { Test-Mu99FileSafeForWrite -Path $hl | Out-Null } catch { $blockedHl = ($_.Exception.Message -match 'links') }
      Assert-Mu99True -Condition $blockedHl -Name 'Task4B: hardlink bloqueia escrita'
    } catch {
      Write-Mu99TestResult -Name 'Task4B: hardlink real (skip se fsutil indisponivel)' -Passed ($_.Exception.Message -match 'fsutil')
    }
    # Reparse via seam: bloqueia sem backup e sem tocar bytes
    $f2 = Join-Path $tmp 'quase-link.txt'
    [System.IO.File]::WriteAllText($f2, 'IpAddress = TUIP')
    $h2 = (Get-FileHash -LiteralPath $f2 -Algorithm SHA256).Hash
    $reparse = [System.IO.FileAttributes]::ReparsePoint
    $readerRp = { param([string]$P) return $reparse }.GetNewClosure()
    $blockedRp = $false
    try { Test-Mu99FileSafeForWrite -Path $f2 -AttributeReader $readerRp | Out-Null } catch { $blockedRp = ($_.Exception.Message -match 'reparse point') }
    Assert-Mu99True -Condition $blockedRp -Name 'Task4B: reparse point bloqueia escrita'
    Assert-Mu99Equal -Expected $h2 -Actual (Get-FileHash -LiteralPath $f2 -Algorithm SHA256).Hash -Name 'Task4B: bloqueio nao toca bytes'
    # Verificacao impossivel: falha fechada
    $runnerBoom = { param([string]$P) throw 'fsutil-fake-boom' }.GetNewClosure()
    $blockedUnv = $false
    try { Test-Mu99FileSafeForWrite -Path $f1 -FsutilRunner $runnerBoom | Out-Null } catch { $blockedUnv = ($_.Exception.Message -match 'Nao foi possivel verificar') }
    Assert-Mu99True -Condition $blockedUnv -Name 'Task4B: sem verificacao nao ha escrita'
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task4B: guarda de escrita unitario' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    # Fim a fim: proposta sobre fixture, alvo trocado por hardlink -> Set- bloqueia
    $srv = Join-Path $tmp 'server'
    $cli = Join-Path $tmp 'client'
    $out = Join-Path $tmp 'out'
    New-Item -ItemType Directory -Path $srv | Out-Null
    New-Item -ItemType Directory -Path $out | Out-Null
    Copy-Mu99ConfigFixtures -ServerRoot $srv -ClientRoot $cli
    $slPath = Join-Path $srv 'ConnectServer\ServerList.dat'
    $prop = Get-Mu99ConfigProposal -ServerRoot $srv -ClientRoot $cli -ServerAddress '203.0.113.10'
    Assert-Mu99True -Condition ($prop.blockers.Count -eq 0) -Name 'Task4B: proposta valida antes da troca'
    $slBytes = [System.IO.File]::ReadAllBytes($slPath)
    Remove-Item -LiteralPath $slPath -Force
    $donor = Join-Path $tmp 'doador.dat'
    [System.IO.File]::WriteAllBytes($donor, $slBytes)
    try {
      New-Mu99Hardlink -Target $donor -LinkPath $slPath
      $threwSet = $false
      try { Set-Mu99AddressConfiguration -Proposal $prop -DestinationRoot $out | Out-Null } catch { $threwSet = ($_.Exception.Message -match 'links') }
      Assert-Mu99True -Condition $threwSet -Name 'Task4B: Set- bloqueia alvo hardlink'
      Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $out 'backups'))) -Name 'Task4B: bloqueio ocorre antes de qualquer backup'
      Assert-Mu99True -Condition (([System.IO.File]::ReadAllText($slPath)) -match 'TUIP') -Name 'Task4B: conteudo hardlink intacto (nada escrito)'
    } catch {
      Write-Mu99TestResult -Name 'Task4B: Set- em hardlink (skip se fsutil indisponivel)' -Passed ($_.Exception.Message -match 'fsutil')
    }
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  Write-Mu99TestResult -Name 'Task4B: guarda de escrita fim a fim' -Passed $false -Detail $_.Exception.Message
}

# ---------------------------------------------------------------
# Task 6B: detector administrativo e colisao no firewall (revisao)
# ---------------------------------------------------------------
function New-Mu99FakeNetAdapters {
  param(
    [object[]]$Services = @(),
    [object[]]$Listeners = @(),
    [switch]$ServiceThrows,
    [switch]$ListenerThrows
  )
  $st = [pscustomobject]@{ svcs = $Services; lsts = $Listeners; sThrow = $ServiceThrows.IsPresent; lThrow = $ListenerThrows.IsPresent }
  $svcSb = {
    if ($st.sThrow) { throw 'fake-svc-boom' }
    return @($st.svcs)
  }.GetNewClosure()
  $lstSb = {
    if ($st.lThrow) { throw 'fake-lst-boom' }
    return @($st.lsts)
  }.GetNewClosure()
  return [pscustomobject]@{ state = $st; serviceAdapter = $svcSb; listenerAdapter = $lstSb }
}

try {
  # Detector: servicos conhecidos + customs + atribuicao de listeners
  $nets = New-Mu99FakeNetAdapters `
    -Services @(
      [pscustomobject]@{ name = 'MSSQL$SQLEXPRESS'; displayName = 'SQL Server (SQLEXPRESS)'; status = 'Running' },
      [pscustomobject]@{ name = 'FakeAdminSvc'; displayName = 'Fake Admin'; status = 'Running'; ports = @(55900) }
    ) `
    -Listeners @(
      [pscustomobject]@{ port = 3389; process = 'svchost' },
      [pscustomobject]@{ port = 55900; process = 'FakeAdminSvc' },
      [pscustomobject]@{ port = 55901; process = 'ConnectServer' },
      [pscustomobject]@{ port = 135; process = 'svchost' }
    )
  $obs = Get-Mu99ObservedAdminPorts -ServiceAdapter $nets.serviceAdapter -ListenerAdapter $nets.listenerAdapter
  Assert-Mu99True -Condition ((@($obs.servicePorts) -contains 1433) -and (@($obs.servicePorts) -contains 55900)) -Name 'Task6B: servicePorts une SQL conhecido e custom'
  Assert-Mu99True -Condition (@($obs.listeners).Count -eq 4) -Name 'Task6B: listeners registrados com processo'
  Assert-Mu99True -Condition ((@($obs.adminListenerPorts) -contains 3389) -and (@($obs.adminListenerPorts) -contains 55900) -and (@($obs.adminListenerPorts) -contains 135)) -Name 'Task6B: listeners admin entram na colisao'
  Assert-Mu99True -Condition (-not (@($obs.adminListenerPorts) -contains 55901)) -Name 'Task6B: listener do proprio piloto nao bloqueia'
  Assert-Mu99True -Condition ((@($obs.collisionPorts) -contains 1433) -and (@($obs.collisionPorts) -contains 55900)) -Name 'Task6B: collisionPorts une tudo'
  Assert-Mu99True -Condition ($obs.listenersVerified -and $obs.servicesVerified) -Name 'Task6B: flags de verificacao verdadeiras'
  # Nao verificavel: flags falsas
  $netsBad = New-Mu99FakeNetAdapters -ListenerThrows -ServiceThrows
  $obsBad = Get-Mu99ObservedAdminPorts -ServiceAdapter $netsBad.serviceAdapter -ListenerAdapter $netsBad.listenerAdapter
  Assert-Mu99True -Condition ((-not $obsBad.listenersVerified) -and (-not $obsBad.servicesVerified)) -Name 'Task6B: falha de coleta marca nao verificado'
  Assert-Mu99True -Condition ((@($obsBad.collisionPorts) -contains 1433) -and (@($obsBad.collisionPorts) -contains 3389)) -Name 'Task6B: well-known persistem mesmo sem coleta'
} catch {
  Write-Mu99TestResult -Name 'Task6B: detector administrativo' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $scriptPath = Get-Mu99ScriptPath
    # Colisao well-known e deterministica sem nenhum seam: 3389 sempre no conjunto.
    $outW = Join-Path $tmp 'fw-wellknown'
    $threwW = $false
    try { & $scriptPath -Mode PlanoFirewall -ApprovedGamePorts @(3389) -DestinationRoot $outW 2>&1 | Out-Null } catch { $threwW = ($_.Exception.Message -match 'colidem') }
    Assert-Mu99True -Condition $threwW -Name 'Task6B: PlanoFirewall recusa 3389 (colisao well-known)'
    Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $outW 'reports'))) -Name 'Task6B: recusa well-known nao cria relatorio'
    # Seam via env (os modos via & nao enxergam $script:): porta custom observada.
    [System.Environment]::SetEnvironmentVariable('MU99_TEST_EXTRA_ADMIN_PORTS', '55900')
    try {
      $outC = Join-Path $tmp 'fw-colide'
      $threwC = $false
      try { & $scriptPath -Mode PlanoFirewall -ApprovedGamePorts @(55900) -DestinationRoot $outC 2>&1 | Out-Null } catch { $threwC = ($_.Exception.Message -match 'colidem') }
      Assert-Mu99True -Condition $threwC -Name 'Task6B: PlanoFirewall recusa colisao com servico observado'
      Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $outC 'reports'))) -Name 'Task6B: recusa nao cria relatorio'
      # Sem colisao: plano sai com observacoes no relatorio (listener proprio ok).
      # (-Confirm:$false pois o dispatch filho pediria confirmacao.)
      $outO = Join-Path $tmp 'fw-ok'
      & $scriptPath -Mode PlanoFirewall -ApprovedGamePorts @(55901) -ApprovedProtocols @('TCP') -DestinationRoot $outO -Confirm:$false 2>&1 | Out-Null
      $repFile = @(Get-ChildItem -LiteralPath (Join-Path $outO 'reports') -Filter *.json -ErrorAction SilentlyContinue)
      Assert-Mu99True -Condition (@($repFile).Count -eq 1) -Name 'Task6B: plano sem colisao gera relatorio'
      $repTxt = [System.IO.File]::ReadAllText((@($repFile)[0].FullName))
      Assert-Mu99True -Condition (($repTxt -match '55900') -and ($repTxt -match 'collisionPorts')) -Name 'Task6B: relatorio inclui observacoes administrativas'
      # AplicarFirewall com colisao: recusa antes de elevacao/regras (nada tocado).
      $outA = Join-Path $tmp 'fw-apply'
      $threwA = $false
      try { & $scriptPath -Mode AplicarFirewall -ApprovedGamePorts @(55900) -DestinationRoot $outA 2>&1 | Out-Null } catch { $threwA = ($_.Exception.Message -match 'colidem') }
      Assert-Mu99True -Condition $threwA -Name 'Task6B: AplicarFirewall recusa colisao antes de regras'
      Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $outA 'state'))) -Name 'Task6B: recusa nao cria estado/manifesto'
    } finally {
      [System.Environment]::SetEnvironmentVariable('MU99_TEST_EXTRA_ADMIN_PORTS', $null)
    }
    # Nao verificavel: bloqueia mesmo com portas limpas (deterministico via seam).
    [System.Environment]::SetEnvironmentVariable('MU99_TEST_FORCE_LISTENERS_UNVERIFIED', '1')
    try {
      $outV = Join-Path $tmp 'fw-unver'
      $threwV = $false
      try { & $scriptPath -Mode PlanoFirewall -ApprovedGamePorts @(55901) -DestinationRoot $outV 2>&1 | Out-Null } catch { $threwV = ($_.Exception.Message -match 'verificados') }
      Assert-Mu99True -Condition $threwV -Name 'Task6B: sem verificacao nao ha plano'
      Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $outV 'reports'))) -Name 'Task6B: bloqueio nao cria relatorio'
    } finally {
      [System.Environment]::SetEnvironmentVariable('MU99_TEST_FORCE_LISTENERS_UNVERIFIED', $null)
    }
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  [System.Environment]::SetEnvironmentVariable('MU99_TEST_EXTRA_ADMIN_PORTS', $null)
  [System.Environment]::SetEnvironmentVariable('MU99_TEST_FORCE_LISTENERS_UNVERIFIED', $null)
  Write-Mu99TestResult -Name 'Task6B: modos com colisao (sem tocar firewall)' -Passed $false -Detail $_.Exception.Message
}

# ---------------------------------------------------------------
# Task 1B/7: sem promessa falsa + guia fiel ao script
# ---------------------------------------------------------------
try {
  $scriptPath = Get-Mu99ScriptPath
  $tokens = $null; $errors = $null
  $ast = [System.Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$tokens, [ref]$errors)
  $paramNames = @($ast.ParamBlock.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath })
  Assert-Mu99True -Condition (-not ($paramNames -contains 'AllowPlaintextLegacyDbCredentials')) -Name 'Task1B: switch de credencial legada removido do script'
  $scriptText = [System.IO.File]::ReadAllText($scriptPath)
  Assert-Mu99True -Condition (-not ($scriptText -match 'AllowPlaintextLegacyDbCredentials')) -Name 'Task1B: nenhuma referencia restante no script'
  $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  $guidePath = Join-Path $repoRoot 'mu99-vps\GUIA-EXECUCAO-MU-V99.md'
  Assert-Mu99True -Condition (Test-Path -LiteralPath $guidePath) -Name 'Task7: guia existe no repo'
  $guide = [System.IO.File]::ReadAllText($guidePath)
  Assert-Mu99True -Condition (-not ($guide -match 'AllowPlaintextLegacyDbCredentials')) -Name 'Task7: guia sem promessa falsa de opt-in'
  Assert-Mu99True -Condition ($guide -match 'etapa manual bloqueada') -Name 'Task7: guia marca credencial legada como etapa manual'
  Assert-Mu99True -Condition (($guide -match 'libraries/') -and ($guide -match 'server/') -and ($guide -match 'client/')) -Name 'Task7: guia reflete layout segregado'
  Assert-Mu99True -Condition ($guide -match 'listenersVerified|nao pud[ie]rem ser verificados|nao verificavel|listeners nao verificaveis') -Name 'Task7: guia documenta verificacao de listeners'
} catch {
  Write-Mu99TestResult -Name 'Task1B/7: consistencia script-guia' -Passed $false -Detail $_.Exception.Message
}

# ---------------------------------------------------------------
# Task 6C: listener sem dono fail-closed + services explicito (revisao)
# ---------------------------------------------------------------
try {
  # Unidade: dono desconhecido entra em unknownOwnerPorts e derruba a flag.
  $netsU = New-Mu99FakeNetAdapters `
    -Listeners @(
      [pscustomobject]@{ port = 55901; process = '' },
      [pscustomobject]@{ port = 55902; process = 'ConnectServer' }
    )
  $obsU = Get-Mu99ObservedAdminPorts -ServiceAdapter $netsU.serviceAdapter -ListenerAdapter $netsU.listenerAdapter
  Assert-Mu99True -Condition ((@($obsU.unknownOwnerPorts).Count -eq 1) -and (@($obsU.unknownOwnerPorts)[0] -eq 55901)) -Name 'Task6C: porta sem dono rastreada'
  Assert-Mu99True -Condition (-not $obsU.listenersIdentityVerified) -Name 'Task6C: identidade incompleta derruba flag'
  Assert-Mu99True -Condition (@($obsU.collisionPorts) -contains 55901) -Name 'Task6C: dono desconhecido entra na colisao'
  Assert-Mu99True -Condition (-not (@($obsU.collisionPorts) -contains 55902)) -Name 'Task6C: dono conhecido nao entra na colisao'
  # Unidade: tudo identificado mantem a flag.
  $netsK = New-Mu99FakeNetAdapters -Listeners @([pscustomobject]@{ port = 55901; process = 'ConnectServer' })
  $obsK = Get-Mu99ObservedAdminPorts -ServiceAdapter $netsK.serviceAdapter -ListenerAdapter $netsK.listenerAdapter
  Assert-Mu99True -Condition ($obsK.listenersIdentityVerified -and (@($obsK.unknownOwnerPorts).Count -eq 0)) -Name 'Task6C: donos conhecidos mantem flag'
} catch {
  Write-Mu99TestResult -Name 'Task6C: detector de dono desconhecido' -Passed $false -Detail $_.Exception.Message
}

try {
  $tmp = New-Mu99TempDir
  try {
    $scriptPath = Get-Mu99ScriptPath
    # Dono desconhecido na porta aprovada: ambos os modos recusam sem gravar/aplicar.
    [System.Environment]::SetEnvironmentVariable('MU99_TEST_LISTENERS_JSON', '[{"port":55901,"process":""},{"port":55902,"process":"ConnectServer"}]')
    try {
      $outP = Join-Path $tmp 'fw-unk-plan'
      $threwP = $false
      try { & $scriptPath -Mode PlanoFirewall -ApprovedGamePorts @(55901) -DestinationRoot $outP 2>&1 | Out-Null } catch { $threwP = ($_.Exception.Message -match 'desconhecido') }
      Assert-Mu99True -Condition $threwP -Name 'Task6C: PlanoFirewall recusa porta com dono desconhecido'
      Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $outP 'reports'))) -Name 'Task6C: recusa nao grava relatorio'
      $outA = Join-Path $tmp 'fw-unk-apply'
      $threwA = $false
      try { & $scriptPath -Mode AplicarFirewall -ApprovedGamePorts @(55901) -DestinationRoot $outA 2>&1 | Out-Null } catch { $threwA = ($_.Exception.Message -match 'desconhecido') }
      Assert-Mu99True -Condition $threwA -Name 'Task6C: AplicarFirewall recusa porta com dono desconhecido'
      Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $outA 'state'))) -Name 'Task6C: recusa nao aplica nem grava estado'
    } finally {
      [System.Environment]::SetEnvironmentVariable('MU99_TEST_LISTENERS_JSON', $null)
    }
    # Dono conhecido (proprio piloto) nao bloqueia.
    [System.Environment]::SetEnvironmentVariable('MU99_TEST_LISTENERS_JSON', '[{"port":55901,"process":"ConnectServer"}]')
    try {
      $outK = Join-Path $tmp 'fw-known'
      & $scriptPath -Mode PlanoFirewall -ApprovedGamePorts @(55901) -ApprovedProtocols @('TCP') -DestinationRoot $outK -Confirm:$false 2>&1 | Out-Null
      $repK = @(Get-ChildItem -LiteralPath (Join-Path $outK 'reports') -Filter *.json -ErrorAction SilentlyContinue)
      Assert-Mu99True -Condition (@($repK).Count -eq 1) -Name 'Task6C: dono conhecido nao bloqueia o plano'
    } finally {
      [System.Environment]::SetEnvironmentVariable('MU99_TEST_LISTENERS_JSON', $null)
    }
    # servicesVerified=false bloqueia explicitamente, mesmo com portas limpas.
    [System.Environment]::SetEnvironmentVariable('MU99_TEST_LISTENERS_JSON', '[{"port":55901,"process":"ConnectServer"}]')
    [System.Environment]::SetEnvironmentVariable('MU99_TEST_FORCE_SERVICES_UNVERIFIED', '1')
    try {
      $outS = Join-Path $tmp 'fw-svc'
      $threwS = $false
      try { & $scriptPath -Mode PlanoFirewall -ApprovedGamePorts @(55901) -DestinationRoot $outS 2>&1 | Out-Null } catch { $threwS = ($_.Exception.Message -match 'Servicos') }
      Assert-Mu99True -Condition $threwS -Name 'Task6C: services nao verificado bloqueia o plano'
      Assert-Mu99True -Condition (-not (Test-Path -LiteralPath (Join-Path $outS 'reports'))) -Name 'Task6C: bloqueio de services nao grava relatorio'
    } finally {
      [System.Environment]::SetEnvironmentVariable('MU99_TEST_LISTENERS_JSON', $null)
      [System.Environment]::SetEnvironmentVariable('MU99_TEST_FORCE_SERVICES_UNVERIFIED', $null)
    }
  } finally { Remove-Mu99TempDir -Dir $tmp }
} catch {
  [System.Environment]::SetEnvironmentVariable('MU99_TEST_LISTENERS_JSON', $null)
  [System.Environment]::SetEnvironmentVariable('MU99_TEST_FORCE_SERVICES_UNVERIFIED', $null)
  Write-Mu99TestResult -Name 'Task6C: modos com dono desconhecido (sem tocar firewall)' -Passed $false -Detail $_.Exception.Message
}

Write-Output ("TOTAL PASS=" + $script:Mu99PassCount + " FAIL=" + $script:Mu99FailCount)
if ($script:Mu99FailCount -gt 0) { exit 1 } else { exit 0 }
