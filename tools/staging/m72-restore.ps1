param([Parameter(Mandatory=$true)][string]$ArchivePath,[Parameter(Mandatory=$true)][string]$PgRestorePath,[Parameter(Mandatory=$true)][string]$DatabaseName,[Parameter(Mandatory=$true)][string]$ReceiptPath,[ValidateSet(55463,55472)][int]$Port=55472)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
try {
  if($DatabaseName -notmatch '^m72_(ops|qa|security)_[a-z0-9_]+$'){throw 'target refused'}
  $bytes=[IO.File]::ReadAllBytes([IO.Path]::GetFullPath($ArchivePath))
  $hasher=[Security.Cryptography.SHA256]::Create()
  $hash=[BitConverter]::ToString($hasher.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
  $bundle=[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))
  $start=New-Object Diagnostics.ProcessStartInfo
  $start.FileName=(Get-Command bun).Source
  $script=Join-Path $PSScriptRoot 'm72-restore.ts'
  foreach($arg in @($PgRestorePath,$ReceiptPath)){if($arg.Contains('"')){throw 'invalid path'}}
  $start.Arguments='run "'+$script+'" "'+[IO.Path]::GetFullPath($PgRestorePath)+'" '+$DatabaseName+' "'+[IO.Path]::GetFullPath($ReceiptPath)+'" '+$hash+' '+$Port
  $start.UseShellExecute=$false;$start.CreateNoWindow=$true
  $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
  $process=[Diagnostics.Process]::Start($start)
  $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
  $process.StandardInput.Write($bundle);$process.StandardInput.Close();$process.WaitForExit()
  Write-Output $stdout.Result
  if($process.ExitCode -ne 0){throw 'restore failed'}
}catch{Write-Output '{"status":"m72_restore_failed"}';exit 1}
