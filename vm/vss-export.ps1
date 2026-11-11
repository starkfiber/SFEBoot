#requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$EvidenceDirectory)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Export only this test's bounded receipts to the VM's COM1 file backend.
# No networking, host filesystem sharing, credentials or arbitrary file selection.
if (-not (Test-Path -LiteralPath (Join-Path $EvidenceDirectory 'result.json') -PathType Leaf)) { throw 'Test result.json is required' }
$files = @()
foreach ($name in @('result.json','success.json','missing-file.json','ownership.json','success.stderr.txt','missing-file.stderr.txt')) {
  $file = Join-Path $EvidenceDirectory $name
  if (Test-Path -LiteralPath $file -PathType Leaf) {
    $data = [IO.File]::ReadAllBytes($file)
    if ($data.Length -gt 65536) { throw "Receipt exceeds 64KiB: $name" }
    $files += @{name=$name;sha256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant();base64=[Convert]::ToBase64String($data)}
  }
}
$json = @{format='sfeboot-vss-serial-v1';files=$files} | ConvertTo-Json -Depth 6 -Compress
$payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
$port = New-Object System.IO.Ports.SerialPort 'COM1',115200,'None',8,'One'
$port.WriteTimeout = 10000
try {
  $port.Open()
  $port.WriteLine("`nSFEBOOT_VSS_RECEIPTS_BEGIN`n" + $payload + "`nSFEBOOT_VSS_RECEIPTS_END`n")
  Write-Output ('Exported ' + $files.Count + ' receipt files to VM COM1')
} finally {
  if ($port.IsOpen) { $port.Close() }
  $port.Dispose()
}
