param([string]$OutputPath = "artifacts/datasets/priority-dataset.csv")
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    # Do not silently train on inconsistent project grouping in the same snapshot.
    $check = "WITH latest AS (SELECT DISTINCT ON (scan_id,fingerprint) * FROM public.priority_labels ORDER BY scan_id,fingerprint,id DESC) SELECT count(*) FROM (SELECT scan_id FROM latest GROUP BY scan_id HAVING count(DISTINCT repository_group)>1) conflicts;"
    $conflicts = & docker compose exec -T postgres psql -X -U postgres -d auditorx -tA -v ON_ERROR_STOP=1 -c $check
    if ($LASTEXITCODE -ne 0) { throw "Cannot inspect database labels." }
    if ([int]($conflicts -join "").Trim() -gt 0) { throw "A scan has conflicting project groups. Correct its latest labels before exporting." }
    $sql = Get-Content -LiteralPath (Join-Path $projectRoot "tools/ml/export-training.sql") -Raw
    $csv = $sql | & docker compose exec -T postgres psql -X -q -U postgres -d auditorx -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw "Training dataset export failed." }
    $text = ($csv -join "`n") + "`n"
    $rows = @($text | ConvertFrom-Csv)
    if ($rows.Count -eq 0) { throw "No accepted human labels are available. Save labels in the dashboard first." }
    $target = [IO.Path]::GetFullPath($OutputPath)
    if (Test-Path -LiteralPath $target) { throw "Dataset exists. Use a new versioned output filename." }
    if (Test-Path -LiteralPath ($target + ".manifest.json")) { throw "Dataset manifest exists. Use a new output filename." }
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent)
    [IO.File]::WriteAllText($target, $text, [Text.UTF8Encoding]::new($false))
    $manifest = @{
        exported_at = [DateTimeOffset]::UtcNow.ToString("o")
        schema_version = "priority-dataset-v1"
        guideline_version = "priority-labels-3class-v1"
        feature_schema_version = "priority-features-v1-coursework"
        features = @("severity","rule_family","category","language","file_type","rule_count_in_scan")
        target = "priority_label"
        group_column = "repository_group"
        rows = $rows.Count
        project_groups = @($rows.repository_group | Sort-Object -Unique)
        label_distribution = @($rows | Group-Object priority_label | ForEach-Object { @{ label = $_.Name; count = $_.Count } })
        sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
        selection = "latest label revision per finding; latest accepted labeled scan per repository_group"
    }
    [IO.File]::WriteAllText($target + ".manifest.json", ($manifest | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
    Write-Output "Exported $($rows.Count) accepted labels to $target"
} finally { Pop-Location }
