# PhD ERP Portal - Cloudflare Quick Tunnels (No account required)
# Starts one tunnel per service, captures URLs, writes frontend .env files.
# Usage: .\start-cloudflare-tunnels.ps1

$CF = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n* PhD ERP Portal - Starting Cloudflare Tunnels...`n" -ForegroundColor Cyan

$services = @(
    @{ name = "student-be";    port = 5000 },
    @{ name = "admin-be";      port = 5001 },
    @{ name = "supervisor-be"; port = 5002 },
    @{ name = "center-be";     port = 5003 },
    @{ name = "portal-fe";     port = 5172 },
    @{ name = "student-fe";    port = 5173 },
    @{ name = "admin-fe";      port = 5174 },
    @{ name = "supervisor-fe"; port = 5175 },
    @{ name = "center-fe";     port = 5176 }
)

$urls  = @{}
$procs = @()
$logs  = @{}

# -- Start all tunnels --------------------------------------------------------
foreach ($svc in $services) {
    $logFile = "$env:TEMP\cf-$($svc.name).log"
    $logs[$svc.name] = $logFile
    if (Test-Path $logFile) { Remove-Item $logFile -Force }

    $p = Start-Process -FilePath $CF `
         -ArgumentList "tunnel --url http://127.0.0.1:$($svc.port) --no-autoupdate --protocol http2 2>&1" `
         -RedirectStandardError $logFile `
         -WindowStyle Hidden -PassThru
    $procs += $p
    Write-Host "  Wait: Starting tunnel for $($svc.name) (port $($svc.port))...."
}

Write-Host "`n  Wait: Waiting 20 seconds for tunnels to connect...`n"
Start-Sleep -Seconds 20

# -- Parse trycloudflare.com URLs from logs ------------------------------------
foreach ($svc in $services) {
    $logFile = $logs[$svc.name]
    if (Test-Path $logFile) {
        $content = Get-Content $logFile -Raw 2>$null
        if ($content -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
            $urls[$svc.name] = $Matches[0]
        } else {
            # Retry once after extra wait
            Start-Sleep -Seconds 10
            $content = Get-Content $logFile -Raw 2>$null
            if ($content -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
                $urls[$svc.name] = $Matches[0]
            } else {
                $urls[$svc.name] = "http://localhost:$($svc | Select-Object -ExpandProperty port)"
                Write-Host "  WARN: Could not get URL for $($svc.name), using localhost fallback" -ForegroundColor Yellow
            }
        }
    }
}

# -- Write frontend .env files ------------------------------------------------
$studentBe    = $urls["student-be"]
$adminBe      = $urls["admin-be"]
$supervisorBe = $urls["supervisor-be"]
$centerBe     = $urls["center-be"]

$studentFe    = $urls["student-fe"]
$adminFe      = $urls["admin-fe"]
$supervisorFe = $urls["supervisor-fe"]
$centerFe     = $urls["center-fe"]

$envConfigs = @{
    "student\frontend\.env" = "VITE_STUDENT_API_URL=$studentBe`nVITE_ADMIN_API_URL=$adminBe`nVITE_STUDENT_FE_URL=$studentFe`nVITE_ADMIN_FE_URL=$adminFe`nVITE_SUPERVISOR_FE_URL=$supervisorFe`nVITE_CENTER_FE_URL=$centerFe"
    "admin\frontend\.env"   = "VITE_ADMIN_API_URL=$adminBe`nVITE_STUDENT_API_URL=$studentBe`nVITE_SUPERVISOR_API_URL=$supervisorBe`nVITE_CENTER_API_URL=$centerBe"
    "supervisor\frontend\.env" = "VITE_SUPERVISOR_API_URL=$supervisorBe`nVITE_ADMIN_API_URL=$adminBe"
    "center\frontend\.env"  = "VITE_CENTER_API_URL=$centerBe`nVITE_ADMIN_API_URL=$adminBe"
    "portal-dashboard\.env" = "VITE_STUDENT_API_URL=$studentBe`nVITE_ADMIN_API_URL=$adminBe`nVITE_SUPERVISOR_API_URL=$supervisorBe`nVITE_CENTER_API_URL=$centerBe`nVITE_STUDENT_FE_URL=$studentFe`nVITE_ADMIN_FE_URL=$adminFe`nVITE_SUPERVISOR_FE_URL=$supervisorFe`nVITE_CENTER_FE_URL=$centerFe"
}

Write-Host "`nWriting frontend .env files...`n" -ForegroundColor Cyan
foreach ($pair in $envConfigs.GetEnumerator()) {
    $full = "$root\$($pair.Key)"
    [System.IO.File]::WriteAllText($full, $pair.Value)
    Write-Host "  OK: $($pair.Key)"
}

# -- Print summary ------------------------------------------------------------
$line = "=" * 68
Write-Host "`n$line" -ForegroundColor Green
Write-Host "            PhD ERP PORTAL - PUBLIC ACCESS URLS" -ForegroundColor Green
Write-Host $line -ForegroundColor Green
Write-Host "  Portal Dashboard  : $($urls['portal-fe'])" -ForegroundColor White
Write-Host "  Student Portal    : $($urls['student-fe'])" -ForegroundColor White
Write-Host "  Admin Portal      : $($urls['admin-fe'])" -ForegroundColor White
Write-Host "  Supervisor Portal : $($urls['supervisor-fe'])" -ForegroundColor White
Write-Host "  Center Portal     : $($urls['center-fe'])" -ForegroundColor White
Write-Host $line -ForegroundColor Green
Write-Host "  Student API       : $($urls['student-be'])" -ForegroundColor White
Write-Host "  Admin API         : $($urls['admin-be'])" -ForegroundColor White
Write-Host "  Supervisor API    : $($urls['supervisor-be'])" -ForegroundColor White
Write-Host "  Center API        : $($urls['center-be'])" -ForegroundColor White
Write-Host $line -ForegroundColor Green
Write-Host "  NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Restart all 5 Vite frontends NOW (they must reload .env)" -ForegroundColor Yellow
Write-Host "     Run: .\restart-frontends.ps1" -ForegroundColor Yellow
Write-Host "  2. Share the Frontend URLs with external testers" -ForegroundColor Yellow
Write-Host "  3. No warning pages - Cloudflare tunnels are direct HTTPS" -ForegroundColor Yellow
Write-Host "  4. Press Ctrl+C here to stop all tunnels" -ForegroundColor Yellow
Write-Host $line -ForegroundColor Green

# -- Keep alive ---------------------------------------------------------------
Write-Host "`n* Tunnels active. Keep this window open. Press Ctrl+C to stop.`n"
try {
    while ($true) { Start-Sleep -Seconds 30 }
} finally {
    Write-Host "`n* Stopping all tunnel processes..."
    $procs | ForEach-Object { try { $_.Kill() } catch {} }
}
