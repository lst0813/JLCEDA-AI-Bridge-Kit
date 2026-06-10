param(
  [Parameter(Mandatory=$true)]
  [string]$Name,

  [string]$ArgumentsJson = "{}"
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$websocat = Join-Path $here "websocat.exe"

if (!(Test-Path $websocat)) {
  throw "websocat.exe not found: $websocat"
}

$arguments = $ArgumentsJson | ConvertFrom-Json
$request = @{
  type = "request"
  id = "call-1"
  method = "tools.call"
  params = @{
    name = $Name
    arguments = $arguments
  }
  closeAfterResponse = $true
} | ConvertTo-Json -Compress -Depth 100

Write-Host "Calling $Name ..."
$request | & $websocat -B 10485760 -t --no-close --oneshot ws-l:127.0.0.1:9050 -
