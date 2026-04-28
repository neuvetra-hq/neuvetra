# =============================================================================
# Neuvetra Monorepo Restructure
# =============================================================================
# Consolidates three repos under C:\Users\nimab\Neuvetra\:
#   - C:\Users\nimab\Neuvetra\* (current wiki contents)  -> Neuvetra\ghg-wiki\
#   - C:\Users\nimab\front-desk\                          -> Neuvetra\front-desk\
#   - C:\Users\nimab\terrascope\                          -> Neuvetra\terrascope\
#
# Then splits the parent CLAUDE.md and rewrites absolute path references.
#
# Usage:
#   pwsh .\2026-04-25-restructure.ps1               # dry-run by default
#   pwsh .\2026-04-25-restructure.ps1 -Execute      # actually do it
#   pwsh .\2026-04-25-restructure.ps1 -Rollback     # undo using migration log
#
# Companion plan: 2026-04-25-monorepo-restructure-plan.md (read first)
# =============================================================================

[CmdletBinding()]
param(
    [switch]$Execute,
    [switch]$Rollback
)

$ErrorActionPreference = 'Stop'

$Umbrella   = 'C:\Users\nimab\Neuvetra'
$WikiTarget = Join-Path $Umbrella 'ghg-wiki'
$FdSrc      = 'C:\Users\nimab\front-desk'
$FdTarget   = Join-Path $Umbrella 'front-desk'
$TsSrc      = 'C:\Users\nimab\terrascope'
$TsTarget   = Join-Path $Umbrella 'terrascope'

$Staging    = Join-Path $Umbrella '.migration-staging'
$Backup     = Join-Path $Umbrella '.migration-backup'
$LogFile    = Join-Path $Umbrella '.migration-log.txt'

$ParentClaudePath = Join-Path $Umbrella 'CLAUDE.md'
$WikiClaudePath   = Join-Path $WikiTarget 'CLAUDE.md'
$Divider          = '# ────────────────────────────────────────────────────────────'

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
function Write-Log($message) {
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    "$stamp  $message" | Tee-Object -FilePath $LogFile -Append | Out-Host
}

function Invoke-Action($description, [scriptblock]$action) {
    if ($Execute) {
        Write-Log "EXEC  $description"
        & $action
    } else {
        Write-Host "DRY   $description" -ForegroundColor Yellow
    }
}

function Assert-Path($path, [bool]$shouldExist) {
    $exists = Test-Path $path
    if ($exists -ne $shouldExist) {
        if ($shouldExist) {
            throw "PRECHECK FAILED: expected to exist but missing: $path"
        } else {
            throw "PRECHECK FAILED: expected to be absent but already exists: $path"
        }
    }
}

function Assert-CleanGit($repoPath) {
    Push-Location $repoPath
    try {
        $status = git status --porcelain 2>$null
        if ($status) {
            throw "PRECHECK FAILED: uncommitted changes in $repoPath`n$status`nCommit or stash, then retry."
        }
        Write-Log "git clean OK: $repoPath"
    } finally {
        Pop-Location
    }
}

# -----------------------------------------------------------------------------
# Rollback path
# -----------------------------------------------------------------------------
if ($Rollback) {
    if (-not (Test-Path $LogFile)) {
        throw "No migration log found at $LogFile. Cannot rollback."
    }
    Write-Host "Rollback mode — reverse-applying $LogFile" -ForegroundColor Cyan
    # Rollback is intentionally manual: the script prints the moves it performed,
    # in reverse order, with the inverse Move-Item commands. The user runs them
    # by hand to retain control. This avoids cascading mistakes.
    $entries = Get-Content $LogFile | Where-Object { $_ -match 'EXEC  Move-Item ' }
    [array]::Reverse($entries)
    foreach ($e in $entries) {
        if ($e -match "Move-Item '([^']+)' '([^']+)'") {
            $from = $matches[1]
            $to   = $matches[2]
            Write-Host "Move-Item -LiteralPath '$to' -Destination '$from'"
        }
    }
    Write-Host "`nReview the commands above, then run them manually to undo." -ForegroundColor Cyan
    return
}

# -----------------------------------------------------------------------------
# Pre-flight
# -----------------------------------------------------------------------------
Write-Host "`n=== PRECHECKS ===" -ForegroundColor Cyan

Assert-Path $Umbrella   $true
Assert-Path $FdSrc      $true
Assert-Path $TsSrc      $true
Assert-Path $WikiTarget $false
Assert-Path $FdTarget   $false
Assert-Path $TsTarget   $false
Assert-Path $Staging    $false

Write-Log "All path prechecks passed."

# Git cleanliness — only check if .git exists
foreach ($r in @($Umbrella, $FdSrc, $TsSrc)) {
    if (Test-Path (Join-Path $r '.git')) {
        Assert-CleanGit $r
    } else {
        Write-Log "No .git in $r — skipping git check."
    }
}

# Parent CLAUDE.md must contain the divider
$parentText = Get-Content $ParentClaudePath -Raw
if ($parentText -notmatch [regex]::Escape($Divider)) {
    throw "PRECHECK FAILED: parent CLAUDE.md does not contain the wiki/parent divider line. Cannot split safely."
}
Write-Log "Parent CLAUDE.md contains divider — split is possible."

if (-not $Execute) {
    Write-Host "`nDRY-RUN MODE. Re-run with -Execute to actually perform the migration.`n" -ForegroundColor Yellow
}

# -----------------------------------------------------------------------------
# Step 1: Backup the parent CLAUDE.md before splitting
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 1: Backup ===" -ForegroundColor Cyan
Invoke-Action "New-Item -ItemType Directory -Path '$Backup'" {
    New-Item -ItemType Directory -Path $Backup -Force | Out-Null
}
Invoke-Action "Copy-Item '$ParentClaudePath' '$Backup\CLAUDE.md.original'" {
    Copy-Item -LiteralPath $ParentClaudePath -Destination (Join-Path $Backup 'CLAUDE.md.original')
}

# -----------------------------------------------------------------------------
# Step 2: Stash current Neuvetra contents into .migration-staging\
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 2: Stash current wiki contents ===" -ForegroundColor Cyan
Invoke-Action "New-Item -ItemType Directory -Path '$Staging'" {
    New-Item -ItemType Directory -Path $Staging -Force | Out-Null
}

# Move every top-level item EXCEPT the new parent CLAUDE.md, the new docs/ folder,
# and migration-internal folders.
$keepAtRoot = @('CLAUDE.md', 'docs', '.migration-staging', '.migration-backup', '.migration-log.txt')
$itemsToStash = Get-ChildItem -LiteralPath $Umbrella -Force | Where-Object { $keepAtRoot -notcontains $_.Name }

foreach ($item in $itemsToStash) {
    $dest = Join-Path $Staging $item.Name
    Invoke-Action "Move-Item '$($item.FullName)' '$dest'" {
        Move-Item -LiteralPath $item.FullName -Destination $dest
    }
}

# -----------------------------------------------------------------------------
# Step 3: Promote staging to ghg-wiki/
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 3: Create ghg-wiki/ ===" -ForegroundColor Cyan
Invoke-Action "Rename-Item '$Staging' 'ghg-wiki'" {
    Rename-Item -LiteralPath $Staging -NewName 'ghg-wiki'
}

# -----------------------------------------------------------------------------
# Step 4: Move the two product repos under the umbrella
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 4: Move product repos ===" -ForegroundColor Cyan
Invoke-Action "Move-Item '$FdSrc' '$FdTarget'" {
    Move-Item -LiteralPath $FdSrc -Destination $FdTarget
}
Invoke-Action "Move-Item '$TsSrc' '$TsTarget'" {
    Move-Item -LiteralPath $TsSrc -Destination $TsTarget
}

# -----------------------------------------------------------------------------
# Step 5: Split parent CLAUDE.md — wiki schema goes to ghg-wiki/CLAUDE.md
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 5: Split parent CLAUDE.md ===" -ForegroundColor Cyan

$splitIndex = $parentText.IndexOf($Divider)
if ($splitIndex -lt 0) {
    throw "Divider disappeared between precheck and split — aborting."
}

$parentOnly = $parentText.Substring(0, $splitIndex).TrimEnd()
$wikiBlock  = $parentText.Substring($splitIndex)

# Strip the divider header from the wiki block; replace with a parent backref.
$wikiHeader = @'
# GHG Wiki — Operating Schema

> **Parent:** Neuvetra. For company-level hierarchy and sibling products, see `..\CLAUDE.md`. This file is the wiki workspace's own working manual.

'@

# Find where the original "# GHG Wiki — Operating Schema" line starts inside $wikiBlock
$wikiStart = $wikiBlock.IndexOf('# GHG Wiki — Operating Schema')
if ($wikiStart -lt 0) {
    throw "Could not locate '# GHG Wiki — Operating Schema' header in the wiki block. Aborting split."
}
$wikiBody = $wikiBlock.Substring($wikiStart)
# Replace just the leading H1 line with our new header (which already contains the H1)
$wikiBody = $wikiBody -replace '^# GHG Wiki — Operating Schema\s*\r?\n', ''

$newWikiClaude   = $wikiHeader + $wikiBody
$newParentClaude = $parentOnly + "`n"

Invoke-Action "Write-Content '$WikiClaudePath' (split half)" {
    Set-Content -LiteralPath $WikiClaudePath -Value $newWikiClaude -Encoding UTF8
}
Invoke-Action "Write-Content '$ParentClaudePath' (parent only)" {
    Set-Content -LiteralPath $ParentClaudePath -Value $newParentClaude -Encoding UTF8
}

# -----------------------------------------------------------------------------
# Step 6: Rewrite absolute path references
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 6: Rewrite absolute path references ===" -ForegroundColor Cyan

# Define each rewrite as a (file, oldText, newText) triple. The script reads
# each file, performs the literal replacement, and writes it back.
$rewrites = @(
    # Parent CLAUDE.md — sibling repo paths
    @{ File = $ParentClaudePath
       Pairs = @(
           @{ Old = 'C:\Users\nimab\front-desk'; New = 'C:\Users\nimab\Neuvetra\front-desk' }
           @{ Old = 'C:\Users\nimab\terrascope'; New = 'C:\Users\nimab\Neuvetra\terrascope' }
       )
    }
    # Terrascope CLAUDE.md — wiki path + FrontDesk path
    @{ File = (Join-Path $TsTarget 'CLAUDE.md')
       Pairs = @(
           @{ Old = 'C:\Users\nimab\Neuvetra\wiki\'; New = 'C:\Users\nimab\Neuvetra\ghg-wiki\wiki\' }
           @{ Old = 'C:\Users\nimab\Neuvetra\factors\'; New = 'C:\Users\nimab\Neuvetra\ghg-wiki\factors\' }
           @{ Old = 'C:\Users\nimab\Neuvetra\CLAUDE.md'; New = 'C:\Users\nimab\Neuvetra\CLAUDE.md' }   # unchanged but listed for completeness
           @{ Old = 'C:\Users\nimab\front-desk'; New = 'C:\Users\nimab\Neuvetra\front-desk' }
       )
    }
    # FrontDesk CLAUDE.md — parent ref already correct, but check for stragglers
    @{ File = (Join-Path $FdTarget 'CLAUDE.md')
       Pairs = @(
           @{ Old = 'C:\Users\nimab\terrascope'; New = 'C:\Users\nimab\Neuvetra\terrascope' }
       )
    }
    # Terrascope seed-factors.ts — hardcoded CSV paths
    @{ File = (Join-Path $TsTarget 'packages\database\src\seed-factors.ts')
       Pairs = @(
           @{ Old = 'C:/Users/nimab/Neuvetra/factors/processed/'; New = 'C:/Users/nimab/Neuvetra/ghg-wiki/factors/processed/' }
       )
    }
)

foreach ($r in $rewrites) {
    if (-not (Test-Path $r.File)) {
        Write-Log "SKIP rewrite — file missing: $($r.File)"
        continue
    }
    foreach ($pair in $r.Pairs) {
        Invoke-Action "Rewrite in '$($r.File)': '$($pair.Old)' -> '$($pair.New)'" {
            $content = Get-Content -LiteralPath $r.File -Raw
            if ($content.Contains($pair.Old)) {
                $updated = $content.Replace($pair.Old, $pair.New)
                Set-Content -LiteralPath $r.File -Value $updated -Encoding UTF8
            } else {
                Write-Log "  (no occurrence of '$($pair.Old)' in $($r.File))"
            }
        }
    }
}

# -----------------------------------------------------------------------------
# Step 7: Post-flight verification
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 7: Post-flight verification ===" -ForegroundColor Cyan

if ($Execute) {
    # Top-level inventory
    $expected = @('CLAUDE.md', 'docs', 'ghg-wiki', 'front-desk', 'terrascope', '.migration-backup', '.migration-log.txt')
    $actual = Get-ChildItem -LiteralPath $Umbrella -Force | Select-Object -ExpandProperty Name
    $missing = $expected | Where-Object { $actual -notcontains $_ }
    $extra   = $actual   | Where-Object { $expected -notcontains $_ }
    if ($missing) { Write-Warning "Missing under umbrella: $($missing -join ', ')" }
    if ($extra)   { Write-Warning "Unexpected under umbrella: $($extra -join ', ')" }
    if (-not $missing -and -not $extra) { Write-Host "Umbrella contents OK." -ForegroundColor Green }

    # Grep for stale absolute paths
    Write-Host "`nSearching for stale path references..." -ForegroundColor Cyan
    $stalePatterns = @(
        'C:\\Users\\nimab\\front-desk[^\\]'
        'C:\\Users\\nimab\\terrascope[^\\]'
        'C:/Users/nimab/Neuvetra/factors/processed'
    )
    foreach ($p in $stalePatterns) {
        Write-Host "  pattern: $p"
        Get-ChildItem -LiteralPath $Umbrella -Recurse -File -Include *.ts,*.md,*.json -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\\.git\\' -and $_.FullName -notmatch '\\\.migration-backup\\' } |
            Select-String -Pattern $p -SimpleMatch:$false |
            ForEach-Object { Write-Warning "    stale ref: $($_.Path):$($_.LineNumber)  $($_.Line.Trim())" }
    }
} else {
    Write-Host "(skipped in dry-run)" -ForegroundColor Yellow
}

Write-Host "`n=== DONE ===" -ForegroundColor Green
if ($Execute) {
    Write-Host "Migration log: $LogFile" -ForegroundColor Green
    Write-Host "Backup of original CLAUDE.md: $Backup\CLAUDE.md.original" -ForegroundColor Green
    Write-Host "`nNext steps:"
    Write-Host "  1. Re-open IDE workspaces at the new paths."
    Write-Host "  2. Smoke test: cd $TsTarget; bun install; bun run --cwd apps/api dev"
    Write-Host "  3. Consider refactoring seed-factors.ts to use an env var instead of hardcoded paths."
} else {
    Write-Host "This was a DRY RUN. Re-run with -Execute to actually perform the migration." -ForegroundColor Yellow
}
