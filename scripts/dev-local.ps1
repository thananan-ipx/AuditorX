[CmdletBinding()]
param([switch]$SmokeTest)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    & docker compose up -d --build --wait
    if ($LASTEXITCODE -ne 0) { throw 'Docker stack startup failed' }
    if ($SmokeTest) {
        $health = Invoke-RestMethod 'http://localhost:8080/health'
        if ($health.data.database -ne 'connected') { throw 'PostgreSQL is not connected' }
        $login = Invoke-WebRequest 'http://localhost:3000/login'
        if ($login.StatusCode -ne 200) { throw 'Login page unavailable' }
        Write-Host 'Smoke test passed: database and login page are ready.'
    }
    Write-Host 'AuditorX: http://localhost:3000'
    Write-Host 'PostgreSQL: 127.0.0.1:5433 (auditorx)'
    Write-Host 'Stop with docker compose down; the database volume is preserved.'
}
finally { Pop-Location }
