param(
    [string]$MsiPath = "",
    [string]$LogDirectory = "",
    [string]$EvidenceOutputPath = "",
    [string]$TaskName = "MTI Alert Agent",
    [string]$UpdaterServiceName = "MTI.Alert.Updater",
    [bool]$ResetIdentityOverrides = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-IsAdministrator {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($currentIdentity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-Administrator {
    if (-not (Test-IsAdministrator)) {
        throw "Install must be run from an elevated PowerShell session."
    }
}

function Invoke-Schtasks {
    param(
        [Parameter(Mandatory = $true)][string[]] $Arguments
    )

    $escapedArgs = $Arguments | ForEach-Object {
        if ($_ -match '\s|"') {
            '"' + ($_ -replace '"', '\"') + '"'
        } else {
            $_
        }
    }

    $cmdLine = '"' + "$env:WINDIR\System32\schtasks.exe" + '" ' + ($escapedArgs -join ' ')
    $output = & "$env:WINDIR\System32\cmd.exe" /c $cmdLine 2>&1
    $exitCode = $LASTEXITCODE

    return [pscustomobject]@{
        ExitCode = $exitCode
        Output   = ($output | Out-String).Trim()
    }
}

function Get-TaskVerbose {
    param(
        [Parameter(Mandatory = $true)][string]$Name
    )

    return Invoke-Schtasks -Arguments @("/Query", "/TN", $Name, "/V", "/FO", "LIST")
}

function Get-TaskXml {
    param(
        [Parameter(Mandatory = $true)][string]$Name
    )

    return Invoke-Schtasks -Arguments @("/Query", "/TN", $Name, "/XML")
}

function Ensure-InteractiveStartupTask {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$ExecutablePath
    )

    $delete = Invoke-Schtasks -Arguments @("/Delete", "/F", "/TN", $Name)
    $null = $delete

    $create = Invoke-Schtasks -Arguments @(
        "/Create",
        "/F",
        "/TN", $Name,
        "/SC", "ONLOGON",
        "/RU", "INTERACTIVE",
        "/IT",
        "/RL", "LIMITED",
        "/TR", ('"{0}"' -f $ExecutablePath)
    )

    if ($create.ExitCode -ne 0) {
        throw "Failed to create INTERACTIVE scheduled task. ExitCode=$($create.ExitCode). Output=$($create.Output)"
    }
}

function Invoke-Msi {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$LogName
    )

    if (-not (Test-Path $MsiPath)) {
        throw "MSI not found: $MsiPath"
    }

    New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
    $logPath = Join-Path $LogDirectory $LogName
    $fullArguments = @($Arguments + @("/L*v", $logPath))

    Write-Output ("Running: msiexec.exe {0}" -f ($fullArguments -join " "))
    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $fullArguments -Wait -PassThru

    if ($process.ExitCode -ne 0) {
        throw "MSI command failed with exit code $($process.ExitCode). See log: $logPath"
    }

    Write-Output "MSI command completed successfully. Log: $logPath"
}

if ([string]::IsNullOrWhiteSpace($MsiPath)) {
    $MsiPath = Join-Path $PSScriptRoot "MTI.Alert.Agent\Installer\MTI.Alert.Agent.Setup\bin\Release\MTI.Alert.Agent.Setup.msi"
}

if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
    $LogDirectory = Join-Path $PSScriptRoot "MTI.Alert.Agent\Installer\validation-logs"
}

if ([string]::IsNullOrWhiteSpace($EvidenceOutputPath)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $EvidenceOutputPath = Join-Path $PSScriptRoot ("MTI.Alert.Agent\Installer\validation-evidence-install-run-{0}.json" -f $timestamp)
}

$collectEvidenceScript = Join-Path $PSScriptRoot "MTI.Alert.Agent\Installer\collect-install-evidence.ps1"
$expectedAgentExe = "C:\Program Files\MTI\MTI.Alert.Agent\MTI.Alert.Agent.exe"
function Reset-InstalledAppSettingsOverrides {
    param(
        [Parameter(Mandatory = $true)][string]$AgentExePath
    )

    $appSettingsPath = Join-Path (Split-Path $AgentExePath -Parent) "appsettings.json"
    if (-not (Test-Path $appSettingsPath)) {
        return
    }

    $config = Get-Content -Raw $appSettingsPath | ConvertFrom-Json
    if ($null -eq $config.Client) {
        return
    }

    $config.Client.DeviceIdentifierOverride = ""
    $config.Client.HostnameOverride = ""
    $config | ConvertTo-Json -Depth 10 | Set-Content -Path $appSettingsPath -Encoding UTF8
}

Assert-Administrator

Write-Host "================================================================" -ForegroundColor Magenta
Write-Host " INSTALL + RUN (TESTING)" -ForegroundColor Magenta
Write-Host "================================================================" -ForegroundColor Magenta

Get-Process MTI.Alert.Agent -ErrorAction SilentlyContinue | Stop-Process -Force

Invoke-Msi -Arguments @("/i", $MsiPath, "/qn", "/norestart") -LogName "install.log"

Start-Sleep -Seconds 2

if ($ResetIdentityOverrides -and (Test-Path $expectedAgentExe)) {
    Reset-InstalledAppSettingsOverrides -AgentExePath $expectedAgentExe
}

$svc = Get-Service -Name $UpdaterServiceName -ErrorAction SilentlyContinue
if ($null -eq $svc) {
    throw "Updater service not found after install: $UpdaterServiceName"
}

if ($svc.Status -ne "Running") {
    Start-Service -Name $UpdaterServiceName
    Start-Sleep -Seconds 2
}

$queryTask = Invoke-Schtasks -Arguments @("/Query", "/TN", $TaskName)
if ($queryTask.ExitCode -ne 0) {
    throw "Scheduled Task not found after install. ExitCode=$($queryTask.ExitCode). Output=$($queryTask.Output)"
}

$taskInfoBefore = Get-TaskVerbose -Name $TaskName
$taskXmlBefore = Get-TaskXml -Name $TaskName

$runTask = Invoke-Schtasks -Arguments @("/Run", "/TN", $TaskName)
if ($runTask.ExitCode -ne 0) {
    throw "Failed to run scheduled task. ExitCode=$($runTask.ExitCode). Output=$($runTask.Output)"
}

Start-Sleep -Seconds 3

$agentProcess = Get-Process MTI.Alert.Agent -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $agentProcess) {
    Write-Host "[WARN] Tray process MTI.Alert.Agent.exe not detected after starting scheduled task." -ForegroundColor Yellow
    $taskInfoAfter = Get-TaskVerbose -Name $TaskName

    if (Test-Path $expectedAgentExe) {
        Write-Host "[INFO] Recreating Scheduled Task using INTERACTIVE principal for tray startup..." -ForegroundColor Yellow
        Ensure-InteractiveStartupTask -Name $TaskName -ExecutablePath $expectedAgentExe
        $runTask2 = Invoke-Schtasks -Arguments @("/Run", "/TN", $TaskName)
        $null = $runTask2
        Start-Sleep -Seconds 3
        $agentProcess2 = Get-Process MTI.Alert.Agent -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -eq $agentProcess2) {
            Write-Host "[WARN] Tray process still not detected after recreating task as INTERACTIVE." -ForegroundColor Yellow
        } else {
            Write-Host ("[OK] Tray process running after task recreation. PID={0}" -f $agentProcess2.Id) -ForegroundColor Green
        }
    }
} else {
    Write-Host ("[OK] Tray process running. PID={0}" -f $agentProcess.Id) -ForegroundColor Green
}

& $collectEvidenceScript -OutputPath $EvidenceOutputPath

try {
    $diagPath = [System.IO.Path]::ChangeExtension($EvidenceOutputPath, ".task-diagnostics.json")
    $diag = [pscustomobject]@{
        CollectedAt = (Get-Date).ToString("o")
        TaskName = $TaskName
        TaskQueryBefore = $taskInfoBefore
        TaskXmlBefore = $taskXmlBefore
        TaskQueryAfter = if ($null -ne $taskInfoAfter) { $taskInfoAfter } else { $null }
    }
    $diag | ConvertTo-Json -Depth 6 | Set-Content -Path $diagPath -Encoding UTF8
    Write-Host ("Task diagnostics written to: {0}" -f $diagPath) -ForegroundColor Cyan
} catch {
    Write-Host "[WARN] Failed to write task diagnostics file." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Evidence written to: $EvidenceOutputPath" -ForegroundColor Cyan
