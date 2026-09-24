param([Parameter(Mandatory=$true)][string]$ArchivePath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
try {
  $target=[IO.Path]::GetFullPath($ArchivePath)
  $content=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd())
  if($content.Length -lt 100){throw 'empty bundle'}
  $protected=[Security.Cryptography.ProtectedData]::Protect($content,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  $stream=[IO.File]::Open($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$stream.Write($protected,0,$protected.Length);$stream.Flush($true)}finally{$stream.Dispose()}
  $restored=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($target),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  $hasher=[Security.Cryptography.SHA256]::Create()
  if([Convert]::ToBase64String($hasher.ComputeHash($content)) -ne [Convert]::ToBase64String($hasher.ComputeHash($restored))){throw 'mismatch'}
  Write-Output '{"status":"m72_bundle_sealed"}'
}catch{Write-Output '{"status":"m72_bundle_seal_failed"}';exit 1}
