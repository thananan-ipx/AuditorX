# Test Goose against a disposable PostgreSQL cluster, never the application volume.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$testContainer = 'auditorx-goose-test-' + [guid]::NewGuid().ToString('N').Substring(0, 10)
$testNetwork = $testContainer + '-network'
$created = $false
$networkCreated = $false

function Invoke-CheckedDocker {
    & docker @args
    if ($LASTEXITCODE -ne 0) { throw "Docker failed: $($args[0])" }
}

Push-Location $repoRoot
try {
    Invoke-CheckedDocker network create $testNetwork
    $networkCreated = $true
    Invoke-CheckedDocker run --rm -d --name $testContainer --network $testNetwork `
        --mount 'type=tmpfs,destination=/var/lib/postgresql/data' `
        -e POSTGRES_PASSWORD=goose-disposable-test -e POSTGRES_DB=auditorx postgres:17-alpine
    $created = $true
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        & docker exec $testContainer pg_isready -U postgres -d auditorx *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'Disposable database did not become ready' }
    Invoke-CheckedDocker exec $testContainer psql -U postgres -d auditorx -v ON_ERROR_STOP=1 `
        -c 'CREATE ROLE auditorx_api NOLOGIN NOINHERIT NOBYPASSRLS;'

    $testDsn = "postgres://postgres:goose-disposable-test@${testContainer}:5432/auditorx?sslmode=disable"
    $serviceContainer = (& docker compose ps -a -q migrate | Select-Object -First 1)
    if (-not $serviceContainer) { throw 'Start the stack first: docker compose up -d --build' }
    $image = (& docker inspect --format '{{.Config.Image}}' $serviceContainer)
    if ($LASTEXITCODE -ne 0) { throw 'Could not determine the local migration image' }

    function Invoke-TestMigration([string]$Command) {
        Invoke-CheckedDocker run --rm --network $testNetwork -e "DATABASE_URL=$testDsn" `
            --entrypoint /auditorx-migrate $image $Command
    }

    Invoke-TestMigration up
    Invoke-TestMigration up
    # No user data exists here: exercise the complete Down history.
    $migrationCount = @(Get-ChildItem (Join-Path $repoRoot 'backend/migrations') -Filter '*.sql').Count
    for ($version = $migrationCount; $version -ge 1; $version--) { Invoke-TestMigration down }
    Invoke-TestMigration up
    Invoke-TestMigration status
    Write-Output 'PASS: clean install, repeated Up, complete Down, and reapply on real PostgreSQL'
}
finally {
    if ($created) { & docker stop $testContainer | Out-Null }
    if ($networkCreated) { & docker network rm $testNetwork | Out-Null }
    Pop-Location
}
