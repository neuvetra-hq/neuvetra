param([Parameter(Mandatory=$true)][string]$SourceReceipt,[Parameter(Mandatory=$true)][string]$ReceiptPath)
$ErrorActionPreference='Stop'
$stage='validate'
try {
  $root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../.tmp/m72-recovery-cluster'))
  $expected=[IO.Path]::GetFullPath('C:/Users/nimab/.codex/worktrees/4441/Neuvetra/.tmp/m72-recovery-cluster')
  if($root -ne $expected -or (Test-Path -LiteralPath $root) -or (Test-Path -LiteralPath $ReceiptPath)){throw 'new target required'}
  function Invoke-Hidden([string]$Executable,[string]$Arguments){
    $start=New-Object Diagnostics.ProcessStartInfo
    $start.FileName=$Executable;$start.Arguments=$Arguments;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $p=[Diagnostics.Process]::Start($start);$out=$p.StandardOutput.ReadToEndAsync();$err=$p.StandardError.ReadToEndAsync();$p.WaitForExit()
    if($p.ExitCode -ne 0){throw 'child failed'}
  }
  $stage='new_cluster'
  $bin='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin'
  Invoke-Hidden (Join-Path $bin 'initdb.exe') ('-D "'+$root+'" -U supabase_admin -A trust --encoding=UTF8 --locale=C')
  # New isolated device-local recovery cluster only. Never edit shared55463 configuration.
  Add-Content -LiteralPath (Join-Path $root 'postgresql.conf') -Value "`nlisten_addresses='127.0.0.1'`nport=55472`n" -Encoding ASCII
  $stage='start_hidden'
  Invoke-Hidden (Join-Path $bin 'pg_ctl.exe') ('-D "'+$root+'" -l "'+(Join-Path $root 'server.log')+'" -w start')
  $stage='metadata_prerequisites'
  foreach($arg in @($SourceReceipt,$ReceiptPath)){if($arg.Contains('"')){throw 'invalid path'}}
  Invoke-Hidden (Get-Command bun).Source ('run "'+(Join-Path $PSScriptRoot 'm72-bootstrap.ts')+'" "'+[IO.Path]::GetFullPath($SourceReceipt)+'" "'+[IO.Path]::GetFullPath($ReceiptPath)+'"')
  Write-Output '{"status":"m72_isolated_cluster_prepared","port":55472}'
}catch{Write-Output (ConvertTo-Json @{status='m72_cluster_prepare_failed';stage=$stage;preservedNewClusterMayRemain=$true} -Compress);exit 1}
