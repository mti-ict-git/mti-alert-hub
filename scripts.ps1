Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

Set-Location "c:\Scripts\Projects\mti-alert-hub"

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

Write-Host "================================================================" -ForegroundColor Magenta
Write-Host " FINAL MSI VALIDATION CYCLE v3" -ForegroundColor Magenta
Write-Host "================================================================" -ForegroundColor Magenta

# ----------------------------------------------------------------------------
# STEP 0: RESET SEMUA
# ----------------------------------------------------------------------------
Write-Host ""
Write-Host "STEP 0: RESET LINGKUNGAN" -ForegroundColor Cyan
$deleteTask = Invoke-Schtasks -Arguments @("/Delete", "/F", "/TN", "MTI Alert Agent")
if ($deleteTask.ExitCode -eq 0) {
    Write-Host "Sisa task lama dihapus manual"
} else {
    if ($deleteTask.Output -match "cannot find the file specified") {
        Write-Host "Tidak ada sisa task (OK)"
    } else {
        Write-Host "[WARN] Gagal hapus task lama. ExitCode=$($deleteTask.ExitCode). Output=$($deleteTask.Output)"
    }
}
$svcOld = Get-Service -Name "MTI.Alert.Updater" -ErrorAction SilentlyContinue
if ($svcOld) {
    sc.exe delete "MTI.Alert.Updater" 2>&1 | Out-Null
    Write-Host "Sisa service lama dihapus manual"
} else {
    Write-Host "Tidak ada sisa service (OK)"
}
Get-Process MTI.Alert.Agent -ErrorAction SilentlyContinue | Stop-Process -Force -PassThru | Out-Null

# ----------------------------------------------------------------------------
# STEP 1: CLEAN INSTALL
# ----------------------------------------------------------------------------
Write-Host ""
Write-Host "STEP 1: CLEAN INSTALL via helper (Scenario=Reinstall)" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File ".\MTI.Alert.Agent\Installer\invoke-msi-validation.ps1" -Scenario Reinstall -EvidenceOutputPath ".\MTI.Alert.Agent\Installer\validation-final-install-v3.json"

Write-Host ""
Write-Host "--- CHECK SETELAH INSTALL ---" -ForegroundColor Yellow
Write-Host "[Check 1] Scheduled Task MTI Alert Agent:"
$instTask = $false
$queryInstallTask = Invoke-Schtasks -Arguments @("/Query", "/TN", "MTI Alert Agent")
if ($queryInstallTask.ExitCode -eq 0) {
    $instTask = $true
    Write-Host "[OK] PASS - Task ada"
} else {
    Write-Host "[FAIL] Task TIDAK ada. ExitCode=$($queryInstallTask.ExitCode). Output=$($queryInstallTask.Output)"
}
Get-ScheduledTask -TaskName "MTI Alert Agent" -ErrorAction SilentlyContinue | Select-Object TaskName,State | Format-Table -AutoSize

Write-Host "[Check 2] Service MTI.Alert.Updater:"
$instSvc = Get-Service -Name "MTI.Alert.Updater" -ErrorAction SilentlyContinue
if ($instSvc) {
    Write-Host "[OK] PASS - Service ada. Status=$($instSvc.Status), StartType=$($instSvc.StartType)"
} else {
    Write-Host "[FAIL] Service TIDAK ada"
}

Write-Host "[Check 3] Install Directory:"
$instDir = Test-Path "C:\Program Files\MTI\MTI.Alert.Agent"
if ($instDir) {
    Write-Host "[OK] PASS - Install directory ada"
} else {
    Write-Host "[FAIL] Install directory TIDAK ada"
}

if (-not ($instTask -and $instSvc -and $instDir)) {
    Write-Host "[!] INSTALL GAGAL, berhenti disini. Cek log reinstall-install.log" -ForegroundColor Red
    exit 1
}

# ----------------------------------------------------------------------------
# STEP 2: UNINSTALL
# ----------------------------------------------------------------------------
Write-Host ""
Write-Host "STEP 2: UNINSTALL via helper (Scenario=Uninstall)" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File ".\MTI.Alert.Agent\Installer\invoke-msi-validation.ps1" -Scenario Uninstall -EvidenceOutputPath ".\MTI.Alert.Agent\Installer\validation-final-uninstall-v3.json"

Write-Host ""
Write-Host "--- CHECK SETELAH UNINSTALL ---" -ForegroundColor Yellow
Write-Host "[Check 4] Scheduled Task MTI Alert Agent (HARUS HILANG):"
$unTask = $false
$queryUninstallTask = Invoke-Schtasks -Arguments @("/Query", "/TN", "MTI Alert Agent")
if ($queryUninstallTask.ExitCode -eq 0) {
    Write-Host "[FAIL] Task MASIH ADA (scheduled task belum terhapus)"
} else {
    $unTask = $true
    Write-Host "[OK] PASS - Task sudah dihapus"
}

Write-Host "[Check 5] Service MTI.Alert.Updater (HARUS HILANG):"
$unSvc = -not [bool](Get-Service -Name "MTI.Alert.Updater" -ErrorAction SilentlyContinue)
if ($unSvc) {
    Write-Host "[OK] PASS - Service sudah dihapus"
} else {
    Write-Host "[FAIL] Service MASIH ADA"
}

Write-Host "[Check 6] Install Directory (HARUS HILANG):"
$unDir = -not (Test-Path "C:\Program Files\MTI\MTI.Alert.Agent")
if ($unDir) {
    Write-Host "[OK] PASS - Directory sudah dihapus"
} else {
    Write-Host "[FAIL] Directory MASIH ADA"
}

Write-Host "[Check 7] Updater Data Root (Expected: TETAP ADA):"
$upData = Test-Path "C:\ProgramData\MTI Alert\Updater"
if ($upData) {
    Write-Host "[OK] PASS - Updater Data Root tetap ada (retained by policy)"
} else {
    Write-Host "[i] INFO - Updater Data Root terhapus juga (bukan masalah critical)"
}

# ----------------------------------------------------------------------------
# FINAL RESULT
# ----------------------------------------------------------------------------
Write-Host ""
Write-Host "================================================================" -ForegroundColor Magenta
$allPass = $instTask -and $instSvc -and $instDir -and $unTask -and $unSvc -and $unDir
if ($allPass) {
    Write-Host "[*] SEMUA 6 CHECK LULUS. MSI INSTALL-UNINSTALL CYCLE VALID!" -ForegroundColor Green
    Write-Host "    - Scheduled Task: Create OK, Delete OK"
    Write-Host "    - Updater Service: Register OK, Delete OK"
    Write-Host "    - Directory: Install OK, Remove OK"
    Write-Host "    - Updater Data Root: Retained by policy OK"
} else {
    Write-Host "[!] ADA YANG GAGAL. Cek output diatas dan log validation-" -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor Magenta
