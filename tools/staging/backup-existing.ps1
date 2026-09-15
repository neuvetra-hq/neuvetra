param(
  [Parameter(Mandatory=$true)][string]$ExportPath,
  [Parameter(Mandatory=$true)][string]$PgDumpPath,
  [Parameter(Mandatory=$true)][string]$CertificatePath,
  [Parameter(Mandatory=$true)][string]$RecoveryDirectory,
  [switch]$ApplicationOnly
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$stage = 'validate'
$plainPath = $null
try {
  $values = @()
  foreach ($line in [IO.File]::ReadAllLines($ExportPath)) {
    if ($line -match '^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*?)\s*$') {
      $value = $Matches[1]
      if ($value.StartsWith('"')) { $value = ConvertFrom-Json $value }
      elseif ($value.StartsWith("'") -and $value.EndsWith("'")) { $value = $value.Substring(1,$value.Length-2) }
      $values += $value
    } elseif ($line -match '^\s*"DATABASE_URL"\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$') { $values += (ConvertFrom-Json $Matches[1]) }
  }
  if ($values.Count -ne 1) { throw 'invalid export' }
  $uri = [Uri]$values[0]
  $userInfo = $uri.UserInfo.Split(':',2)
  if ($uri.Host -ne 'aws-1-us-west-1.pooler.supabase.com' -or $uri.Port -ne 5432 -or $uri.AbsolutePath -ne '/postgres' -or [Uri]::UnescapeDataString($userInfo[0]) -ne 'postgres.icockcoguyadhryzydvl') { throw 'target mismatch' }
  $recoveryRoot = [IO.Path]::GetFullPath($RecoveryDirectory)
  $allowedRoot = [IO.Path]::GetFullPath('C:\Users\nimab\Neuvetra\m63-runtime\recovery')
  if ($recoveryRoot -ne $allowedRoot) { throw 'recovery target mismatch' }
  [IO.Directory]::CreateDirectory($recoveryRoot) | Out-Null
  $stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
  $prefix = if ($ApplicationOnly) { 'm63-application' } else { 'pre-m63' }
  $plainPath = Join-Path $recoveryRoot "$prefix-$stamp.dump"
  $sealedPath = "$plainPath.dpapi"
  if ([IO.File]::Exists($plainPath) -or [IO.File]::Exists($sealedPath)) { throw 'existing output' }
  $stage = 'dump'
  $start = New-Object Diagnostics.ProcessStartInfo
  $start.FileName = [IO.Path]::GetFullPath($PgDumpPath)
  $start.Arguments = '--format=custom --no-password --file="' + $plainPath + '"'
  if ($ApplicationOnly) { $start.Arguments += ' --schema=neuvetra' }
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  foreach ($key in @($start.EnvironmentVariables.Keys)) { if ($key -like 'PG*') { $start.EnvironmentVariables.Remove($key) } }
  $start.EnvironmentVariables['PGHOST'] = $uri.Host
  $start.EnvironmentVariables['PGPORT'] = '5432'
  $start.EnvironmentVariables['PGDATABASE'] = 'postgres'
  $start.EnvironmentVariables['PGUSER'] = [Uri]::UnescapeDataString($userInfo[0])
  $start.EnvironmentVariables['PGPASSWORD'] = [Uri]::UnescapeDataString($userInfo[1])
  $start.EnvironmentVariables['PGSSLMODE'] = 'verify-full'
  $start.EnvironmentVariables['PGSSLROOTCERT'] = [IO.Path]::GetFullPath($CertificatePath)
  $start.EnvironmentVariables['PGCONNECT_TIMEOUT'] = '15'
  $process = [Diagnostics.Process]::Start($start)
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw 'dump failed' }
  $stage = 'encrypt and verify'
  $bytes = [IO.File]::ReadAllBytes($plainPath)
  if ($bytes.Length -lt 16) { throw 'empty archive' }
  $sha = [Security.Cryptography.SHA256]::Create()
  $hash = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
  $scope = [Security.Cryptography.DataProtectionScope]::CurrentUser
  $sealed = [Security.Cryptography.ProtectedData]::Protect($bytes,$null,$scope)
  [IO.File]::WriteAllBytes($sealedPath,$sealed)
  $restored = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($sealedPath),$null,$scope)
  $restoredHash = [BitConverter]::ToString($sha.ComputeHash($restored)).Replace('-','').ToLowerInvariant()
  if ($hash -ne $restoredHash) { throw 'verification failed' }
  $receipt = [ordered]@{ status='encrypted_backup_verified'; project='icockcoguyadhryzydvl'; createdUtc=$stamp; scope=$(if ($ApplicationOnly) {'neuvetra application schema only; Auth provider excluded'} else {'full existing database'}); archiveBytes=$bytes.Length; sha256=$hash; archive=$sealedPath; protection='Windows DPAPI current user; requires this Windows identity and recovery profile'; clientTls='verify-full configured CA and hostname'; restoreDrill='pending; decryption/hash verification only' }
  $receipt | ConvertTo-Json | Set-Content -LiteralPath "$sealedPath.receipt.json" -Encoding UTF8
  Remove-Item -LiteralPath $plainPath
  $receipt | ConvertTo-Json
} catch {
  # Never render driver diagnostics, exported values, or database contents.
  Write-Output (ConvertTo-Json @{status='backup_failed';stage=$stage;plaintextMayRemain=($null -ne $plainPath -and [IO.File]::Exists($plainPath))})
  exit 1
}
