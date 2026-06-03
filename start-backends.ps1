# start-backends.ps1
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

Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

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
Write-Host "Backends started." -ForegroundColor Green
