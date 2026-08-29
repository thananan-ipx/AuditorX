[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$SemgrepExecutable)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedScanner = (Resolve-Path -LiteralPath $SemgrepExecutable).Path
$previousScanner = $env:AUDITORX_TEST_SEMGREP
try {
    $env:AUDITORX_TEST_SEMGREP = $resolvedScanner
    Push-Location (Join-Path $projectRoot 'backend')
    try {
        & go test -count=1 -timeout=60s -run TestSemgrepFixture -v ./internal/modules/scan
        if ($LASTEXITCODE -ne 0) { throw 'Real Semgrep fixture test failed' }
    }
    finally { Pop-Location }
    & (Join-Path $PSScriptRoot 'verify.ps1') -Target database
}
finally {
    if ($null -eq $previousScanner) { Remove-Item Env:AUDITORX_TEST_SEMGREP -ErrorAction SilentlyContinue }
    else { $env:AUDITORX_TEST_SEMGREP = $previousScanner }
}
