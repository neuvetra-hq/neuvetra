# =============================================================================
# Neuvetra Folder Restructure v2
# =============================================================================
# Consolidates the three repos under C:\Users\nimab\Neuvetra\ with the layout:
#
#   Neuvetra/
#   ├── CLAUDE.md                         business-wide
#   ├── .claude/skills/
#   ├── docs/                             cross-product docs
#   ├── Terrascope/
#   │   ├── CLAUDE.md                     project memory
#   │   ├── .claude/skills/
#   │   ├── wiki/                         (was Neuvetra root contents)
#   │   │   ├── CLAUDE.md                 wiki schema
#   │   │   └── .claude/skills/
#   │   └── code/                         (was C:\Users\nimab\terrascope)
#   │       ├── CLAUDE.md                 code memory
#   │       └── .claude/skills/
#   └── FrontDesk/
#       ├── CLAUDE.md                     project memory
#       ├── .claude/skills/
#       ├── wiki/                         empty placeholder
#       │   ├── CLAUDE.md                 placeholder
#       │   └── .claude/skills/
#       └── code/                         (was C:\Users\nimab\front-desk)
#           ├── CLAUDE.md                 code memory
#           └── .claude/skills/
#
# Usage:
#   pwsh .\2026-04-25-restructure-v2.ps1               # dry-run by default
#   pwsh .\2026-04-25-restructure-v2.ps1 -Execute      # actually do it
#   pwsh .\2026-04-25-restructure-v2.ps1 -Rollback     # print undo commands
#
# Templates: ./templates-v2/*.md (read by this script and copied to destinations)
# =============================================================================

[CmdletBinding()]
param(
    [switch]$Execute,
    [switch]$Rollback
)

$ErrorActionPreference = 'Stop'

# -----------------------------------------------------------------------------
# Paths
# -----------------------------------------------------------------------------
$Umbrella       = 'C:\Users\nimab\Neuvetra'
$ScriptDir      = Split-Path -Parent $MyInvocation.MyCommand.Path
$TemplatesDir   = Join-Path $ScriptDir 'templates-v2'

$WikiTarget     = Join-Path $Umbrella 'Terrascope\wiki'
$TsTarget       = Join-Path $Umbrella 'Terrascope\code'
$FdTarget       = Join-Path $Umbrella 'FrontDesk\code'
$FdWikiTarget   = Join-Path $Umbrella 'FrontDesk\wiki'

$TsProjectDir   = Join-Path $Umbrella 'Terrascope'
$FdProjectDir   = Join-Path $Umbrella 'FrontDesk'

$TsSrc          = 'C:\Users\nimab\terrascope'
$FdSrc          = 'C:\Users\nimab\front-desk'

$Staging        = Join-Path $Umbrella '.migration-staging'
$Backup         = Join-Path $Umbrella '.migration-backup'
$LogFile        = Join-Path $Umbrella '.migration-log.txt'
$ArchiveDir     = Join-Path $Umbrella 'docs\archive'

$ParentClaudePath = Join-Path $Umbrella 'CLAUDE.md'
$Divider          = '# ────────────────────────────────────────────────────────────'

# Items at the umbrella root that should NOT be moved into Terrascope\wiki\
# (These stay at the root, get rewritten, or are migration scaffolding.)
$KeepAtRoot = @(
    'CLAUDE.md'
    'docs'
    'NEXT.md'
    'Terrascope'
    'FrontDesk'
    '.migration-staging'
    '.migration-backup'
    '.migration-log.txt'
)

# All the .claude\skills\ folders that need creating
$SkillsFolders = @(
    (Join-Path $Umbrella '.claude\skills')
    (Join-Path $TsProjectDir '.claude\skills')
    (Join-Path $WikiTarget '.claude\skills')
    (Join-Path $TsTarget '.claude\skills')
    (Join-Path $FdProjectDir '.claude\skills')
    (Join-Path $FdWikiTarget '.claude\skills')
    (Join-Path $FdTarget '.claude\skills')
)

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

function Assert-CleanGit($repoPath, [bool]$tolerateCorrupt = $false) {
    if (-not (Test-Path (Join-Path $repoPath '.git'))) {
        Write-Log "No .git in $repoPath — skipping git check."
        return
    }
    Push-Location $repoPath
    try {
        $status = git status --porcelain 2>&1
        if ($LASTEXITCODE -ne 0) {
            if ($tolerateCorrupt) {
                Write-Warning "git status failed in $repoPath (likely corrupted index). Tolerating."
                return
            }
            throw "PRECHECK FAILED: git status errored in $repoPath. Repair the repo or commit manually before retrying."
        }
        if ($status) {
            throw "PRECHECK FAILED: uncommitted changes in $repoPath`n$status`nCommit or stash, then retry."
        }
        Write-Log "git clean OK: $repoPath"
    } finally {
        Pop-Location
    }
}

# -----------------------------------------------------------------------------
# Rollback
# -----------------------------------------------------------------------------
if ($Rollback) {
    if (-not (Test-Path $LogFile)) {
        throw "No migration log found at $LogFile. Cannot rollback."
    }
    Write-Host "Rollback mode — printing reverse Move-Item commands from $LogFile" -ForegroundColor Cyan
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

Assert-Path $Umbrella       $true
Assert-Path $TsSrc          $true
Assert-Path $FdSrc          $true
Assert-Path $TemplatesDir   $true

# Verify all template files exist
$requiredTemplates = @(
    'root_CLAUDE.md'
    'Terrascope_CLAUDE.md'
    'FrontDesk_CLAUDE.md'
    'FrontDesk_wiki_CLAUDE.md'
    'skills_README.md'
)
foreach ($t in $requiredTemplates) {
    Assert-Path (Join-Path $TemplatesDir $t) $true
}

# Targets must NOT exist yet (script is not idempotent — re-runs require rollback first)
Assert-Path $TsProjectDir   $false
Assert-Path $FdProjectDir   $false
Assert-Path $Staging        $false

# Parent CLAUDE.md must contain the divider so we can split it cleanly
$parentText = Get-Content $ParentClaudePath -Raw
if ($parentText -notmatch [regex]::Escape($Divider)) {
    throw "PRECHECK FAILED: parent CLAUDE.md does not contain the wiki/parent divider. Cannot split safely."
}
Write-Log "Parent CLAUDE.md contains divider — split is possible."

# Git cleanliness — wiki has known index corruption, tolerate
Write-Log "Checking git cleanliness in source repos..."
Assert-CleanGit $Umbrella -tolerateCorrupt $true
Assert-CleanGit $TsSrc
Assert-CleanGit $FdSrc

if (-not $Execute) {
    Write-Host "`n*** DRY-RUN MODE. No changes will be made. Re-run with -Execute to perform the migration. ***`n" -ForegroundColor Yellow
}

# -----------------------------------------------------------------------------
# Step 1: Backup the original parent CLAUDE.md
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 1: Backup ===" -ForegroundColor Cyan
Invoke-Action "New-Item -ItemType Directory -Path '$Backup'" {
    New-Item -ItemType Directory -Path $Backup -Force | Out-Null
}
Invoke-Action "Copy-Item '$ParentClaudePath' '$Backup\CLAUDE.md.original'" {
    Copy-Item -LiteralPath $ParentClaudePath -Destination (Join-Path $Backup 'CLAUDE.md.original')
}

# -----------------------------------------------------------------------------
# Step 2: Stash current Neuvetra contents (the wiki)
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 2: Stash current wiki contents to staging ===" -ForegroundColor Cyan
Invoke-Action "New-Item -ItemType Directory -Path '$Staging'" {
    New-Item -ItemType Directory -Path $Staging -Force | Out-Null
}

$itemsToStash = Get-ChildItem -LiteralPath $Umbrella -Force | Where-Object { $KeepAtRoot -notcontains $_.Name }
foreach ($item in $itemsToStash) {
    $dest = Join-Path $Staging $item.Name
    Invoke-Action "Move-Item '$($item.FullName)' '$dest'" {
        Move-Item -LiteralPath $item.FullName -Destination $dest
    }
}

# -----------------------------------------------------------------------------
# Step 3: Build the Terrascope project tree and move staging into Terrascope\wiki
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 3: Build Terrascope tree ===" -ForegroundColor Cyan
Invoke-Action "New-Item -ItemType Directory -Path '$TsProjectDir'" {
    New-Item -ItemType Directory -Path $TsProjectDir -Force | Out-Null
}
Invoke-Action "Rename-Item '$Staging' '$WikiTarget'" {
    # Cross-folder move (staging is at root, wiki target is under Terrascope\)
    Move-Item -LiteralPath $Staging -Destination $WikiTarget
}

# -----------------------------------------------------------------------------
# Step 4: Move terrascope code into Terrascope\code
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 4: Move terrascope code ===" -ForegroundColor Cyan
Invoke-Action "Move-Item '$TsSrc' '$TsTarget'" {
    Move-Item -LiteralPath $TsSrc -Destination $TsTarget
}

# -----------------------------------------------------------------------------
# Step 5: Build the FrontDesk project tree
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 5: Build FrontDesk tree ===" -ForegroundColor Cyan
Invoke-Action "New-Item -ItemType Directory -Path '$FdProjectDir'" {
    New-Item -ItemType Directory -Path $FdProjectDir -Force | Out-Null
}
Invoke-Action "New-Item -ItemType Directory -Path '$FdWikiTarget' (empty placeholder)" {
    New-Item -ItemType Directory -Path $FdWikiTarget -Force | Out-Null
}
Invoke-Action "Move-Item '$FdSrc' '$FdTarget'" {
    Move-Item -LiteralPath $FdSrc -Destination $FdTarget
}

# -----------------------------------------------------------------------------
# Step 6: Split the original parent CLAUDE.md
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 6: Split + relocate the wiki schema ===" -ForegroundColor Cyan

# Extract the wiki-schema half (everything from the divider down) into the new
# Terrascope\wiki\CLAUDE.md, prefixed with a parent backref.
$splitIndex = $parentText.IndexOf($Divider)
$wikiBlock  = $parentText.Substring($splitIndex)

$wikiStart = $wikiBlock.IndexOf('# GHG Wiki — Operating Schema')
if ($wikiStart -lt 0) {
    throw "Could not locate '# GHG Wiki — Operating Schema' header in the wiki block. Aborting split."
}
$wikiBody = $wikiBlock.Substring($wikiStart)
$wikiBody = $wikiBody -replace '^# GHG Wiki — Operating Schema\s*\r?\n', ''

$wikiHeader = @'
# Terrascope Wiki — Operating Schema

> **Parent:** `..\CLAUDE.md` (Terrascope project). Read that first for the project context. The Neuvetra business-wide CLAUDE.md is one level above that.

This file is the wiki workspace's working manual. Below: page types, frontmatter schema, ingest/query/lint workflows, factor layer, calculation engine layer.

---

'@

$newWikiClaude = $wikiHeader + $wikiBody
$wikiClaudeDest = Join-Path $WikiTarget 'CLAUDE.md'

Invoke-Action "Set-Content '$wikiClaudeDest' (extracted wiki schema)" {
    Set-Content -LiteralPath $wikiClaudeDest -Value $newWikiClaude -Encoding UTF8
}

# -----------------------------------------------------------------------------
# Step 7: Install templates at all the new CLAUDE.md slots
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 7: Install templates ===" -ForegroundColor Cyan

$templateInstalls = @(
    @{ Template = 'root_CLAUDE.md';            Dest = $ParentClaudePath }
    @{ Template = 'Terrascope_CLAUDE.md';      Dest = (Join-Path $TsProjectDir 'CLAUDE.md') }
    @{ Template = 'FrontDesk_CLAUDE.md';       Dest = (Join-Path $FdProjectDir 'CLAUDE.md') }
    @{ Template = 'FrontDesk_wiki_CLAUDE.md';  Dest = (Join-Path $FdWikiTarget  'CLAUDE.md') }
)

foreach ($t in $templateInstalls) {
    $src = Join-Path $TemplatesDir $t.Template
    Invoke-Action "Copy-Item '$src' '$($t.Dest)'" {
        Copy-Item -LiteralPath $src -Destination $t.Dest -Force
    }
}

# -----------------------------------------------------------------------------
# Step 8: Create .claude\skills\ folders with .gitkeep + README.md at every level
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 8: Create .claude\skills\ scaffolding ===" -ForegroundColor Cyan

$skillsTemplate = Join-Path $TemplatesDir 'skills_README.md'
foreach ($folder in $SkillsFolders) {
    Invoke-Action "New-Item -ItemType Directory -Path '$folder'" {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
    }
    Invoke-Action "Set-Content '$folder\.gitkeep' (empty)" {
        Set-Content -LiteralPath (Join-Path $folder '.gitkeep') -Value '' -Encoding UTF8
    }
    Invoke-Action "Copy-Item '$skillsTemplate' '$folder\README.md'" {
        Copy-Item -LiteralPath $skillsTemplate -Destination (Join-Path $folder 'README.md') -Force
    }
}

# -----------------------------------------------------------------------------
# Step 9: Rewrite path references in moved files
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 9: Rewrite path references ===" -ForegroundColor Cyan

# Existing terrascope CLAUDE.md (now at Terrascope\code\CLAUDE.md)
# Existing front-desk CLAUDE.md (now at FrontDesk\code\CLAUDE.md)
# Both have absolute path references that need updating.

$rewrites = @(
    # Terrascope code CLAUDE.md
    @{ File = (Join-Path $TsTarget 'CLAUDE.md')
       Pairs = @(
           @{ Old = 'C:\Users\nimab\Neuvetra\CLAUDE.md';        New = 'C:\Users\nimab\Neuvetra\Terrascope\CLAUDE.md' }
           @{ Old = 'C:\Users\nimab\Neuvetra\wiki\';            New = 'C:\Users\nimab\Neuvetra\Terrascope\wiki\wiki\' }
           @{ Old = 'C:\Users\nimab\Neuvetra\factors\processed\'; New = 'C:\Users\nimab\Neuvetra\Terrascope\wiki\factors\processed\' }
           @{ Old = 'C:\Users\nimab\front-desk';                New = 'C:\Users\nimab\Neuvetra\FrontDesk\code' }
       )
    }
    # FrontDesk code CLAUDE.md
    @{ File = (Join-Path $FdTarget 'CLAUDE.md')
       Pairs = @(
           @{ Old = 'C:\Users\nimab\Neuvetra\CLAUDE.md'; New = 'C:\Users\nimab\Neuvetra\FrontDesk\CLAUDE.md' }
           @{ Old = 'C:\Users\nimab\terrascope';         New = 'C:\Users\nimab\Neuvetra\Terrascope\code' }
       )
    }
    # Terrascope seed-factors.ts — hardcoded CSV paths
    @{ File = (Join-Path $TsTarget 'packages\database\src\seed-factors.ts')
       Pairs = @(
           @{ Old = 'C:/Users/nimab/Neuvetra/factors/processed/'; New = 'C:/Users/nimab/Neuvetra/Terrascope/wiki/factors/processed/' }
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
# Step 10: Archive obsolete files
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 10: Archive obsolete restructure plan/script ===" -ForegroundColor Cyan
Invoke-Action "New-Item -ItemType Directory -Path '$ArchiveDir'" {
    New-Item -ItemType Directory -Path $ArchiveDir -Force | Out-Null
}
$obsoleteFiles = @(
    'docs\superpowers\specs\2026-04-25-monorepo-restructure-plan.md'
    'docs\superpowers\specs\2026-04-25-restructure.ps1'
)
foreach ($f in $obsoleteFiles) {
    $src = Join-Path $Umbrella $f
    $dst = Join-Path $ArchiveDir (Split-Path -Leaf $f)
    if (Test-Path $src) {
        Invoke-Action "Move-Item '$src' '$dst' (archive)" {
            Move-Item -LiteralPath $src -Destination $dst
        }
    } else {
        Write-Log "SKIP archive — already gone: $src"
    }
}

# -----------------------------------------------------------------------------
# Step 11: Post-flight verification
# -----------------------------------------------------------------------------
Write-Host "`n=== STEP 11: Post-flight verification ===" -ForegroundColor Cyan

if ($Execute) {
    # Top-level inventory
    $expected = @('CLAUDE.md', '.claude', 'docs', 'NEXT.md', 'Terrascope', 'FrontDesk', '.migration-backup', '.migration-log.txt')
    $actual = Get-ChildItem -LiteralPath $Umbrella -Force | Select-Object -ExpandProperty Name
    $missing = $expected | Where-Object { $actual -notcontains $_ }
    $extra   = $actual   | Where-Object { $expected -notcontains $_ }
    if ($missing) { Write-Warning "Missing under umbrella: $($missing -join ', ')" }
    if ($extra)   { Write-Warning "Unexpected under umbrella: $($extra -join ', ')" }
    if (-not $missing -and -not $extra) { Write-Host "Umbrella contents OK." -ForegroundColor Green }

    # Verify the seven CLAUDE.mds are in place
    $expectedClaudes = @(
        $ParentClaudePath
        (Join-Path $TsProjectDir 'CLAUDE.md')
        (Join-Path $WikiTarget   'CLAUDE.md')
        (Join-Path $TsTarget     'CLAUDE.md')
        (Join-Path $FdProjectDir 'CLAUDE.md')
        (Join-Path $FdWikiTarget 'CLAUDE.md')
        (Join-Path $FdTarget     'CLAUDE.md')
    )
    foreach ($c in $expectedClaudes) {
        if (Test-Path $c) {
            Write-Host "  OK   $c" -ForegroundColor Green
        } else {
            Write-Warning "  MISSING $c"
        }
    }

    # Verify .claude\skills\ folders
    foreach ($s in $SkillsFolders) {
        if ((Test-Path $s) -and (Test-Path (Join-Path $s '.gitkeep'))) {
            Write-Host "  OK   $s" -ForegroundColor Green
        } else {
            Write-Warning "  MISSING $s (or .gitkeep)"
        }
    }

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
            Where-Object {
                $_.FullName -notmatch '\\node_modules\\' -and
                $_.FullName -notmatch '\\\.git\\' -and
                $_.FullName -notmatch '\\\.migration-backup\\' -and
                $_.FullName -notmatch '\\docs\\archive\\'
            } |
            Select-String -Pattern $p -SimpleMatch:$false |
            ForEach-Object { Write-Warning "    stale ref: $($_.Path):$($_.LineNumber)  $($_.Line.Trim())" }
    }
} else {
    Write-Host "(verification skipped in dry-run)" -ForegroundColor Yellow
}

# -----------------------------------------------------------------------------
# Done
# -----------------------------------------------------------------------------
Write-Host "`n=== DONE ===" -ForegroundColor Green
if ($Execute) {
    Write-Host "Migration log:                $LogFile"           -ForegroundColor Green
    Write-Host "Backup of original CLAUDE.md: $Backup\CLAUDE.md.original"  -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Re-open IDE workspaces at the new paths."
    Write-Host "  2. Smoke test:"
    Write-Host "       cd $TsTarget"
    Write-Host "       bun install"
    Write-Host "       bun run --cwd apps/api dev"
    Write-Host "  3. Repair the wiki git index (if it was corrupted before this run)."
    Write-Host "  4. Commit the moved-and-restructured state in each repo (terrascope code, front-desk code, wiki)."
    Write-Host "  5. Rewrite seed-factors.ts to read CSV paths from a WIKI_ROOT env var (recommended follow-up)."
} else {
    Write-Host "This was a DRY RUN. Re-run with -Execute to actually perform the migration." -ForegroundColor Yellow
}
