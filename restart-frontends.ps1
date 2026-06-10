# Kills and restarts all 5 Vite frontends (reloads .env files)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Kill frontend ports
foreach ($port in @(5172, 5173, 5174, 5175, 5176)) {
    $pids = netstat -ano | Select-String ":$port\s" | ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique
    foreach ($p in $pids) {
        if ($p -match '^\d+$' -and $p -ne '0') { try { Stop-Process -Id $p -Force -ErrorAction Stop } catch {} }
    }
}
Start-Sleep -Seconds 2

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
Write-Host "`nFrontends restarted with updated .env tunnel URLs."
