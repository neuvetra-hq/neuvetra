# =============================================================================
# Recovery: Finish the FrontDesk Move + Cleanup
# =============================================================================
# After running 2026-04-25-finish-restructure.ps1:
#   - terrascope\ -> Neuvetra\Terrascope\code\  COMPLETED
#   - front-desk\ -> Neuvetra\FrontDesk\code\   PARTIAL (apps\ stuck due to
#     nested .git permissions)
#
# This script:
#   1. Clears read-only attributes on git internals
#   2. Optionally closes processes that may be holding files
#   3. Uses robocopy /MOVE (more robust than Move-Item) to finish the move
#   4. Cleans up leftover artifacts
#   5. Verifies final state
#
# If robocopy still fails on something:
#   - Reboot Windows (clears all locks) and re-run this script
#   - Or run this script in an elevated (Admin) PowerShell
#
# Usage:
#   pwsh C:\Users\nimab\Neuvetra\docs\superpowers\specs\2026-04-25-finish-restructure-recovery.ps1
# =============================================================================

$ErrorActionPreference = 'Continue'  # don't halt on minor issues

Write-Host "`n=== Step 1: Clean up Terrascope leftovers ===" -ForegroundColor Cyan

# Empty terrascope source folder (move completed; just the shell remains)
if (Test-Path 'C:\Users\nimab\terrascope') {
    $remaining = Get-ChildItem 'C:\Users\nimab\terrascope' -Force -ErrorAction SilentlyContinue
    if ($remaining.Count -eq 0) {
        Remove-Item 'C:\Users\nimab\terrascope' -Force
        Write-Host "  removed empty C:\Users\nimab\terrascope" -ForegroundColor Green
    } else {
        Write-Warning "  C:\Users\nimab\terrascope still has contents: $($remaining.Name -join ', ')"
    }
}

# Test artifacts I left behind in Terrascope/code
Remove-Item 'C:\Users\nimab\Neuvetra\Terrascope\code\test-delete-file' -Force -ErrorAction SilentlyContinue
Remove-Item 'C:\Users\nimab\Neuvetra\Terrascope\code\test-delete' -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n=== Step 2: Investigate what's holding front-desk files ===" -ForegroundColor Cyan

# Look for processes whose path or title references front-desk
$blockers = Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like '*front-desk*' -or
    $_.MainWindowTitle -like '*front-desk*' -or
    $_.Name -in @('Code', 'Cursor', 'rider64', 'webstorm64', 'sublime_text', 'sourcetree', 'gitkraken', 'fsmonitor--daemon')
}

if ($blockers) {
    Write-Host "These processes may be holding front-desk files:" -ForegroundColor Yellow
    $blockers | Select-Object Id, Name, MainWindowTitle | Format-Table -AutoSize
    Write-Host "If the move still fails after this script, close these and try again." -ForegroundColor Yellow
} else {
    Write-Host "  no obvious blocker processes detected." -ForegroundColor Green
}

Write-Host "`n=== Step 3: Clear read-only attributes on front-desk git internals ===" -ForegroundColor Cyan

if (Test-Path 'C:\Users\nimab\front-desk') {
    # Git pack files are read-only by default. attrib -R clears that recursively.
    # /S recurses, /D includes directories.
    & cmd /c 'attrib -R "C:\Users\nimab\front-desk\*" /S /D' 2>&1 | Out-Null
    Write-Host "  read-only attributes cleared." -ForegroundColor Green
} else {
    Write-Host "  C:\Users\nimab\front-desk already gone — skipping." -ForegroundColor DarkGray
}

Write-Host "`n=== Step 4: Robocopy /MOVE to finish ===" -ForegroundColor Cyan

if (Test-Path 'C:\Users\nimab\front-desk') {
    $log = 'C:\Users\nimab\Neuvetra\.migration-robocopy.log'
    Write-Host "  robocopy log: $log"
    # /MOVE       copy then delete source
    # /E          include all subdirs (even empty)
    # /R:3        retry 3x on failure
    # /W:1        wait 1s between retries
    # /XJ         exclude junction points (avoids symlink loops)
    # /MT:8       multi-threaded
    # /NFL /NDL   suppress per-file/dir output (logged to file)
    # /NP         no progress percentages
    & robocopy 'C:\Users\nimab\front-desk' 'C:\Users\nimab\Neuvetra\FrontDesk\code' `
        /MOVE /E /R:3 /W:1 /XJ /MT:8 /NFL /NDL /NP /LOG:$log

    $rc = $LASTEXITCODE
    Write-Host "  robocopy exit code: $rc"
    # robocopy exit codes: 0-7 = success (various flavors), 8+ = failure
    if ($rc -lt 8) {
        Write-Host "  robocopy reports success." -ForegroundColor Green
    } else {
        Write-Warning "  robocopy reports failure. See $log"
    }
} else {
    Write-Host "  C:\Users\nimab\front-desk already gone — skipping move." -ForegroundColor DarkGray
}

Write-Host "`n=== Step 5: Cleanup the weird artifact and stale files ===" -ForegroundColor Cyan

# This is a file/folder with no backslashes from a previous typo
$weirdPath = 'C:\Users\nimab\Neuvetra\FrontDesk\code\C:Usersnimabfront-deskdocssuperpowersplans'
if (Test-Path -LiteralPath $weirdPath) {
    Write-Host "  removing weird artifact: $weirdPath"
    Remove-Item -LiteralPath $weirdPath -Recurse -Force
}

# Sandbox leftovers I couldn't delete from the bash side
Remove-Item 'C:\Users\nimab\Neuvetra\test-empty' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item 'C:\Users\nimab\Neuvetra\.migration-staging' -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n=== Step 6: Verify final state ===" -ForegroundColor Cyan

Write-Host "`nNeuvetra\ top-level (expected: CLAUDE.md, NEXT.md, .claude, docs, FrontDesk, Terrascope, plus migration backup):"
Get-ChildItem 'C:\Users\nimab\Neuvetra' -Force | Select-Object Mode, Name | Format-Table -AutoSize

Write-Host "`nTerrascope\code\ top-level:"
Get-ChildItem 'C:\Users\nimab\Neuvetra\Terrascope\code' -Force -ErrorAction SilentlyContinue | Select-Object Mode, Name | Format-Table -AutoSize

Write-Host "`nFrontDesk\code\ top-level:"
Get-ChildItem 'C:\Users\nimab\Neuvetra\FrontDesk\code' -Force -ErrorAction SilentlyContinue | Select-Object Mode, Name | Format-Table -AutoSize

Write-Host "`nSource folders (should both be gone):"
foreach ($p in @('C:\Users\nimab\terrascope', 'C:\Users\nimab\front-desk')) {
    if (Test-Path $p) {
        Write-Warning "  STILL EXISTS: $p"
        Get-ChildItem $p -Recurse -Force -ErrorAction SilentlyContinue | Select-Object -First 10 -ExpandProperty FullName
    } else {
        Write-Host "  gone: $p" -ForegroundColor Green
    }
}

Write-Host "`n=== DONE ===" -ForegroundColor Green
Write-Host "If front-desk source is gone and FrontDesk\code looks right, tell Claude and we'll resume."
Write-Host "If front-desk still exists, check the robocopy log above and consider:"
Write-Host "  - Closing any IDE/editor open on those files"
Write-Host "  - Rebooting Windows (clears stubborn locks) and re-running this script"
Write-Host "  - Running PowerShell as Administrator (right-click -> Run as Admin)"
