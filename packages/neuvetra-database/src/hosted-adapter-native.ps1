param([ValidateSet('shared','legacy')][string]$Suite='shared')
$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$fixtureRoot=Join-Path $env:TEMP ('shared-adapter-'+$Suite+'-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
$pgBin='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin'
$listener=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0)
$listener.Start();$fixturePort=$listener.LocalEndpoint.Port;$listener.Stop()
if($fixturePort -eq 55479){throw 'Retained port refused'}
function Invoke-Hidden([string]$Executable,[string[]]$Arguments,[string]$Name,[int]$Timeout=60000){
  $process=Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $fixtureRoot ($Name+'.out')) -RedirectStandardError (Join-Path $fixtureRoot ($Name+'.err'))
  if(-not $process.WaitForExit($Timeout)) { $process.Kill();$process.WaitForExit();throw "Child $Name exceeded supervision deadline; killed exact owned PID $($process.Id)." }
  return $process.ExitCode
}
$started=$false
try {
  $init=Invoke-Hidden "$pgBin/initdb.exe" @('-D',"`"$fixtureRoot/data`"",'-U','m63_test_admin','-A','trust','--encoding=UTF8','--locale=C') 'init'
  if($init -ne 0){throw "initdb exit $init"}
  $start=Invoke-Hidden "$pgBin/pg_ctl.exe" @('-D',"`"$fixtureRoot/data`"",'-l',"`"$fixtureRoot/server.log`"",'-o',"`"-h 127.0.0.1 -p $fixturePort`"",'-w','start') 'start'
  if($start -ne 0){throw "pg_ctl start exit $start"};$started=$true
  $name=if($Suite -eq 'shared'){'shared_adapter_native'}else{'m63_integration'}
  & "$pgBin/createdb.exe" -h 127.0.0.1 -p $fixturePort -U m63_test_admin $name
  if($LASTEXITCODE -ne 0){throw 'createdb failed'}
  $url="postgres://m63_test_admin@127.0.0.1:$fixturePort/$name"
  if($Suite -eq 'shared'){$env:SHARED_ADAPTER_TEST_DATABASE_URL=$url;$test='packages/neuvetra-database/src/hosted-adapter-native.test.ts'}else{$env:M63_TEST_DATABASE_URL=$url;$test='packages/neuvetra-database/src/hosted.test.ts'}
  $exit=Invoke-Hidden (Get-Command bun).Source @('test',$test) 'tests' 60000
  Get-Content (Join-Path $fixtureRoot 'tests.out')
  Get-Content (Join-Path $fixtureRoot 'tests.err')
  Write-Output "TEST_EXIT=$exit"
  if($exit -ne 0){throw "Native tests failed: $exit"}
} finally {
  if($started){
    $stop=Invoke-Hidden "$pgBin/pg_ctl.exe" @('-D',"`"$fixtureRoot/data`"",'-m','fast','-w','stop') 'stop'
    Write-Output "STOP_EXIT=$stop"
    & "$pgBin/pg_ctl.exe" -D "$fixtureRoot/data" status
    Write-Output "STATUS_EXIT=$LASTEXITCODE"
  }
  Write-Output "FIXTURE_ROOT=$fixtureRoot PORT=$fixturePort"
}