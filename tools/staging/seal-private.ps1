param([Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
try {
  $target = [IO.Path]::GetFullPath($OutputPath)
  $root = [IO.Path]::GetFullPath('C:\Users\nimab\Neuvetra\m63-runtime\recovery') + [IO.Path]::DirectorySeparatorChar
  if (!$target.StartsWith($root,[StringComparison]::OrdinalIgnoreCase) -or [IO.File]::Exists($target)) { throw 'invalid target' }
  $bytes = [Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd())
  $scope = [Security.Cryptography.DataProtectionScope]::CurrentUser
  [IO.File]::WriteAllBytes($target,[Security.Cryptography.ProtectedData]::Protect($bytes,$null,$scope))
  $check = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($target),$null,$scope)
  if ([Convert]::ToBase64String($bytes) -ne [Convert]::ToBase64String($check)) { throw 'verification failed' }
  Write-Output 'Private configuration encrypted and verified.'
} catch { Write-Output 'Private configuration could not be sealed.'; exit 1 }
