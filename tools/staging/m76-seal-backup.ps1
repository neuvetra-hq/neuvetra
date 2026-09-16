param(
 [ValidateSet('Seal','Restore')][string]$Mode='Seal',
 [Parameter(Mandatory=$true)][string]$ArchivePath,
 [string]$PgRestorePath,
 [string]$DatabaseName,
 [string]$ReceiptPath,
 [ValidateSet(55463,55472)][int]$Port=55472
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$stage='configuration'
try {
 $target=[IO.Path]::GetFullPath($ArchivePath)
 $hasher=[Security.Cryptography.SHA256]::Create()
 if($Mode -eq 'Seal'){
  $content=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd())
  if($content.Length -lt 100){throw 'empty bundle'}
  $stage='protect'
  $protected=[Security.Cryptography.ProtectedData]::Protect($content,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  $stage='write_new_archive'
  $stream=[IO.File]::Open($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$stream.Write($protected,0,$protected.Length);$stream.Flush($true)}finally{$stream.Dispose()}
  $stage='verify_unprotect'
  $restored=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($target),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  if([Convert]::ToBase64String($hasher.ComputeHash($content)) -ne [Convert]::ToBase64String($hasher.ComputeHash($restored))){throw 'mismatch'}
  Write-Output '{"status":"m76_bundle_sealed"}'
 }else{
  if($DatabaseName -notmatch '^m76_(ops|qa|security)_[a-z0-9_]+$' -or -not $PgRestorePath -or -not $ReceiptPath -or (Test-Path -LiteralPath $ReceiptPath)){throw 'target refused'}
  $bytes=[IO.File]::ReadAllBytes($target)
  $hash=[BitConverter]::ToString($hasher.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
  $stage='unprotect'
  $bundle=[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))
  $start=New-Object Diagnostics.ProcessStartInfo
  $start.FileName=(Get-Command bun).Source
  $script=Join-Path $PSScriptRoot 'm76-restore.ts'
  foreach($arg in @($PgRestorePath,$ReceiptPath)){if($arg.Contains('"') -or $arg.Contains("`n") -or $arg.Contains("`r")){throw 'invalid path'}}
  $start.Arguments='run "'+$script+'" "'+[IO.Path]::GetFullPath($PgRestorePath)+'" '+$DatabaseName+' "'+[IO.Path]::GetFullPath($ReceiptPath)+'" '+$hash+' '+$Port
  $start.UseShellExecute=$false;$start.CreateNoWindow=$true
  $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
  $stage='restore_child'
  $process=[Diagnostics.Process]::Start($start)
  $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
  $process.StandardInput.Write($bundle);$process.StandardInput.Close();$process.WaitForExit()
  Write-Output $stdout.Result
  if($process.ExitCode -ne 0){throw 'restore failed'}
 }
}catch{Write-Output ('{"status":"m76_bundle_operation_failed","mode":"'+$Mode+'","stage":"'+$stage+'"}');exit 1}
