param(
    [string]$MsiPath = "",
    [string]$LogDirectory = "",
    [string]$EvidenceOutputPath = ""
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
        throw "Repair must be run from an elevated PowerShell session."
    }
}

function Get-InstalledProductEntry {
    param(
        [Parameter(Mandatory = $true)][string]$ExpectedProductName
    )

    $registryPaths = @(
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )

    foreach ($registryPath in $registryPaths) {
        $entry = Get-ItemProperty $registryPath -ErrorAction SilentlyContinue |
            Where-Object {
                $displayNameProperty = $_.PSObject.Properties["DisplayName"]
                $productCodeProperty = $_.PSObject.Properties["PSChildName"]
                $displayName = if ($null -ne $displayNameProperty) { $displayNameProperty.Value } else { $null }
                $productCode = if ($null -ne $productCodeProperty) { $productCodeProperty.Value } else { $null }

                $displayName -eq $ExpectedProductName -and $productCode -match '^\{[0-9A-F\-]+\}$'
            } |
            Select-Object -First 1

        if ($null -ne $entry) {
            return $entry
        }
    }

    return $null
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
    $EvidenceOutputPath = Join-Path $PSScriptRoot ("MTI.Alert.Agent\Installer\validation-evidence-repair-{0}.json" -f $timestamp)
}

$expectedProductName = "MTI Alert Agent"
$collectEvidenceScript = Join-Path $PSScriptRoot "MTI.Alert.Agent\Installer\collect-install-evidence.ps1"

Assert-Administrator

Get-Process MTI.Alert.Agent -ErrorAction SilentlyContinue | Stop-Process -Force

$installedProduct = Get-InstalledProductEntry -ExpectedProductName $expectedProductName
if ($null -eq $installedProduct) {
    Write-Output "Product '$expectedProductName' is not installed. Installing MSI first."
    Invoke-Msi -Arguments @("/i", $MsiPath, "/qn", "/norestart") -LogName "repair-install.log"
    Start-Sleep -Seconds 2
    $installedProduct = Get-InstalledProductEntry -ExpectedProductName $expectedProductName
    if ($null -eq $installedProduct) {
        throw "Product '$expectedProductName' is still not detected after MSI install. Check repair-install.log."
    }
}

Write-Output "Found installed product '$($installedProduct.DisplayName)' with product code $($installedProduct.PSChildName)."
Invoke-Msi -Arguments @("/fa", $installedProduct.PSChildName, "/qn", "/norestart") -LogName "repair.log"

$svc = Get-Service -Name "MTI.Alert.Updater" -ErrorAction SilentlyContinue
if ($null -ne $svc -and $svc.Status -ne "Running") {
    Start-Service -Name "MTI.Alert.Updater"
    Start-Sleep -Seconds 2
}

Start-Sleep -Seconds 3

& $collectEvidenceScript -OutputPath $EvidenceOutputPath
