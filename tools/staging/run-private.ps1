param([Parameter(Mandatory=$true)][string]$ConfigPath,[Parameter(Mandatory=$true)][string]$ScriptPath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
try {
  $payload=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($ConfigPath),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  $start=New-Object Diagnostics.ProcessStartInfo
  $start.FileName=(Get-Command bun).Source
  $start.Arguments='run "'+[IO.Path]::GetFullPath($ScriptPath)+'"'
  $start.UseShellExecute=$false
  $start.CreateNoWindow=$true
  $start.RedirectStandardInput=$true
  $start.RedirectStandardOutput=$true
  $start.RedirectStandardError=$true
  $process=[Diagnostics.Process]::Start($start)
  $process.StandardInput.Write([Text.Encoding]::UTF8.GetString($payload))
  $process.StandardInput.Close()
  $output=$process.StandardOutput.ReadToEndAsync()
  $errors=$process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  # Only the operator script's explicitly sanitized stdout is published.
  Write-Output $output.Result
  if($process.ExitCode -ne 0){Write-Output 'Private operation failed; provider diagnostics withheld.';exit 1}
}catch{Write-Output 'Private operation unavailable.';exit 1}
