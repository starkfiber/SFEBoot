/** Generate an inspectable, local Windows VSS acceptance script. Never executes PowerShell. */
export function vssScript({volume,relativePath}={}){
 if(typeof volume!=='string'||!/^([A-Za-z]):\\$/.test(volume))throw Error('Use an explicit Windows volume root such as C:\\');
 volume=volume.toUpperCase();
 if(relativePath!==undefined&&(typeof relativePath!=='string'||!relativePath||relativePath.length>200||!/^[a-zA-Z0-9 _./\\-]+$/.test(relativePath)||/^[\\/]/.test(relativePath)||relativePath.split(/[\\/]/).some(x=>!x||x==='.'||x==='..'||/[ .]$/.test(x))))throw Error('Use a simple volume-relative file path without traversal or commands');
 const p=relativePath?.replaceAll('/','\\');
 const script=`#requires -Version 5.1
#requires -RunAsAdministrator
# SFEBoot experimental VSS acceptance probe. Review and run LOCALLY on Windows.
# Creates one ClientAccessible shadow, reads its metadata${p?' and hashes one file':''}, then deletes ONLY its own ShadowID.
# ClientAccessible does NOT involve VSS application writers: no application-consistency claim.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Windows required' }
$volume = '${volume}'
$drive = $volume.Substring(0,2)
$vol = @(Get-CimInstance Win32_Volume -Filter ("DriveLetter = '" + $drive + "'"))
if ($vol.Count -ne 1 -or $vol[0].FileSystem -ne 'NTFS') { throw 'A single existing NTFS volume is required' }
$createdId = $null
$receipt = [ordered]@{product='SFEBoot'; scope='VSS ClientAccessible probe'; volume=$volume; context='ClientAccessible'; applicationConsistent=$false; snapshotCreated=$false; cleanupVerified=$false; error=$null}
try {
  $created = Invoke-CimMethod -ClassName Win32_ShadowCopy -MethodName Create -Arguments @{Volume=$volume; Context='ClientAccessible'}
  if ($created.ReturnValue -ne 0) { throw ("VSS Create failed: " + $created.ReturnValue) }
  $createdId = '{' + ([guid]$created.ShadowID).ToString().ToUpperInvariant() + '}'
  $receipt.shadowId = $createdId
  $receipt.snapshotCreated = $true
  $owned = @(Get-CimInstance Win32_ShadowCopy -Filter ("ID = '" + $createdId + "'"))
  if ($owned.Count -ne 1 -or $owned[0].ID -ne $createdId) { throw 'Created shadow could not be uniquely resolved' }
  $receipt.deviceObject = $owned[0].DeviceObject
  $receipt.devicePathUsableAfterCleanup = $false
${p?`  $probe = $owned[0].DeviceObject + '\\${p}'
  $receipt.relativePath = '${p}'
  $receipt.fileSha256 = (Get-FileHash -LiteralPath $probe -Algorithm SHA256).Hash.ToLowerInvariant()
`:''}} catch {
  $receipt.error = $_.Exception.Message
} finally {
  if ($null -ne $createdId) {
    try {
      $owned = @(Get-CimInstance Win32_ShadowCopy -Filter ("ID = '" + $createdId + "'"))
      foreach ($item in $owned) {
        if ($item.ID -ne $createdId) { throw 'Shadow identity changed; refusing deletion' }
        Remove-CimInstance -InputObject $item -ErrorAction Stop
      }
      $remaining = @(Get-CimInstance Win32_ShadowCopy -Filter ("ID = '" + $createdId + "'"))
      $receipt.cleanupVerified = ($remaining.Count -eq 0)
      if (-not $receipt.cleanupVerified) { throw 'Owned snapshot remains' }
    } catch {
      $receipt.cleanupError = $_.Exception.Message
      Write-Warning ("Inspect only owned ShadowID " + $createdId + ": " + $_.Exception.Message)
    }
  }
}
$receipt | ConvertTo-Json -Depth 5
if ($receipt.error -or -not $receipt.snapshotCreated -or -not $receipt.cleanupVerified) { exit 1 }
`;
 return {script,executed:false,qualification:'Windows runtime untested; script generation and rejection checks only',scope:'Local NTFS ClientAccessible snapshot metadata/probe and exact-owned-ID cleanup; not a backup or writer-coordinated requester',requires:['Windows PowerShell 5.1 or compatible Windows PowerShell environment','Administrator','Existing supported NTFS volume and VSS provider'],references:['https://learn.microsoft.com/en-us/previous-versions/windows/desktop/vsswmi/create-method-in-class-win32-shadowcopy','https://learn.microsoft.com/en-us/windows/win32/vss/shadow-copy-context-configurations']};
}
