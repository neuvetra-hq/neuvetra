# =============================================================================
# Finish Restructure — Final Cleanup
# =============================================================================
# Diagnosis: the previous Move-Item runs actually completed the file copies
# successfully. The errors were Windows complaining that it couldn't DELETE
# the source folders — but the destinations are fully populated.
#
# Confirmed via sandbox inspection:
#   - C:\Users\nimab\terrascope       = empty shell (no files)
#   - C:\Users\nimab\front-desk       = only contains an EMPTY apps\web\.git\
#   - C:\Users\nimab\Neuvetra\Terrascope\code\  = full (CLAUDE.md, apps, packages, etc.)
#   - C:\Users\nimab\Neuvetra\FrontDesk\code\   = full incl. apps\web\.git (92MB, 11,792 files)
#
# This script just deletes the empty source folders and a few test artifacts.
# No Move-Item involved.
#
# Usage:
#   pwsh C:\Users\nimab\Neuvetra\docs\superpowers\specs\2026-04-25-finish-restructure-cleanup.ps1
#
# If a Remove-Item fails:
#   - Close any IDE/editor with those paths open
#   - Run PowerShell as Administrator (right-click -> Run as Admin)
#   - Reboot Windows (clears stubborn locks) and re-run
# =============================================================================

$ErrorActionPreference = 'Continue'

Write-Host "`n=== Step 1: Remove empty source folders ===" -ForegroundColor Cyan

$emptySources = @(
    'C:\Users\nimab\terrascope',
    'C:\Users\nimab\front-desk'
)
foreach ($p in $emptySources) {
    if (Test-Path $p) {
        try {
            # Clear read-only on anything left, then remove
            & cmd /c "attrib -R `"$p\*`" /S /D" 2>&1 | Out-Null
            Remove-Item -LiteralPath $p -Recurse -Force
            Write-Host "  removed: $p" -ForegroundColor Green
        } catch {
            Write-Warning "  FAILED to remove $p — $($_.Exception.Message)"
            Write-Host "  Try: close any IDE on these paths, or run this script as Admin." -ForegroundColor Yellow
        }
    } else {
        Write-Host "  (already gone) $p" -ForegroundColor DarkGray
    }
}

Write-Host "`n=== Step 2: Remove sandbox test artifacts and stale folders ===" -ForegroundColor Cyan

$cleanupTargets = @(
    'C:\Users\nimab\Neuvetra\test-empty',
    'C:\Users\nimab\Neuvetra\.migration-staging',
    'C:\Users\nimab\Neuvetra\Terrascope\code\test-delete-file',
    'C:\Users\nimab\Neuvetra\Terrascope\code\test-delete',
    'C:\Users\nimab\Neuvetra\FrontDesk\code\C:Usersnimabfront-deskdocssuperpowersplans'
)
foreach ($t in $cleanupTargets) {
    if (Test-Path -LiteralPath $t) {
        try {
            Remove-Item -LiteralPath $t -Recurse -Force
            Write-Host "  removed: $t" -ForegroundColor Green
        } catch {
            Write-Warning "  FAILED $t — $($_.Exception.Message)"
        }
    } else {
        Write-Host "  (already gone) $t" -ForegroundColor DarkGray
    }
}

Write-Host "`n=== Step 3: Verify final state ===" -ForegroundColor Cyan

Write-Host "`nNeuvetra\ top-level (expected: CLAUDE.md, NEXT.md, .claude, docs, FrontDesk, Terrascope, plus migration backup):"
Get-ChildItem 'C:\Users\nimab\Neuvetra' -Force | Select-Object Mode, Name | Format-Table -AutoSize

Write-Host "Terrascope\code\ top-level (should look like a real Bun monorepo):"
Get-ChildItem 'C:\Users\nimab\Neuvetra\Terrascope\code' -Force -ErrorAction SilentlyContinue |
    Select-Object Mode, Name | Format-Table -AutoSize

Write-Host "FrontDesk\code\ top-level (should look like a real Bun monorepo):"
Get-ChildItem 'C:\Users\nimab\Neuvetra\FrontDesk\code' -Force -ErrorAction SilentlyContinue |
    Select-Object Mode, Name | Format-Table -AutoSize

Write-Host "Source folders (both should be gone):"
foreach ($p in @('C:\Users\nimab\terrascope', 'C:\Users\nimab\front-desk')) {
    if (Test-Path $p) {
        Write-Warning "  STILL EXISTS: $p"
    } else {
        Write-Host "  gone: $p" -ForegroundColor Green
    }
}

Write-Host "`n=== DONE ===" -ForegroundColor Green
Write-Host "If both sources are gone and the destinations look right, tell Claude and we'll resume the path-rewrite + verification pass."
