# PhD ERP Portal - Kill all ports, restart backends, start Cloudflare tunnels, then start frontends
# Usage: .\restart-with-cloudflare.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Killing all running ports..." -ForegroundColor Yellow

$ports = @(5000, 5001, 5002, 5003, 5172, 5173, 5174, 5175, 5176)
foreach ($port in $ports) {
    $pids = netstat -ano | Select-String ":$port\s" |
            ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique
    foreach ($p in $pids) {
        if ($p -match '^\d+$' -and $p -ne '0') {
            try { Stop-Process -Id $p -Force -ErrorAction Stop; Write-Host "  Killed PID $p (port $port)" } catch {}
        }
    }
}

# Also kill any leftover cloudflared process
Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force

Start-Sleep -Seconds 2

# Start 4 backends
Write-Host "Starting backends..." -ForegroundColor Cyan
$backends = @(
    @{ Name = "student-be   :5000"; Dir = "$root\student\backend"    },
    @{ Name = "admin-be     :5001"; Dir = "$root\admin\backend"      },
    @{ Name = "supervisor-be:5002"; Dir = "$root\supervisor\backend" },
    @{ Name = "center-be    :5003"; Dir = "$root\center\backend"     }
)
foreach ($be in $backends) {
    Start-Process cmd -ArgumentList ('/c cd /d "{0}" && npm run dev' -f $be.Dir) -WindowStyle Minimized
    Write-Host "  OK: $($be.Name)"
    Start-Sleep -Milliseconds 400
}

Start-Sleep -Seconds 6

# Start Cloudflare Tunnels
Write-Host "Starting Cloudflare tunnels (this takes ~35 seconds)..." -ForegroundColor Cyan
Write-Host "The tunnel manager will run in a separate window to keep tunnels alive."

# Start tunnel manager in a new visible window
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$root\tunnel-manager-ascii.ps1" -WindowStyle Normal

Start-Sleep -Seconds 38

# Start 5 frontends AFTER Tunnels wrote .env files
Write-Host "Starting frontends (reading new .env with tunnel URLs)..." -ForegroundColor Cyan
$frontends = @(
    @{ Name = "portal-fe    :5172"; Dir = "$root\portal-dashboard"    },
    @{ Name = "student-fe   :5173"; Dir = "$root\student\frontend"    },
    @{ Name = "admin-fe     :5174"; Dir = "$root\admin\frontend"      },
    @{ Name = "supervisor-fe:5175"; Dir = "$root\supervisor\frontend" },
    @{ Name = "center-fe    :5176"; Dir = "$root\center\frontend"     }
)
foreach ($fe in $frontends) {
    Start-Process cmd -ArgumentList ('/c cd /d "{0}" && npm run dev' -f $fe.Dir) -WindowStyle Minimized
    Write-Host "  OK: $($fe.Name)"
    Start-Sleep -Milliseconds 500
}

Start-Sleep -Seconds 5

Write-Host "All services and tunnels successfully started!" -ForegroundColor Green
Write-Host "Please check the new PowerShell window for the public Cloudflare trycloudflare.com URLs." -ForegroundColor Yellow

# Keep the script running to prevent Windows Job Object from cleaning up child processes
try {
    while ($true) {
        Start-Sleep -Seconds 10
    }
} finally {
    Write-Host "Stopping keep-alive loop..."
}

