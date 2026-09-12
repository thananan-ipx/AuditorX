[CmdletBinding()]
param(
    [switch]$SmokeTest,
    [switch]$KeepSupabase,
    [switch]$AllowLanExposure
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $projectRoot 'backend'
$frontendRoot = Join-Path $projectRoot 'frontend'
$toolRoot = Join-Path $projectRoot 'tools/database-tests'
$supabase = Join-Path $toolRoot 'node_modules/.bin/supabase.cmd'
$scanner = Join-Path $projectRoot 'tools/scanner-env/Scripts/semgrep.exe'
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
$docker = Join-Path $dockerBin 'docker.exe'
$dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
$supabaseProject = 'auditor-x'
$supabaseNetwork = 'auditorx-supabase-local'
$supabaseDatabaseContainer = "supabase_db_$supabaseProject"
$runtimeRoot = Join-Path $projectRoot '.local'
$binaryRoot = Join-Path $runtimeRoot 'bin'
$logRoot = Join-Path $runtimeRoot 'logs'
$processes = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
$startedSupabase = $false
$workerLogin = $null

function Assert-File([string]$Path, [string]$Message) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw $Message }
}

function Wait-ForDocker {
    & $docker info *> $null
    if ($LASTEXITCODE -eq 0) { return }

    Write-Host 'Starting Docker Desktop...'
    & $docker desktop start
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Desktop could not be started. Open Docker Desktop once and resolve any startup or recovery prompt.'
    }
    for ($attempt = 0; $attempt -lt 180; $attempt++) {
        Start-Sleep -Seconds 1
        & $docker info *> $null
        if ($LASTEXITCODE -eq 0) { return }
    }
    throw 'Docker Engine did not become ready within 180 seconds. Inspect the Docker Desktop window for a startup or recovery prompt.'
}

function Assert-PortAvailable([int]$Port, [string]$Service) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        throw "Port $Port is already in use by PID $($listener.OwningProcess). Stop the existing $Service instance and run this command again."
    }
}

function Build-Backend([string]$Output, [string]$Package) {
    Push-Location $backendRoot
    try {
        & go build -o $Output $Package
        if ($LASTEXITCODE -ne 0) { throw "Unable to build $Package." }
    }
    finally { Pop-Location }
}

function Start-LoggedProcess {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory,
        [hashtable]$Environment
    )
    $stdout = Join-Path $logRoot "$Name.out.log"
    $stderr = Join-Path $logRoot "$Name.err.log"
    $startParameters = @{
        FilePath               = $FilePath
        WorkingDirectory       = $WorkingDirectory
        Environment            = $Environment
        WindowStyle            = 'Hidden'
        RedirectStandardOutput = $stdout
        RedirectStandardError  = $stderr
        PassThru               = $true
    }
    if ($ArgumentList.Count -gt 0) {
        $startParameters.ArgumentList = $ArgumentList
    }
    $process = Start-Process @startParameters
    $processes.Add($process)
    return $process
}

function Show-LogTail([string]$Name) {
    foreach ($suffix in @('out', 'err')) {
        $path = Join-Path $logRoot "$Name.$suffix.log"
        if (Test-Path -LiteralPath $path) {
            Write-Host "--- $Name.$suffix.log ---"
            Get-Content -LiteralPath $path -Tail 30
        }
    }
}

function Wait-ForHttp {
    param([string]$Name, [string]$Url, [System.Diagnostics.Process]$Process, [int]$TimeoutSeconds = 90)
    for ($attempt = 0; $attempt -lt $TimeoutSeconds; $attempt++) {
        $Process.Refresh()
        if ($Process.HasExited) {
            Show-LogTail $Name
            throw "$Name stopped during startup with exit code $($Process.ExitCode)."
        }
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -SkipHttpErrorCheck
            if ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 400) { return }
        }
        catch { }
        Start-Sleep -Seconds 1
    }
    Show-LogTail $Name
    throw "$Name did not become ready at $Url within $TimeoutSeconds seconds."
}

Assert-File $docker 'Docker Desktop is not installed at the expected location.'
Assert-File $dockerDesktop 'Docker Desktop is not installed at the expected location.'
Assert-File $supabase 'Supabase CLI is missing. Run: npm --prefix tools/database-tests ci'
Assert-File $scanner 'Semgrep is missing. Follow docs/scan-pipeline.md to install the pinned scanner.'
Assert-File (Join-Path $frontendRoot 'node_modules/next/dist/bin/next') 'Frontend dependencies are missing. Run: npm --prefix frontend ci'

if ($PSVersionTable.PSVersion -lt [version]'7.4') {
    throw "This script requires PowerShell 7.4 or newer (found $($PSVersionTable.PSVersion)). Run it with pwsh."
}

New-Item -ItemType Directory -Force -Path $binaryRoot, $logRoot | Out-Null

# A newly installed Docker CLI may not be visible in an already-open PowerShell session.
$machineExecutableSearch = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$userExecutableSearch = [Environment]::GetEnvironmentVariable('Path', 'User')
[Environment]::SetEnvironmentVariable('Path', "$dockerBin;$machineExecutableSearch;$userExecutableSearch", 'Process')

Assert-PortAvailable 8080 'AuditorX API'
Assert-PortAvailable 3000 'AuditorX frontend'
Wait-ForDocker

try {
    $networkHostBinding = (& $docker network inspect $supabaseNetwork --format '{{index .Options "com.docker.network.bridge.host_binding_ipv4"}}' 2>$null) -join ''
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Creating a localhost-only Docker network for Supabase...'
        & $docker network create --driver bridge --opt 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1' $supabaseNetwork | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Unable to create the localhost-only Docker network.' }
        $networkHostBinding = '127.0.0.1'
    }
    if ($networkHostBinding.Trim() -ne '127.0.0.1') {
        throw "Docker network $supabaseNetwork does not enforce localhost-only port binding."
    }

    if (-not $AllowLanExposure) {
        Write-Warning 'Docker Desktop on this host publishes Supabase ports to the LAN. Studio and local development keys are not production-safe.'
        if ($SmokeTest) {
            throw 'Run the smoke test with -AllowLanExposure only while connected to a trusted network.'
        }
        $confirmation = Read-Host 'Continue on this trusted network? [y/N]'
        if ($confirmation -notin @('y', 'Y', 'yes', 'YES')) {
            throw 'Local startup cancelled before Supabase was exposed.'
        }
    }

    & $supabase status --output json *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Starting local Supabase...'
        & $supabase start --network-id $supabaseNetwork --output json | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Unable to start local Supabase.' }
        $startedSupabase = $true
    }

    $publishedPorts = (& $docker ps --filter "network=$supabaseNetwork" --format '{{.Ports}}') -join "`n"
    $supabaseIsLanExposed = $publishedPorts -match '0\.0\.0\.0:' -or $publishedPorts -match '\[::\]:'

    $statusText = (& $supabase status --output json 2>$null) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw 'Unable to read local Supabase status.' }
    $local = $statusText | ConvertFrom-Json
    if (-not $local.DB_URL -or -not $local.API_URL -or -not $local.PUBLISHABLE_KEY) {
        throw 'Local Supabase status did not include the required URLs and publishable key.'
    }
    $localDatabaseUrl = [string]$local.DB_URL
    $localDatabaseUrl += if ($localDatabaseUrl.IndexOf('?', [System.StringComparison]::Ordinal) -ge 0) { '&sslmode=disable' } else { '?sslmode=disable' }

    Write-Host 'Provisioning a dedicated local scan-worker login...'
    $workerLogin = 'auditorx_scan_worker_local_' + [guid]::NewGuid().ToString('N').Substring(0, 12)
    $workerPassword = [guid]::NewGuid().ToString('N')
    $workerRoleSql = @'
DO $auditorx$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auditorx_scan_worker_local') THEN
    ALTER ROLE auditorx_scan_worker_local NOLOGIN;
  END IF;
END
$auditorx$;
CREATE ROLE __LOGIN__ LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '__PASSWORD__';
GRANT auditorx_scan_worker TO __LOGIN__;
'@.Replace('__LOGIN__', $workerLogin).Replace('__PASSWORD__', $workerPassword)
    $provisionOutput = $workerRoleSql | & $docker exec -i $supabaseDatabaseContainer `
        psql --no-psqlrc --set=ON_ERROR_STOP=1 --username=supabase_admin --dbname=postgres 2>&1
    $provisionExitCode = $LASTEXITCODE
    if ($provisionExitCode -ne 0) {
        $safeProvisionOutput = (($provisionOutput | ForEach-Object { $_.ToString() }) -join "`n").Replace($workerPassword, '[redacted]')
        throw "Unable to provision the dedicated local scan-worker login. $safeProvisionOutput"
    }

    # Ordinal comparison is required: culture-aware IndexOf (the default) treats ':' and '/'
    # as ignorable under some locales (e.g. Thai), which silently returns index 0 and corrupts
    # this URL surgery instead of throwing.
    $schemeEnd = $localDatabaseUrl.IndexOf('://', [System.StringComparison]::Ordinal) + 3
    $credentialsEnd = $localDatabaseUrl.IndexOf('@', $schemeEnd, [System.StringComparison]::Ordinal)
    if ($schemeEnd -lt 3 -or $credentialsEnd -lt $schemeEnd) {
        throw 'Local Supabase returned an unsupported database URL.'
    }
    $workerDatabaseUrl = $localDatabaseUrl.Substring(0, $schemeEnd) + $workerLogin + ':' + $workerPassword + $localDatabaseUrl.Substring($credentialsEnd)
    $verificationOutput = (& $docker exec --env "PGPASSWORD=$workerPassword" $supabaseDatabaseContainer `
        psql --no-psqlrc --set=ON_ERROR_STOP=1 --host=127.0.0.1 --username=$workerLogin --dbname=postgres `
        --command='BEGIN; SET LOCAL ROLE auditorx_scan_worker; SELECT current_role; ROLLBACK;' 2>&1) -join "`n"
    $verificationExitCode = $LASTEXITCODE
    if ($verificationExitCode -ne 0) {
        $safeVerificationOutput = $verificationOutput.Replace($workerPassword, '[redacted]')
        throw "The dedicated local scan-worker login could not assume auditorx_scan_worker. $safeVerificationOutput"
    }

    Write-Host 'Building API and scan worker...'
    $apiBinary = Join-Path $binaryRoot 'auditorx-api.exe'
    $workerBinary = Join-Path $binaryRoot 'auditorx-scan-worker.exe'
    Build-Backend $apiBinary './cmd/api'
    Build-Backend $workerBinary './cmd/scan-worker'

    $api = Start-LoggedProcess -Name 'api' -FilePath $apiBinary -ArgumentList @() -WorkingDirectory $backendRoot -Environment @{
        DATABASE_URL = $localDatabaseUrl
        REPOSITORY_STORAGE = 'postgres'
        SCAN_QUEUE_ENABLED = 'true'
        SUPABASE_URL = [string]$local.API_URL
        SUPABASE_PUBLISHABLE_KEY = [string]$local.PUBLISHABLE_KEY
        FRONTEND_URL = 'http://localhost:3000'
        COOKIE_SECURE = 'false'
        PORT = '8080'
    }
    $worker = Start-LoggedProcess -Name 'worker' -FilePath $workerBinary -ArgumentList @() -WorkingDirectory $backendRoot -Environment @{
        SCAN_WORKER_DATABASE_URL = $workerDatabaseUrl
        SEMGREP_EXECUTABLE = $scanner
    }
    $frontend = Start-LoggedProcess -Name 'frontend' -FilePath (Get-Command node).Source `
        -ArgumentList @('node_modules/next/dist/bin/next', 'dev', '--hostname', 'localhost', '--port', '3000') `
        -WorkingDirectory $frontendRoot -Environment @{
            API_URL = 'http://localhost:8080'
            NEXT_PUBLIC_API_URL = 'http://localhost:8080'
        }

    Wait-ForHttp -Name 'api' -Url 'http://localhost:8080/health' -Process $api
    Wait-ForHttp -Name 'frontend' -Url 'http://localhost:3000/login' -Process $frontend
    Start-Sleep -Seconds 2
    $worker.Refresh()
    if ($worker.HasExited) {
        Show-LogTail 'worker'
        throw "Scan worker stopped during startup with exit code $($worker.ExitCode)."
    }

    Write-Host ''
    Write-Host 'AuditorX local environment is ready:' -ForegroundColor Green
    Write-Host '  App:      http://localhost:3000'
    Write-Host '  Studio:   http://localhost:54323'
    Write-Host '  Mailpit:  http://localhost:54324'
    Write-Host "  Logs:     $logRoot"
    if ($supabaseIsLanExposed) {
        Write-Warning 'Supabase is reachable from the LAN while this command is running. Press Ctrl+C when finished.'
    }
    else {
        Write-Host '  Network:  Supabase ports are bound to 127.0.0.1 only'
    }

    if ($SmokeTest) {
        Write-Host 'Smoke test passed; shutting down spawned services.' -ForegroundColor Green
    }
    else {
        Write-Host 'Press Ctrl+C to stop the API, worker, frontend, and Supabase started by this command.'
        while ($true) {
            Start-Sleep -Seconds 1
            foreach ($process in $processes) {
                $process.Refresh()
                if ($process.HasExited) {
                    throw "A local service stopped unexpectedly with exit code $($process.ExitCode). Check $logRoot."
                }
            }
        }
    }
}
finally {
    foreach ($process in $processes) {
        try {
            $process.Refresh()
            if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
        }
        catch { }
    }
    if ($workerLogin) {
        $cleanupSql = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = '$workerLogin' AND pid <> pg_backend_pid(); DROP ROLE IF EXISTS $workerLogin;"
        try {
            $cleanupSql | & $docker exec -i $supabaseDatabaseContainer `
                psql --no-psqlrc --set=ON_ERROR_STOP=1 --username=supabase_admin --dbname=postgres *> $null
        }
        catch { }
    }
    if ($startedSupabase -and -not $KeepSupabase) {
        Write-Host 'Stopping local Supabase (database backup is preserved)...'
        & $supabase stop --project-id $supabaseProject | Out-Null
    }
}
