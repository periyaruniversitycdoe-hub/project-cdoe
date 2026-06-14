# PhD ERP Portal - Cloudflare Tunnel Manager (ASCII version)
# Keep this window OPEN. All tunnels run from this window.
# Press Ctrl+C to stop all tunnels.

$CF   = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = "$env:TEMP\cf-phd"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# Kill any leftover cloudflared
Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

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

Write-Host "Starting Cloudflare Tunnels for PhD ERP Portal..." -ForegroundColor Cyan
$procs = @()

foreach ($svc in $services) {
    $logFile = "$logDir\$($svc.name).log"
    "" | Out-File $logFile -Encoding utf8  # create empty file

    # Start cloudflared using Start-Process with native file redirection
    $proc = Start-Process -FilePath $CF `
              -ArgumentList "tunnel --url http://127.0.0.1:$($svc.port) --no-autoupdate --protocol http2" `
              -RedirectStandardError $logFile `
              -WindowStyle Hidden -PassThru

    $procs += $proc
    Write-Host "  Start: $($svc.name) (port $($svc.port)) - PID $($proc.Id)"
    Start-Sleep -Milliseconds 600
}

Write-Host "Waiting 30 seconds for all tunnels to get URLs..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Parse URLs
$urls = @{}
foreach ($svc in $services) {
    $logFile = "$logDir\$($svc.name).log"
    $content = Get-Content $logFile -Raw 2>$null
    if ($content -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
        $urls[$svc.name] = $Matches[0]
        Write-Host "  OK: $($svc.name.PadRight(15)) $($Matches[0])" -ForegroundColor Green
    } else {
        $urls[$svc.name] = "http://localhost:$($svc.port)"
        Write-Host "  WARNING: $($svc.name.PadRight(15)) URL not found (fallback localhost)" -ForegroundColor Yellow
    }
}

# Write frontend .env files
$studentBe    = $urls["student-be"]
$adminBe      = $urls["admin-be"]
$supervisorBe = $urls["supervisor-be"]
$centerBe     = $urls["center-be"]

$studentFe    = $urls["student-fe"]
$adminFe      = $urls["admin-fe"]
$supervisorFe = $urls["supervisor-fe"]
$centerFe     = $urls["center-fe"]

$envMap = @{
    "$root\student\frontend\.env"    = "VITE_STUDENT_API_URL=$studentBe`nVITE_ADMIN_API_URL=$adminBe`nVITE_STUDENT_FE_URL=$studentFe`nVITE_ADMIN_FE_URL=$adminFe`nVITE_SUPERVISOR_FE_URL=$supervisorFe`nVITE_CENTER_FE_URL=$centerFe"
    "$root\admin\frontend\.env"      = "VITE_ADMIN_API_URL=$adminBe`nVITE_STUDENT_API_URL=$studentBe`nVITE_SUPERVISOR_API_URL=$supervisorBe`nVITE_CENTER_API_URL=$centerBe"
    "$root\supervisor\frontend\.env" = "VITE_SUPERVISOR_API_URL=$supervisorBe`nVITE_ADMIN_API_URL=$adminBe"
    "$root\center\frontend\.env"     = "VITE_CENTER_API_URL=$centerBe`nVITE_ADMIN_API_URL=$adminBe"
    "$root\portal-dashboard\.env"    = "VITE_STUDENT_API_URL=$studentBe`nVITE_ADMIN_API_URL=$adminBe`nVITE_SUPERVISOR_API_URL=$supervisorBe`nVITE_CENTER_API_URL=$centerBe`nVITE_STUDENT_FE_URL=$studentFe`nVITE_ADMIN_FE_URL=$adminFe`nVITE_SUPERVISOR_FE_URL=$supervisorFe`nVITE_CENTER_FE_URL=$centerFe"
}
foreach ($pair in $envMap.GetEnumerator()) {
    [System.IO.File]::WriteAllText($pair.Key, $pair.Value)
}
Write-Host "Frontend .env files written with tunnel URLs." -ForegroundColor Cyan

# Save URLs to a text file
$summary = @"
PhD ERP Portal - Cloudflare Tunnel URLs
Generated: $(Get-Date)

FRONTENDS (share these):
  Portal Dashboard  : $($urls['portal-fe'])
  Student Portal    : $($urls['student-fe'])
  Admin Portal      : $($urls['admin-fe'])
  Supervisor Portal : $($urls['supervisor-fe'])
  Center Portal     : $($urls['center-fe'])

BACKEND APIs:
  Student API       : $($urls['student-be'])
  Admin API         : $($urls['admin-be'])
  Supervisor API    : $($urls['supervisor-be'])
  Center API        : $($urls['center-be'])
"@
[System.IO.File]::WriteAllText("$root\tunnel-urls.txt", $summary)
Write-Host "URLs saved in: $root\tunnel-urls.txt" -ForegroundColor Yellow


$line = "=" * 68
Write-Host "`n$line" -ForegroundColor Green
Write-Host "             PhD ERP PORTAL - PUBLIC ACCESS URLS                      " -ForegroundColor Green
Write-Host $line -ForegroundColor Green
Write-Host "  Portal Dashboard  : $($urls['portal-fe'])" -ForegroundColor White
Write-Host "  Student Portal    : $($urls['student-fe'])" -ForegroundColor White
Write-Host "  Admin Portal      : $($urls['admin-fe'])" -ForegroundColor White
Write-Host "  Supervisor Portal : $($urls['supervisor-fe'])" -ForegroundColor White
Write-Host "  Center Portal     : $($urls['center-fe'])" -ForegroundColor White
Write-Host "----------------------------------------------------------------------" -ForegroundColor Green
Write-Host "  Student API       : $($urls['student-be'])" -ForegroundColor DarkGray
Write-Host "  Admin API         : $($urls['admin-be'])" -ForegroundColor DarkGray
Write-Host "  Supervisor API    : $($urls['supervisor-be'])" -ForegroundColor DarkGray
Write-Host "  Center API        : $($urls['center-be'])" -ForegroundColor DarkGray
Write-Host $line -ForegroundColor Green
Write-Host "  Keep THIS window open - closing it stops all tunnels" -ForegroundColor Yellow
Write-Host "  Press Ctrl+C to stop all tunnels" -ForegroundColor Yellow

# Keep alive and cleanup on exit
try {
    while ($true) {
        Start-Sleep -Seconds 60
        $alive = ($procs | Where-Object { -not $_.HasExited }).Count
        Write-Host "$(Get-Date -Format 'HH:mm')  Tunnels alive: $alive/9" -ForegroundColor DarkGray
    }
} finally {
    Write-Host "Stopping all cloudflared tunnels..."
    $procs | ForEach-Object { try { $_.Kill() } catch {} }
    Write-Host "Done."
}
