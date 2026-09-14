param([Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
try {
  $config=[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($ConfigPath),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)) | ConvertFrom-Json
  $count=0
  foreach($entry in $config.env.PSObject.Properties){
    if($entry.Name -notmatch '^[A-Z][A-Z0-9_]*$'){throw 'Invalid variable name'}
    $start=New-Object Diagnostics.ProcessStartInfo
    $start.FileName=(Get-Command bunx).Source
    $start.Arguments='@railway/cli variable set '+$entry.Name+' --stdin --skip-deploys --project 119f3652-9d84-4d16-983c-1a17c0fd1aaa --environment 6642d65a-15a2-41e9-b25e-b7b01990aa28 --service f43abcf9-72f0-4034-828a-8d83ca26b0db'
    $start.UseShellExecute=$false
    $start.CreateNoWindow=$true
    $start.RedirectStandardInput=$true
    $start.RedirectStandardOutput=$true
    $start.RedirectStandardError=$true
    $process=[Diagnostics.Process]::Start($start)
    $process.StandardInput.Write([string]$entry.Value)
    $process.StandardInput.Close()
    $stdout=$process.StandardOutput.ReadToEndAsync()
    $stderr=$process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    if($process.ExitCode -ne 0){throw 'Variable update failed'}
    $count++
  }
  Write-Output (ConvertTo-Json @{status='existing_service_variables_set_without_deploy';count=$count})
}catch{Write-Output 'Service variable update failed; values and provider diagnostics withheld.';exit 1}
