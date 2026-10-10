# Especificação — automação segura da VPS para MU Online v99b

**Status:** aprovada pelo proprietário; fonte de requisitos para o plano de implementação.

## Objetivo

Preparar um script PowerShell e um guia para conduzir a implantação do pacote MuDevs Free - Release II Files 99b em uma VPS Windows Server 2019, até um piloto privado jogável pelo proprietário e alguns amigos. O fluxo deve automatizar o que pode ser feito com segurança, identificar o que exige decisão humana e parar em dependências não confirmadas, sem declarar o servidor jogável antes de testes com clientes externos.

## Contexto confirmado e premissas

- VPS informada: Windows Server 2019 Standard, 2 vCPUs Xeon E5-2650 v2, 4 GB RAM e aproximadamente 39,46 GB de disco total. Espaço livre, IP público, rede do provedor e existência de SQL ainda precisam ser medidos na VPS.
- O pacote entregue é um ZIP com três RARs internos: arquivos do servidor, cliente 99b e bibliotecas. A listagem anterior identificou `DB\MuOnline.bak`, executáveis ConnectServer/DataServer/JoinServer/GameServer, arquivos de configuração do servidor/cliente e um `.bak` que não é banco em `StartUp`.
- O script anterior gerado por Grok foi revisado estaticamente e não será reutilizado nem executado: ele instala dependências por suposição, cria exclusões do Defender, altera regras de firewall, percorre arquivos de configuração e procura/restaura qualquer `.bak`.
- A publicação comunitária da release é referência não oficial. O nome “SQL Server 2012 R2” nela está incorreto/ambíguo e não é base suficiente para instalação automática.
- O repositório de destino é `jhonybucker/MuReborn`, clonado localmente na branch `main`; ele continha apenas `README.md` no início deste trabalho. Use esse repositório como raiz e mantenha a implantação MU isolada em `mu99-vps/`.

## Abordagens consideradas

1. **Instalador de uma etapa:** tentaria instalar SQL e runtimes, importar banco, editar configurações, abrir portas e criar inicialização automática. Rejeitada porque os requisitos reais dos executáveis ainda não foram confirmados e os efeitos do script anterior mostram o risco de mudanças não revisadas.
2. **Orquestrador PowerShell em etapas (recomendado):** começa por diagnóstico somente leitura; cada fase mutável é explícita, tem pré-condições, cópia de segurança, `ShouldProcess`/`-WhatIf` quando aplicável e relatório redigido. Pode ser interrompido em qualquer bloqueio. Esta é a abordagem especificada abaixo.
3. **Runbook apenas manual:** reduz a automação e ainda deixa o operador sujeito a repetir comandos. Será mantido um guia, mas como complemento do orquestrador, não como único entregável.

## Entregáveis

- `mu99-vps/Install-MU99-Safe.ps1`: script executado manualmente na VPS pelo proprietário, compatível com Windows PowerShell 5.1 fornecido no Windows Server 2019. Sem execução remota ou conexão iniciada por Codex/OpenCode.
- `mu99-vps/GUIA-EXECUCAO-MU-V99.md`: comandos de cada fase, decisões necessárias, verificação, rollback, critérios de parada e testes manuais. Esta pasta mantém a implantação isolada do protótipo web Three.js existente no workspace.
- Relatórios produzidos em uma pasta de saída escolhida pelo operador: diagnóstico, inventário, portas planejadas e resumo de cada execução, sempre sem senhas ou tokens.

## Interface e fases do script

O parâmetro `-Mode` é opcional e assume `Diagnostico`, que é somente leitura. Os caminhos do ZIP e destino serão argumentos explícitos; não haverá dependência de uma unidade `D:` ou caminho presumido.

| Modo | Comportamento | Efeitos e barreiras |
|---|---|---|
| `Diagnostico` | Lê versão do Windows/PowerShell, RAM e disco livres, serviços/instâncias SQL detectáveis, arquivos e hashes do pacote; quando houver 7-Zip/WinRAR já instalado, lista também os arquivos internos dos RARs sem extraí-los. Registra assinaturas dos executáveis já extraídos; para executáveis ainda compactados, marca a assinatura como pendente até o staging. Também coleta portas configuradas que puder identificar. Gera inventário sem segredos. | Modo padrão, sem admin quando possível, sem extrair, instalar, iniciar, editar, restaurar ou alterar firewall. Senhas encontradas são mascaradas. |
| `PrepararArquivos` | Valida o ZIP e extrai para diretório de staging escolhido, usando 7-Zip/WinRAR já instalado se necessário para os RARs aninhados. Preserva originais e separa servidor, bibliotecas e cliente. | Sem baixar ou executar extratores/arquivos do pacote. Bloqueia caminhos de extração fora do destino, falta de espaço e falha de validação. Não cria exclusões do Defender. |
| `ValidarDependencias` | Compara serviços SQL e runtimes instalados com o que os arquivos/configuração e metadados indicarem. Analisa assinatura, versão/arquitetura aparente e metadados do backup quando a ferramenta necessária estiver disponível. | Não instala SQL, runtimes, drivers nem atualizações. Se o requisito for ambíguo, relata bloqueio e pede decisão fora do script. |
| `Configurar` | Gera uma proposta/diff para endereço do servidor, caminhos e valores de configuração em arquivos específicos que tenham sido identificados. Após confirmação, salva cópias de segurança e altera somente chaves suportadas. | Nunca faz busca/substituição recursiva em todos os `.ini`, `.txt`, `.cfg`, `.dat` ou `.xml`. Falha em vez de adivinhar se chave/arquivo mudar. Registra alterações sem segredos. |
| `Banco` | Confere a existência do SQL escolhido, testa a conexão local, verifica o backup `DB\MuOnline.bak` e restaura apenas esse arquivo após `RESTORE VERIFYONLY` e backup prévio do banco existente, caso exista. | Nunca instala SQL. Nunca procura/restaura todos os `*.bak`. Exige instância explícita e uma opção explícita de sobrescrita para nome de banco já existente; sem a opção, aborta sem modificar o banco. Credenciais são solicitadas interativamente, não aceitas em linha de comando/log. |
| `PrepararCliente` | Prepara uma cópia do cliente em staging e propõe a alteração do endereço em `Config.ini` somente se o formato suportado for reconhecido. | Não publica nem distribui arquivos. Exige confirmação de direitos de uso antes de preparar uma cópia para compartilhamento. Preserva o cliente original. |
| `Iniciar` | Confere pré-condições e inicia somente componentes com caminhos e ordem confirmados, em seus diretórios de trabalho. Registra PID, horário e resultado de inicialização; aponta logs. | Exige confirmação interativa antes de executar binários da release. Nunca executa `.bat`, `.cmd`, `.ps1` ou qualquer instalador automaticamente. Não cria tarefa agendada, serviço ou auto-start. |
| `PlanoFirewall` | Produz a lista de regras que seria aplicada, correlacionando configurações/portas escutadas e a lista de portas fornecida/revisada pelo operador. | Somente leitura; não presume que portas comunitárias sejam as usadas por esta cópia. Proíbe portas SQL/RDP. |
| `AplicarFirewall` | Cria regras de entrada nomeadas com prefixo exclusivo do script para portas do jogo confirmadas e informadas explicitamente pelo operador. | Requer PowerShell elevado e confirmação explícita. Sem portas confirmadas, não altera firewall. Nunca altera regras existentes, não abre SQL/RDP, não remove regras alheias e não configura firewall do provedor. |
| `ReverterFirewall` | Remove somente regras criadas pelo próprio script e listadas no seu manifesto local. | Exige confirmação; não mexe em regras preexistentes nem em regras cujo nome não corresponda exatamente ao manifesto. |

Todos os modos mutáveis devem implementar `SupportsShouldProcess`, apresentar alvo/efeito antes de cada mudança e respeitar `-WhatIf`/`-Confirm`. Modo de diagnóstico não pode acidentalmente cair num caminho mutável.

## Banco e compatibilidade

- A versão exigida pelo GameServer/JoinServer/ConnectServer deve ser identificada em documentação, arquivos de configuração, strings/dependências e testes de conexão. A mera possibilidade de restaurar um `.bak` em uma versão nova do SQL não comprova compatibilidade do executável ou do driver.
- A matriz da Microsoft consultada lista Windows Server 2019 como compatível com SQL Server 2012 SP4 e versões mais novas, mas não suporta SQL Server 2008 R2/2008 nessa combinação. A Microsoft encerrou o suporte estendido do SQL Server 2012 em julho de 2022. Assim, nenhum modo do script instalará SQL 2008/R2/2012 automaticamente. A instalação de qualquer versão será uma ação manual posterior a uma decisão de compatibilidade/licença; o script pode voltar a validar a instância depois.
- SQL Server 2019 pode restaurar backups SQL Server 2008 ou posteriores sob condições de compatibilidade do backup, mas isso não elimina o teste do driver/conexão usado pelos executáveis legados.
- Referências primárias: [matriz SQL Server/Windows](https://learn.microsoft.com/pt-br/troubleshoot/sql/database-engine/install/windows/use-sql-server-in-windows), [ciclo de vida do SQL Server 2012](https://learn.microsoft.com/en-us/lifecycle/products/microsoft-sql-server-2012), [restauração/migração para SQL Server 2019](https://learn.microsoft.com/en-us/sql/database-engine/install-windows/supported-version-and-edition-upgrades-2019?view=sql-server-ver17).

## Segurança, dados e rollback

- Não solicitar nem imprimir senha de RDP, SQL ou jogador. Não aceitar segredos em argumentos de processo. Para campos que o software legado só aceite em texto claro, documentar essa limitação, gravar a configuração com ACL restrita e omitir os valores de logs/relatórios.
- Não desativar Microsoft Defender, não adicionar exclusões, não baixar executáveis e não executar binários silenciosamente. Uma detecção ou origem não verificável para o pacote interrompe o fluxo para avaliação humana.
- Copiar o pacote original para staging sem sobrescrevê-lo. Antes de edição, exportar cópia do arquivo exato com timestamp/hash. Antes de sobrescrever banco, fazer backup e verificar que o backup gerado pode ser lido. Não apagar automaticamente dados, logs, bancos, instaladores nem arquivos antigos.
- As regras de firewall criadas pelo script devem ter nomes determinísticos, comentário de propósito, protocolo explícito e porta específica; guardar inventário para reversão.
- Relatórios devem registrar modo, início/fim, checks, arquivos alterados, hashes dos backups e comandos/resultados relevantes, sem transcript bruto de entrada sensível.
- O script não vai ajustar configurações do provedor, DNS, NAT, RDP, política de conta, antivírus, atualizações do Windows, instalação SQL, nem compartilhamento externo de arquivos. O guia explicará essas ações manuais e as barreiras.

## Critérios de aceitação

1. Executar `Diagnostico` não altera arquivos de entrada existentes, serviços, banco, firewall ou Defender; pode criar um novo relatório mascarado.
2. Preparação recusa arquivo ausente/corrompido, extrator não disponível, espaço insuficiente e tentativa de path traversal; preserva os arquivos originais.
3. Configuração apresenta exatamente as chaves/arquivos a modificar, faz backup verificável e não toca em chaves não reconhecidas.
4. Banco só seleciona `DB\MuOnline.bak`; valida-o antes da restauração; recusa sobrescrita sem opção explícita e mantém backup do estado anterior.
5. SQL, instaladores de runtime e programas empacotados nunca são instalados/executados implicitamente.
6. `-WhatIf` não realiza mudanças. Alterações reais requerem alvo visível e confirmação.
7. Firewall não abre nenhuma porta em `PlanoFirewall`, nem aceita 1433/1434 SQL, 3389 RDP ou portas não explicitamente aprovadas; reversão preserva regras alheias.
8. Start respeita a ordem confirmada e não cria inicialização automática de alto privilégio.
9. O guia cobre rollback, configuração manual do firewall no provedor, backup/restauração, distribuição do cliente e procedimento de incidente.
10. O servidor só pode ser descrito como “jogável” após login externo, criação/entrada de personagem, jogo básico, persistência após reconexão/reinício, backup testado e piloto com 2–5 jogadores por aproximadamente 2 horas, medindo recursos e desconexões. A faixa e duração são metas de validação, não garantia de capacidade da VPS. A inspeção do script não substitui esses testes.

## Não objetivos

- Conectar-se à VPS, operar RDP ou alterar qualquer configuração real durante a criação dos artefatos.
- Fazer download/instalação automática de SQL, runtime, WinRAR/7-Zip ou componentes de terceiros.
- Corrigir, modificar ou assinar os executáveis do pacote, adicionar anti-cheat, criar site/launcher/loja ou abrir o servidor ao público.
- Distribuir cliente ou conteúdo sem confirmação de direito de uso.
- Garantir capacidade de 3–5 jogadores somente pelas especificações da VPS; ela precisa ser medida no piloto.

## Questões e bloqueios que o diagnóstico deve resolver

- Quanto espaço livre e RAM disponível existe hoje na VPS?
- Já existe instância SQL instalada? Qual versão/edição, modo de autenticação e memória configurada?
- Qual versão de SQL/driver os binários realmente requerem e o GameServer consegue usar a opção compatível disponível?
- Qual é o IP público estável, qual opção de acesso será escolhida (VPN ou portas de jogo públicas) e que firewall externo o provedor oferece?
- Os arquivos podem ser hospedados e o cliente compartilhado privadamente com os participantes?
- As bibliotecas necessárias já estão presentes e os binários são detectados pelo Defender?

O script deve gerar uma lista dessas respostas sem inventá-las; as questões de compatibilidade, segurança ou direito de uso são bloqueios, não defaults.
