[CmdletBinding()]
param([switch]$SmokeTest)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
function Get-PublishedPort([string]$Service, [int]$ContainerPort) {
    $binding = & docker compose port $Service $ContainerPort | Select-Object -First 1
    if ($LASTEXITCODE -ne 0 -or $binding -notmatch ':(\d+)$') { throw "Cannot resolve published port for $Service" }
    return $Matches[1]
}
Push-Location $projectRoot
try {
    & docker compose up -d --build --wait
    if ($LASTEXITCODE -ne 0) { throw 'Docker stack startup failed' }
    $webOrigin = 'http://localhost:' + (Get-PublishedPort 'web' 3000)
    $apiOrigin = 'http://localhost:' + (Get-PublishedPort 'api' 8080)
    if ($SmokeTest) {
        $health = Invoke-RestMethod "$apiOrigin/health"
        if ($health.data.database -ne 'connected') { throw 'PostgreSQL is not connected' }
        # The web service has no container health probe; allow Next.js to finish
        # opening its listener after Compose has started the container.
        $login = $null
        for ($attempt = 0; $attempt -lt 15; $attempt++) {
            try {
                $login = Invoke-WebRequest "$webOrigin/login" -TimeoutSec 5
                if ($login.StatusCode -eq 200) { break }
            }
            catch { if ($attempt -eq 14) { throw } }
            Start-Sleep -Seconds 1
        }
        if ($login.StatusCode -ne 200) { throw 'Login page unavailable' }
        Write-Host 'Smoke test passed: database and login page are ready.'
    }
    Write-Host "AuditorX: $webOrigin"
    Write-Host "PostgreSQL: 127.0.0.1:$(Get-PublishedPort 'postgres' 5432) (auditorx)"
    Write-Host 'Stop with docker compose down; the database volume is preserved.'
}
finally { Pop-Location }
