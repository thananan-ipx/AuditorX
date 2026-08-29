[CmdletBinding()]
param(
    [ValidateSet('all', 'backend', 'frontend', 'database')]
    [string]$Target = 'all',
    [switch]$Race
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments)
    Write-Host "Running: $Command $($Arguments -join ' ')"
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE"
    }
}

if ($Target -in @('all', 'backend')) {
    Push-Location (Join-Path $projectRoot 'backend')
    try {
        Invoke-Checked -Command 'go' -Arguments @('version')
        # List only this module's package directories, never dependency/cache trees.
        $packageDirs = @(& go list -f '{{.Dir}}' ./...)
        if ($LASTEXITCODE -ne 0) { throw 'Unable to list Go packages' }
        $unformatted = @(
            foreach ($packageDir in $packageDirs) {
                foreach ($source in (Get-ChildItem -LiteralPath $packageDir -Filter '*.go' -File)) {
                    & gofmt -l $source.FullName
                    if ($LASTEXITCODE -ne 0) { throw "gofmt failed for $($source.Name)" }
                }
            }
        )
        if ($unformatted.Count -gt 0) {
            throw "Run gofmt on these files before continuing: $($unformatted -join ', ')"
        }
        Invoke-Checked -Command 'go' -Arguments @('vet', './...')
        $testArgs = @('test', '-count=1', '-timeout=2m')
        if ($Race) { $testArgs += '-race' }
        Invoke-Checked -Command 'go' -Arguments ($testArgs + './...')
        Invoke-Checked -Command 'go' -Arguments @('build', './...')
    }
    finally { Pop-Location }
}

if ($Target -in @('all', 'database')) {
    Push-Location (Join-Path $projectRoot 'tools/database-tests')
    try {
        if (-not (Test-Path -LiteralPath 'node_modules')) {
            throw 'Database test dependencies are missing. Run npm ci in tools/database-tests first.'
        }
        # The harness creates an in-memory engine and a loopback-only socket.
        # It never reads the application's DATABASE_URL or .env files.
        Invoke-Checked -Command 'npm' -Arguments @('test')
    }
    finally { Pop-Location }
}

if ($Target -in @('all', 'frontend')) {
    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        Invoke-Checked -Command 'node' -Arguments @('--version')
        Invoke-Checked -Command 'npm' -Arguments @('--version')
        if (-not (Test-Path -LiteralPath 'node_modules')) {
            throw 'Frontend dependencies are missing. Run npm ci in frontend first.'
        }
        Invoke-Checked -Command 'npm' -Arguments @('run', 'check')
    }
    finally { Pop-Location }
}

Write-Host "Verification passed ($Target)."
