# =============================================================================
# Finish Restructure — Cross-Mount Code Moves
# =============================================================================
# The Cowork sandbox completed everything within C:\Users\nimab\Neuvetra\
# (templates, CLAUDE.mds, .claude/skills/ scaffolding, FrontDesk tree, wiki
# move). The only steps that need a native Windows shell are the cross-folder
# moves of terrascope\ and front-desk\ into the Neuvetra umbrella, plus a
# small cleanup of artifacts the sandbox couldn't delete.
#
# This script is idempotent-ish — safe to re-run if it errored partway. Each
# step is independent and uses -ErrorAction SilentlyContinue where appropriate.
#
# Usage (from any PowerShell prompt):
#   pwsh C:\Users\nimab\Neuvetra\docs\superpowers\specs\2026-04-25-finish-restructure.ps1
#
# Before running:
#   - Close any IDE windows pointing at C:\Users\nimab\terrascope or
#     C:\Users\nimab\front-desk
#   - Stop any running dev servers from those folders
# =============================================================================

$ErrorActionPreference = 'Stop'

Write-Host "`n=== Step 1: Cleanup partial-state artifacts from the sandbox attempt ===" -ForegroundColor Cyan

$cleanupTargets = @(
    'C:\Users\nimab\Neuvetra\Terrascope\code\.agents',         # duplicate from failed bash mv
    'C:\Users\nimab\Neuvetra\Terrascope\code\test-delete',     # leftover sandbox test
    'C:\Users\nimab\Neuvetra\test-empty',                       # leftover sandbox test
    'C:\Users\nimab\Neuvetra\.migration-staging'                # empty staging dir
)
foreach ($t in $cleanupTargets) {
    if (Test-Path $t) {
        Write-Host "  removing $t"
        Remove-Item -Recurse -Force $t
    } else {
        Write-Host "  (already gone) $t" -ForegroundColor DarkGray
    }
}

Write-Host "`n=== Step 2: Move terrascope\ -> Neuvetra\Terrascope\code\ ===" -ForegroundColor Cyan

$tsSrc = 'C:\Users\nimab\terrascope'
$tsDst = 'C:\Users\nimab\Neuvetra\Terrascope\code'

if (Test-Path $tsSrc) {
    if (-not (Test-Path $tsDst)) {
        New-Item -ItemType Directory -Path $tsDst -Force | Out-Null
    }
    $items = Get-ChildItem -Path $tsSrc -Force
    Write-Host "  moving $($items.Count) top-level items..."
    $items | Move-Item -Destination $tsDst
    Remove-Item $tsSrc
    Write-Host "  done. terrascope\ removed." -ForegroundColor Green
} else {
    Write-Host "  $tsSrc already gone — assuming this step ran previously." -ForegroundColor DarkGray
}

Write-Host "`n=== Step 3: Move front-desk\ -> Neuvetra\FrontDesk\code\ ===" -ForegroundColor Cyan

$fdSrc = 'C:\Users\nimab\front-desk'
$fdDst = 'C:\Users\nimab\Neuvetra\FrontDesk\code'

if (Test-Path $fdSrc) {
    if (-not (Test-Path $fdDst)) {
        New-Item -ItemType Directory -Path $fdDst -Force | Out-Null
    }
    $items = Get-ChildItem -Path $fdSrc -Force
    Write-Host "  moving $($items.Count) top-level items..."
    $items | Move-Item -Destination $fdDst
    Remove-Item $fdSrc
    Write-Host "  done. front-desk\ removed." -ForegroundColor Green
} else {
    Write-Host "  $fdSrc already gone — assuming this step ran previously." -ForegroundColor DarkGray
}

Write-Host "`n=== Step 4: Verify ===" -ForegroundColor Cyan

Write-Host "`nNeuvetra\ top-level:"
Get-ChildItem 'C:\Users\nimab\Neuvetra' -Force | Select-Object Mode, Name | Format-Table -AutoSize

Write-Host "`nTerrascope\code\ top-level:"
Get-ChildItem 'C:\Users\nimab\Neuvetra\Terrascope\code' -Force -ErrorAction SilentlyContinue | Select-Object Mode, Name | Format-Table -AutoSize

Write-Host "`nFrontDesk\code\ top-level:"
Get-ChildItem 'C:\Users\nimab\Neuvetra\FrontDesk\code' -Force -ErrorAction SilentlyContinue | Select-Object Mode, Name | Format-Table -AutoSize

Write-Host "`nSource folders (should both be gone):"
foreach ($p in @('C:\Users\nimab\terrascope', 'C:\Users\nimab\front-desk')) {
    if (Test-Path $p) {
        Write-Warning "  STILL EXISTS: $p"
    } else {
        Write-Host "  gone: $p" -ForegroundColor Green
    }
}

Write-Host "`n=== DONE ===" -ForegroundColor Green
Write-Host "Tell Claude when this finishes and it'll resume with path rewrites and final cleanup."
