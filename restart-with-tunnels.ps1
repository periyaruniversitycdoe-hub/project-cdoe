# PhD ERP Portal — Kill all ports, restart services, then start tunnels
# Usage: .\restart-with-tunnels.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n🛑  Killing all running ports..." -ForegroundColor Yellow

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

Start-Sleep -Seconds 2

# ── Start 4 backends ───────────────────────────────────────────────────────
Write-Host "`n🔧  Starting backends..." -ForegroundColor Cyan
$backends = @(
    @{ Name = "student-be   :5000"; Dir = "$root\student\backend"    },
    @{ Name = "admin-be     :5001"; Dir = "$root\admin\backend"      },
    @{ Name = "supervisor-be:5002"; Dir = "$root\supervisor\backend" },
    @{ Name = "center-be    :5003"; Dir = "$root\center\backend"     }
)
foreach ($be in $backends) {
    Start-Process cmd -ArgumentList "/c cd /d `"$($be.Dir)`" && npm run dev" -WindowStyle Minimized
    Write-Host "  ✅ $($be.Name)"
    Start-Sleep -Milliseconds 400
}

Start-Sleep -Seconds 6

# ── Start tunnel script (this writes .env files for frontends) ─────────────
Write-Host "`n🌐  Starting localtunnels (this takes ~30 seconds)..." -ForegroundColor Cyan
Write-Host "    The script will print all public URLs when ready.`n"

# Run tunnel script in a new window so its URLs are visible
Start-Process cmd -ArgumentList "/c cd /d `"$root`" && node start-tunnels.js && pause" -WindowStyle Normal

Start-Sleep -Seconds 35

# ── Start 5 frontends AFTER tunnels wrote .env files ─────────────────────
Write-Host "`n🎨  Starting frontends (reading new .env with tunnel URLs)..." -ForegroundColor Cyan
$frontends = @(
    @{ Name = "portal-fe    :5172"; Dir = "$root\portal-dashboard"    },
    @{ Name = "student-fe   :5173"; Dir = "$root\student\frontend"    },
    @{ Name = "admin-fe     :5174"; Dir = "$root\admin\frontend"      },
    @{ Name = "supervisor-fe:5175"; Dir = "$root\supervisor\frontend" },
    @{ Name = "center-fe    :5176"; Dir = "$root\center\frontend"     }
)
foreach ($fe in $frontends) {
    Start-Process cmd -ArgumentList "/c cd /d `"$($fe.Dir)`" && npm run dev" -WindowStyle Minimized
    Write-Host "  ✅ $($fe.Name)"
    Start-Sleep -Milliseconds 500
}

Start-Sleep -Seconds 10

Write-Host "`n✅  All services started. Check the tunnel window for public URLs." -ForegroundColor Green
Write-Host "    ⚠️  When visiting a *.loca.lt URL for the first time, click 'Click to Submit' on the warning page." -ForegroundColor Yellow
