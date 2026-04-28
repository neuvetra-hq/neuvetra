# =============================================================================
# Finalize Restructure
# =============================================================================
# After the Cowork sandbox finished what it could (CLAUDE.mds installed,
# Terrascope/wiki populated, .claude/skills/ scaffolding at most levels), a
# few items needed Windows-side execution because of sandbox visibility
# limits. This script handles them and produces a final verification report.
#
# What it does:
#   1. Verifies the packages\ subfolders in Terrascope\code and FrontDesk\code
#      actually contain their expected files (sandbox couldn't see inside).
#   2. Patches hardcoded CSV paths in seed-factors.ts to the new wiki location
#      (or skips if file moved/missing).
#   3. Adds a README.md to Terrascope\code\.claude\skills\ if not present.
#   4. Removes the now-empty source folders C:\Users\nimab\terrascope and
#      C:\Users\nimab\front-desk if any process has released them.
#   5. Reports final state.
#
# Usage:
#   pwsh C:\Users\nimab\Neuvetra\docs\superpowers\specs\2026-04-25-finalize-restructure.ps1
# =============================================================================

$ErrorActionPreference = 'Continue'

# -----------------------------------------------------------------------------
# Step 1: Verify packages\ contents
# -----------------------------------------------------------------------------
Write-Host "`n=== Step 1: Verify Terrascope\code\packages contents ===" -ForegroundColor Cyan

$tsPackages = @(
    'C:\Users\nimab\Neuvetra\Terrascope\code\packages\database',
    'C:\Users\nimab\Neuvetra\Terrascope\code\packages\calculator',
    'C:\Users\nimab\Neuvetra\Terrascope\code\packages\config'
)
$packageIssues = @()
foreach ($p in $tsPackages) {
    if (-not (Test-Path $p)) {
        Write-Warning "  MISSING DIRECTORY: $p"
        $packageIssues += $p
        continue
    }
    $items = Get-ChildItem $p -Force -ErrorAction SilentlyContinue
    if ($items.Count -eq 0) {
        Write-Warning "  EMPTY: $p"
        $packageIssues += $p
    } else {
        Write-Host "  OK ($($items.Count) items): $p" -ForegroundColor Green
    }
}

Write-Host "`n=== Verify FrontDesk\code\packages contents ===" -ForegroundColor Cyan

$fdPackages = @(
    'C:\Users\nimab\Neuvetra\FrontDesk\code\packages\database',
    'C:\Users\nimab\Neuvetra\FrontDesk\code\packages\config'
)
foreach ($p in $fdPackages) {
    if (-not (Test-Path $p)) {
        Write-Warning "  MISSING DIRECTORY: $p"
        $packageIssues += $p
        continue
    }
    $items = Get-ChildItem $p -Force -ErrorAction SilentlyContinue
    if ($items.Count -eq 0) {
        Write-Warning "  EMPTY: $p"
        $packageIssues += $p
    } else {
        Write-Host "  OK ($($items.Count) items): $p" -ForegroundColor Green
    }
}

if ($packageIssues.Count -gt 0) {
    Write-Host ""
    Write-Warning "Some package folders are empty or missing. Possible causes:"
    Write-Host "  - Move-Item moved the directory entry but not contents (rare on Windows)"
    Write-Host "  - The original packages\* never existed at the source (workspace was set up via bun install only)"
    Write-Host "  - Bun's NTFS junctions in node_modules confused Move-Item"
    Write-Host ""
    Write-Host "To investigate, run:"
    Write-Host "  bun install"
    Write-Host "in each affected code/ folder. If packages are referenced from package.json workspaces,"
    Write-Host "Bun will recreate the necessary structure from node_modules."
}

# -----------------------------------------------------------------------------
# Step 2: Patch seed-factors.ts CSV paths
# -----------------------------------------------------------------------------
Write-Host "`n=== Step 2: Patch seed-factors.ts CSV paths ===" -ForegroundColor Cyan

$seedFile = 'C:\Users\nimab\Neuvetra\Terrascope\code\packages\database\src\seed-factors.ts'
if (Test-Path $seedFile) {
    $content = Get-Content -LiteralPath $seedFile -Raw
    $oldPath = 'C:/Users/nimab/Neuvetra/factors/processed/'
    $newPath = 'C:/Users/nimab/Neuvetra/Terrascope/wiki/factors/processed/'
    if ($content.Contains($oldPath)) {
        $updated = $content.Replace($oldPath, $newPath)
        Set-Content -LiteralPath $seedFile -Value $updated -Encoding UTF8 -NoNewline
        $matches = ([regex]::Matches($content, [regex]::Escape($oldPath))).Count
        Write-Host "  patched $matches CSV path(s) in $seedFile" -ForegroundColor Green
    } else {
        Write-Host "  no occurrence of '$oldPath' found in $seedFile (already patched, or file uses different paths)" -ForegroundColor DarkGray
    }
} else {
    Write-Warning "  seed-factors.ts NOT FOUND at $seedFile"
    Write-Host "  This is expected if Step 1 reported packages\database as empty/missing."
    Write-Host "  Recommended follow-up after fixing packages\database:"
    Write-Host "    1. Open seed-factors.ts"
    Write-Host "    2. Replace 'C:/Users/nimab/Neuvetra/factors/processed/' with"
    Write-Host "       'C:/Users/nimab/Neuvetra/Terrascope/wiki/factors/processed/'"
    Write-Host "    (Better: refactor to read from a WIKI_ROOT env var.)"
}

# -----------------------------------------------------------------------------
# Step 3: Add README.md to Terrascope\code\.claude\skills if missing
# -----------------------------------------------------------------------------
Write-Host "`n=== Step 3: Terrascope\code\.claude\skills README ===" -ForegroundColor Cyan

$tsSkillsDir = 'C:\Users\nimab\Neuvetra\Terrascope\code\.claude\skills'
$tsSkillsReadme = Join-Path $tsSkillsDir 'README.md'
$templateSrc = 'C:\Users\nimab\Neuvetra\docs\superpowers\specs\templates-v2\skills_README.md'

if (-not (Test-Path $tsSkillsDir)) {
    New-Item -ItemType Directory -Path $tsSkillsDir -Force | Out-Null
    Write-Host "  created skills dir"
}
if (-not (Test-Path $tsSkillsReadme)) {
    if (Test-Path $templateSrc) {
        Copy-Item $templateSrc $tsSkillsReadme
        Write-Host "  added README.md to $tsSkillsDir" -ForegroundColor Green
    } else {
        Write-Warning "  template missing at $templateSrc - skipping README"
    }
} else {
    Write-Host "  README already present" -ForegroundColor DarkGray
}

# -----------------------------------------------------------------------------
# Step 4: Remove empty source folders if processes have released them
# -----------------------------------------------------------------------------
Write-Host "`n=== Step 4: Remove empty source folders ===" -ForegroundColor Cyan

foreach ($p in @('C:\Users\nimab\terrascope', 'C:\Users\nimab\front-desk')) {
    if (Test-Path $p) {
        try {
            Remove-Item -LiteralPath $p -Recurse -Force
            Write-Host "  removed: $p" -ForegroundColor Green
        } catch {
            Write-Warning "  STILL LOCKED: $p"
            Write-Host "    Close any IDE/editor on these paths and re-run, or reboot."
        }
    } else {
        Write-Host "  (already gone) $p" -ForegroundColor DarkGray
    }
}

# -----------------------------------------------------------------------------
# Step 5: Final verification report
# -----------------------------------------------------------------------------
Write-Host "`n=== Step 5: Final tree summary ===" -ForegroundColor Cyan

Write-Host "`nNeuvetra\ top level:"
Get-ChildItem 'C:\Users\nimab\Neuvetra' -Force | Select-Object Mode, Name | Format-Table -AutoSize

Write-Host "All CLAUDE.mds in the tree:"
Get-ChildItem 'C:\Users\nimab\Neuvetra' -Recurse -Filter 'CLAUDE.md' -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\\.git\\' } |
    Select-Object @{Name='Path'; Expression={$_.FullName.Replace('C:\Users\nimab\Neuvetra\', '')}}, @{Name='Size'; Expression={"$([math]::Round($_.Length/1024,1)) KB"}} |
    Format-Table -AutoSize

Write-Host "All .claude\skills\ folders:"
Get-ChildItem 'C:\Users\nimab\Neuvetra' -Recurse -Directory -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq 'skills' -and $_.Parent.Name -eq '.claude' -and $_.FullName -notmatch '\\node_modules\\' } |
    Select-Object @{Name='Path'; Expression={$_.FullName.Replace('C:\Users\nimab\Neuvetra\', '')}}, @{Name='Items'; Expression={(Get-ChildItem $_.FullName -Force -ErrorAction SilentlyContinue).Count}} |
    Format-Table -AutoSize

Write-Host "Source folders (should both be gone):"
foreach ($p in @('C:\Users\nimab\terrascope', 'C:\Users\nimab\front-desk')) {
    if (Test-Path $p) {
        Write-Warning "  STILL EXISTS: $p"
    } else {
        Write-Host "  gone: $p" -ForegroundColor Green
    }
}

Write-Host "`nGrep for stale absolute path references in CLAUDE.mds:"
$stalePaths = @('C:\\Users\\nimab\\front-desk[^\\]', 'C:\\Users\\nimab\\terrascope[^\\]', 'C:/Users/nimab/Neuvetra/factors/processed')
foreach ($p in $stalePaths) {
    $hits = Get-ChildItem 'C:\Users\nimab\Neuvetra' -Recurse -Include *.md, *.ts -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch '\\node_modules\\' -and
            $_.FullName -notmatch '\\\.git\\' -and
            $_.FullName -notmatch '\\docs\\archive\\' -and
            $_.FullName -notmatch '\\\.migration-backup\\'
        } |
        Select-String -Pattern $p
    if ($hits) {
        Write-Warning "  pattern '$p' - $($hits.Count) hit(s):"
        $hits | ForEach-Object { Write-Host "    $($_.Path):$($_.LineNumber) $($_.Line.Trim())" }
    } else {
        Write-Host "  pattern '$p' - clean" -ForegroundColor Green
    }
}

Write-Host "`n=== DONE ===" -ForegroundColor Green
Write-Host "If everything reported OK, the restructure is complete."
Write-Host "If any package folders were empty, run 'bun install' in the affected code/ folders to rehydrate."
