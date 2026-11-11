#requires -Version 5.1
#requires -RunAsAdministrator
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$EvidenceDirectory,
  [string]$ProbeScript = (Join-Path $PSScriptRoot 'vss-probe.ps1'),
  [string]$MissingFileProbeScript = (Join-Path $PSScriptRoot 'vss-missing-file.ps1')
)
# Disposable, fully installed Windows VM only. This is not a WinPE test.
# Calls SFEBoot's generated probe in separate powershell processes so exit1
# from the deliberate missing-file case cannot terminate fixture cleanup.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'A full Windows VM is required' }
if (Test-Path -LiteralPath $EvidenceDirectory) { throw 'EvidenceDirectory must be new' }
$fixture = 'C:\SFEBootVssFixture'
if (Test-Path -LiteralPath $fixture) { throw 'Fixture exists; refusing to overwrite' }
foreach ($script in @($ProbeScript,$MissingFileProbeScript)) {
  if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "Missing generated probe: $script" }
}
$null = New-Item -ItemType Directory -Path $EvidenceDirectory
$EvidenceDirectory = (Resolve-Path -LiteralPath $EvidenceDirectory).Path
$baselineId = $null
$fixtureCreated = $false
$initialIds = @()
$baselineCaptured = $false
$receipt = [ordered]@{product='SFEBoot';test='VSS VM acceptance';passed=$false;probeExecuted=$false;cleanupVerified=$false;applicationConsistent=$false;error=$null}
function Get-ShadowIds { return @(Get-CimInstance Win32_ShadowCopy | ForEach-Object { $_.ID } | Sort-Object) }
function Same-Ids($a,$b) { return (($a -join ',') -ceq ($b -join ',')) }
function Run-Probe([string]$Script,[string]$Name) {
  $output = Join-Path $EvidenceDirectory ($Name + '.json')
  $stderr = Join-Path $EvidenceDirectory ($Name + '.stderr.txt')
  # Arguments are a local file invocation; no shell concatenation or remote command.
  $text = & "$PSHOME\powershell.exe" -NoProfile -NonInteractive -File $Script 2> $stderr
  $code = $LASTEXITCODE
  $text | Set-Content -LiteralPath $output -Encoding UTF8
  return @{exitCode=$code;result=(($text -join "`n") | ConvertFrom-Json)}
}
try {
  $receipt.host = Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,OSArchitecture
  $receipt.probeSha256 = (Get-FileHash -LiteralPath $ProbeScript -Algorithm SHA256).Hash.ToLowerInvariant()
  $receipt.missingFileProbeSha256 = (Get-FileHash -LiteralPath $MissingFileProbeScript -Algorithm SHA256).Hash.ToLowerInvariant()
  $initialIds = @(Get-ShadowIds)
  $baselineCaptured = $true
  $receipt.initialShadowIds = $initialIds
  $null = New-Item -ItemType Directory -Path $fixture
  $fixtureCreated = $true
  [IO.File]::WriteAllBytes((Join-Path $fixture 'probe.txt'),[Text.Encoding]::UTF8.GetBytes('SFEBoot deterministic VSS fixture v1'))
  $expected = (Get-FileHash -LiteralPath (Join-Path $fixture 'probe.txt') -Algorithm SHA256).Hash.ToLowerInvariant()
  $receipt.expectedSha256 = $expected
  # Own a separate sentinel shadow. The production probe must preserve it.
  $sentinel = Invoke-CimMethod -ClassName Win32_ShadowCopy -MethodName Create -Arguments @{Volume='C:\';Context='ClientAccessible'}
  if ($sentinel.ReturnValue -ne 0) { throw ('Sentinel snapshot failed: ' + $sentinel.ReturnValue) }
  $baselineId = '{' + ([guid]$sentinel.ShadowID).ToString().ToUpperInvariant() + '}'
  $receipt.sentinelShadowId = $baselineId
  # Journal immediately so interruption recovery can delete this exact owned ID.
  $receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'ownership.json') -Encoding UTF8
  $sentinelObject = @(Get-CimInstance Win32_ShadowCopy -Filter ("ID = '" + $baselineId + "'"))
  if ($sentinelObject.Count -ne 1) { throw 'Sentinel identity is ambiguous' }
  [IO.File]::WriteAllBytes((Join-Path $fixture 'probe.txt'),[Text.Encoding]::UTF8.GetBytes('SFEBoot live fixture changed after sentinel snapshot v2'))
  $frozenHash = (Get-FileHash -LiteralPath ($sentinelObject[0].DeviceObject + '\SFEBootVssFixture\probe.txt') -Algorithm SHA256).Hash.ToLowerInvariant()
  $currentHash = (Get-FileHash -LiteralPath (Join-Path $fixture 'probe.txt') -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($frozenHash -cne $expected -or $currentHash -ceq $expected) { throw 'VSS did not preserve pre-change fixture bytes' }
  $receipt.snapshotIsolationVerified = $true
  $receipt.frozenSha256 = $frozenHash
  $expected = $currentHash
  $receipt.expectedSha256 = $expected
  $beforeProbe = Get-ShadowIds
  if ($beforeProbe -notcontains $baselineId) { throw 'Sentinel not found' }
  $success = Run-Probe $ProbeScript 'success'
  $receipt.probeExecuted = $true
  $receipt.successExitCode = $success.exitCode
  if ($success.exitCode -ne 0 -or -not $success.result.snapshotCreated -or -not $success.result.cleanupVerified -or $success.result.fileSha256 -cne $expected) { throw 'Snapshot file hash or success cleanup failed' }
  if ($success.result.shadowId -eq $baselineId) { throw 'Probe reported sentinel ownership' }
  if (-not (Same-Ids $beforeProbe (Get-ShadowIds))) { throw 'Success probe altered unrelated snapshots' }
  $failure = Run-Probe $MissingFileProbeScript 'missing-file'
  $receipt.failureExitCode = $failure.exitCode
  if ($failure.exitCode -eq 0 -or -not $failure.result.snapshotCreated -or -not $failure.result.cleanupVerified -or -not $failure.result.error) { throw 'Missing-file failure did not clean up its snapshot' }
  if (-not (Same-Ids $beforeProbe (Get-ShadowIds))) { throw 'Failure probe altered unrelated snapshots' }
  $receipt.snapshotHashMatched = $true
  $receipt.unrelatedSnapshotsPreserved = $true
  $receipt.failureCleanupVerified = $true
  $receipt.passed = $true
} catch {
  $receipt.error = $_.Exception.Message
} finally {
  try {
    if ($null -ne $baselineId) {
      $owned = @(Get-CimInstance Win32_ShadowCopy -Filter ("ID = '" + $baselineId + "'"))
      foreach ($item in $owned) {
        if ($item.ID -ne $baselineId) { throw 'Sentinel identity mismatch' }
        Remove-CimInstance -InputObject $item -ErrorAction Stop
      }
      if (@(Get-CimInstance Win32_ShadowCopy -Filter ("ID = '" + $baselineId + "'")).Count -ne 0) { throw 'Sentinel remains' }
    }
    if ($fixtureCreated) { Remove-Item -LiteralPath $fixture -Recurse -Force }
    if ($baselineCaptured) {
      $receipt.finalShadowIds = @(Get-ShadowIds)
      if (-not (Same-Ids $initialIds $receipt.finalShadowIds)) { throw 'Final shadow IDs differ from pre-test baseline' }
    }
    $receipt.cleanupVerified = $true
  } catch {
    $receipt.cleanupError = $_.Exception.Message
    $receipt.passed = $false
  }
  $receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'result.json') -Encoding UTF8
}
$receipt | ConvertTo-Json -Depth 8
if (-not $receipt.passed -or -not $receipt.cleanupVerified) { exit 1 }
