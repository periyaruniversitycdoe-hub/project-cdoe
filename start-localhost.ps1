# PhD ERP Portal - Localhost Startup (No tunnels)
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
Start-Sleep -Seconds 4

# Write localhost .env files
Write-Host "Writing frontend .env files for localhost..." -ForegroundColor Cyan
$envMap = @{
    "$root\student\frontend\.env"    = "VITE_STUDENT_API_URL=http://localhost:5000`nVITE_ADMIN_API_URL=http://localhost:5001`nVITE_STUDENT_FE_URL=http://localhost:5173`nVITE_ADMIN_FE_URL=http://localhost:5174`nVITE_SUPERVISOR_FE_URL=http://localhost:5175`nVITE_CENTER_FE_URL=http://localhost:5176"
    "$root\admin\frontend\.env"      = "VITE_ADMIN_API_URL=http://localhost:5001`nVITE_STUDENT_API_URL=http://localhost:5000`nVITE_SUPERVISOR_API_URL=http://localhost:5002`nVITE_CENTER_API_URL=http://localhost:5003"
    "$root\supervisor\frontend\.env" = "VITE_SUPERVISOR_API_URL=http://localhost:5002`nVITE_ADMIN_API_URL=http://localhost:5001"
    "$root\center\frontend\.env"     = "VITE_CENTER_API_URL=http://localhost:5003`nVITE_ADMIN_API_URL=http://localhost:5001"
    "$root\portal-dashboard\.env"    = "VITE_STUDENT_API_URL=http://localhost:5000`nVITE_ADMIN_API_URL=http://localhost:5001`nVITE_SUPERVISOR_API_URL=http://localhost:5002`nVITE_CENTER_API_URL=http://localhost:5003`nVITE_STUDENT_FE_URL=http://localhost:5173`nVITE_ADMIN_FE_URL=http://localhost:5174`nVITE_SUPERVISOR_FE_URL=http://localhost:5175`nVITE_CENTER_FE_URL=http://localhost:5176"
}
foreach ($pair in $envMap.GetEnumerator()) {
    [System.IO.File]::WriteAllText($pair.Key, $pair.Value)
}

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

# Start 5 frontends
Write-Host "Starting frontends..." -ForegroundColor Cyan
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

Write-Host "All services successfully started on localhost!" -ForegroundColor Green
