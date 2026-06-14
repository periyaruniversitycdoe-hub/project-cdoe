# PhD ERP Portal - Full startup with Cloudflare tunnels
# Run once; reads tunnel URLs and writes .env files; keeps tunnels alive.

$CF   = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$root = "C:\Users\majeed\Downloads\cdoe-main\cdoe-main"
$logDir = "$env:TEMP\cf-phd-erp"

# -- Kill everything on project ports ----------------------------------------
Write-Host "[1/5] Killing existing processes on project ports..." -ForegroundColor Yellow
$ports = @(5000, 5001, 5002, 5003, 5172, 5173, 5174, 5175, 5176)
foreach ($port in $ports) {
    $pids = netstat -ano 2>$null | Select-String ":$port\s" |
            ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique
    foreach ($p in $pids) {
        if ($p -match '^\d+$' -and $p -ne '0') {
            try { Stop-Process -Id ([int]$p) -Force -ErrorAction Stop; Write-Host "  Killed PID $p (port $port)" } catch {}
        }
    }
}
Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3

# -- Start backends -----------------------------------------------------------
Write-Host "[2/5] Starting 4 backends..." -ForegroundColor Cyan
$backends = @(
    @{ name = "student-be";    dir = "$root\student\backend"    },
    @{ name = "admin-be";      dir = "$root\admin\backend"      },
    @{ name = "supervisor-be"; dir = "$root\supervisor\backend" },
    @{ name = "center-be";     dir = "$root\center\backend"     }
)
foreach ($be in $backends) {
    Start-Process cmd -ArgumentList ('/c cd /d "{0}" && npm run dev' -f $be.dir) -WindowStyle Minimized
    Write-Host "  Started: $($be.name)"
    Start-Sleep -Milliseconds 500
}
Write-Host "  Waiting 8s for backends to initialise..."
Start-Sleep -Seconds 8

# -- Start 9 Cloudflare tunnels (1.5s apart to avoid 429) --------------------
Write-Host "[3/5] Starting 9 Cloudflare tunnels (slow to avoid rate-limit)..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
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
$tunnelProcs = @()
foreach ($svc in $services) {
    $logFile = "$logDir\$($svc.name).log"
    "" | Out-File $logFile -Encoding utf8
    $p = Start-Process -FilePath $CF `
           -ArgumentList "tunnel --url http://127.0.0.1:$($svc.port) --no-autoupdate --protocol http2" `
           -RedirectStandardError $logFile `
           -WindowStyle Hidden -PassThru
    $tunnelProcs += $p
    Write-Host "  Tunnel PID $($p.Id): $($svc.name) -> port $($svc.port)"
    Start-Sleep -Milliseconds 1500
}

Write-Host "[4/5] Waiting 45s for all tunnels to establish..." -ForegroundColor Yellow
Start-Sleep -Seconds 45

# -- Parse URLs from logs ----------------------------------------------------
Write-Host "[5/5] Reading tunnel URLs..." -ForegroundColor Cyan
$urls = @{}
foreach ($svc in $services) {
    $logFile = "$logDir\$($svc.name).log"
    $content = Get-Content $logFile -Raw 2>$null
    if ($content -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
        $urls[$svc.name] = $Matches[0]
        Write-Host "  OK  $($svc.name.PadRight(15)) $($Matches[0])" -ForegroundColor Green
    } else {
        # Retry once after 15 more seconds
        Write-Host "  WAIT $($svc.name) - retrying in 15s..." -ForegroundColor DarkYellow
        Start-Sleep -Seconds 15
        $content = Get-Content $logFile -Raw 2>$null
        if ($content -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
            $urls[$svc.name] = $Matches[0]
            Write-Host "  OK  $($svc.name.PadRight(15)) $($Matches[0])" -ForegroundColor Green
        } else {
            $urls[$svc.name] = "http://localhost:$($svc.port)"
            Write-Host "  WARN $($svc.name.PadRight(15)) FAILED - using localhost fallback" -ForegroundColor Red
        }
    }
}

# -- Write .env files ---------------------------------------------------------
$sb = $urls["student-be"]; $ab = $urls["admin-be"]
$vb = $urls["supervisor-be"]; $cb = $urls["center-be"]
$sf = $urls["student-fe"];  $af = $urls["admin-fe"]
$vf = $urls["supervisor-fe"]; $cf2 = $urls["center-fe"]

$envMap = @{
    "$root\student\frontend\.env"    = "VITE_STUDENT_API_URL=$sb`nVITE_ADMIN_API_URL=$ab`nVITE_STUDENT_FE_URL=$sf`nVITE_ADMIN_FE_URL=$af`nVITE_SUPERVISOR_FE_URL=$vf`nVITE_CENTER_FE_URL=$cf2"
    "$root\admin\frontend\.env"      = "VITE_ADMIN_API_URL=$ab`nVITE_STUDENT_API_URL=$sb`nVITE_SUPERVISOR_API_URL=$vb`nVITE_CENTER_API_URL=$cb"
    "$root\supervisor\frontend\.env" = "VITE_SUPERVISOR_API_URL=$vb`nVITE_ADMIN_API_URL=$ab"
    "$root\center\frontend\.env"     = "VITE_CENTER_API_URL=$cb`nVITE_ADMIN_API_URL=$ab"
    "$root\portal-dashboard\.env"    = "VITE_STUDENT_API_URL=$sb`nVITE_ADMIN_API_URL=$ab`nVITE_SUPERVISOR_API_URL=$vb`nVITE_CENTER_API_URL=$cb`nVITE_STUDENT_FE_URL=$sf`nVITE_ADMIN_FE_URL=$af`nVITE_SUPERVISOR_FE_URL=$vf`nVITE_CENTER_FE_URL=$cf2"
}
foreach ($pair in $envMap.GetEnumerator()) {
    [System.IO.File]::WriteAllText($pair.Key, $pair.Value)
    Write-Host "  Wrote: $($pair.Key.Replace($root,'.'))" -ForegroundColor DarkGray
}

$studentBeEnvPath = "$root\student\backend\.env"
if (Test-Path $studentBeEnvPath) {
    $content = Get-Content $studentBeEnvPath -Raw
    $content = $content -replace 'STUDENT_FRONTEND_URL=.*', "STUDENT_FRONTEND_URL=$sf"
    $content = $content -replace 'ADMIN_FRONTEND_URL=.*', "ADMIN_FRONTEND_URL=$af"
    $content = $content -replace 'SUPERVISOR_FRONTEND_URL=.*', "SUPERVISOR_FRONTEND_URL=$vf"
    $content = $content -replace 'CENTER_FRONTEND_URL=.*', "CENTER_FRONTEND_URL=$cf2"
    $content = $content -replace 'STUDENT_PORTAL_URL=.*', "STUDENT_PORTAL_URL=$sf"
    $content = $content -replace 'PAYTM_CALLBACK_URL=.*', "PAYTM_CALLBACK_URL=$sb/api/payment/callback"
    $content = $content -replace 'PAYMENT_RETURN_URL=.*', "PAYMENT_RETURN_URL=$sf/payment/callback"
    $content = $content -replace 'PAYMENT_WEBHOOK_BASE_URL=.*', "PAYMENT_WEBHOOK_BASE_URL=$sb"
    [System.IO.File]::WriteAllText($studentBeEnvPath, $content)
    Write-Host "  Updated backend URLs in: .\student\backend\.env" -ForegroundColor DarkGray
}


# -- Start 5 frontends --------------------------------------------------------
Write-Host "Starting 5 frontends with tunnel URLs in .env..." -ForegroundColor Cyan
$frontends = @(
    @{ name = "portal-fe";     dir = "$root\portal-dashboard"    },
    @{ name = "student-fe";    dir = "$root\student\frontend"    },
    @{ name = "admin-fe";      dir = "$root\admin\frontend"      },
    @{ name = "supervisor-fe"; dir = "$root\supervisor\frontend" },
    @{ name = "center-fe";     dir = "$root\center\frontend"     }
)
foreach ($fe in $frontends) {
    Start-Process cmd -ArgumentList ('/c cd /d "{0}" && npm run dev' -f $fe.dir) -WindowStyle Minimized
    Write-Host "  Started: $($fe.name)"
    Start-Sleep -Milliseconds 600
}

# -- Print final URL summary --------------------------------------------------
$line = "=" * 68
Write-Host "`n$line" -ForegroundColor Green
Write-Host "  PhD ERP PORTAL - PUBLIC ACCESS URLS (share these)" -ForegroundColor Green
Write-Host $line -ForegroundColor Green
Write-Host "  Portal Dashboard  : $($urls['portal-fe'])"   -ForegroundColor White
Write-Host "  Student Portal    : $($urls['student-fe'])"  -ForegroundColor White
Write-Host "  Admin Portal      : $($urls['admin-fe'])"    -ForegroundColor White
Write-Host "  Supervisor Portal : $($urls['supervisor-fe'])" -ForegroundColor White
Write-Host "  Center Portal     : $($urls['center-fe'])"   -ForegroundColor White
Write-Host ("-" * 68) -ForegroundColor DarkGray
Write-Host "  Student API       : $($urls['student-be'])"    -ForegroundColor DarkGray
Write-Host "  Admin API         : $($urls['admin-be'])"      -ForegroundColor DarkGray
Write-Host "  Supervisor API    : $($urls['supervisor-be'])"  -ForegroundColor DarkGray
Write-Host "  Center API        : $($urls['center-be'])"     -ForegroundColor DarkGray
Write-Host $line -ForegroundColor Green
Write-Host "  URLs also saved in: $root\tunnel-urls.txt" -ForegroundColor Yellow
Write-Host "  Keep this window OPEN to keep tunnels alive." -ForegroundColor Yellow
Write-Host $line -ForegroundColor Green

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

# -- Keep alive (keep tunnels running) ----------------------------------------
Write-Host "`nAll services running. Press Ctrl+C to stop everything.`n"
try {
    while ($true) {
        Start-Sleep -Seconds 60
        $alive = ($tunnelProcs | Where-Object { -not $_.HasExited }).Count
        Write-Host "$(Get-Date -Format 'HH:mm')  Tunnels: $alive/9 alive" -ForegroundColor DarkGray
    }
} finally {
    Write-Host "Stopping all Cloudflare tunnels..."
    $tunnelProcs | ForEach-Object { try { $_.Kill() } catch {} }
}
