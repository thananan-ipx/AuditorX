[CmdletBinding()]
param(
    [ValidateSet('start', 'status', 'reset', 'stop')]
    [string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$toolRoot = Join-Path $projectRoot 'tools/database-tests'
$supabase = Join-Path $toolRoot 'node_modules/.bin/supabase.cmd'

function Assert-Command([string]$Name, [string]$InstallHint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required. $InstallHint"
    }
}

function Invoke-Checked([string]$FilePath, [string[]]$Arguments) {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Install-LocalCli {
    if (Test-Path -LiteralPath $supabase -PathType Leaf) { return }

    Assert-Command 'npm' 'Install the Node.js version documented in docs/local-database.md.'
    Write-Host 'Installing the repository-pinned Supabase CLI...'
    Invoke-Checked 'npm' @('--prefix', $toolRoot, 'ci')
}

function Assert-DockerReady {
    Assert-Command 'docker' 'Install and start Docker Desktop.'
    & docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Engine is not ready. Start Docker Desktop and run this command again.'
    }
}

Push-Location $projectRoot
try {
    Install-LocalCli

    switch ($Action) {
        'start' {
            Assert-DockerReady
            Invoke-Checked $supabase @('start')
        }
        'status' {
            Assert-DockerReady
            Invoke-Checked $supabase @('status')
        }
        'reset' {
            Assert-DockerReady
            Write-Warning 'This deletes only the local Docker database, then reapplies migrations and seed.sql.'
            Invoke-Checked $supabase @('db', 'reset', '--local')
        }
        'stop' {
            Assert-DockerReady
            Invoke-Checked $supabase @('stop', '--project-id', 'auditor-x')
        }
    }
}
finally {
    Pop-Location
}
