[CmdletBinding()]
param([ValidateSet('start', 'status', 'stop')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    switch ($Action) {
        'start' {
            & docker compose up -d --build migrate
            if ($LASTEXITCODE -ne 0) { throw 'Database startup failed' }
            & docker compose run --rm migrate up
        }
        'status' { & docker compose ps -a postgres migrate }
        'stop' { & docker compose stop postgres }
    }
    if ($LASTEXITCODE -ne 0) { throw "Database command failed: $Action" }
}
finally { Pop-Location }
