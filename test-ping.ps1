$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$websocat = Join-Path $here "websocat.exe"

if (!(Test-Path $websocat)) {
  throw "websocat.exe not found: $websocat"
}

$request = @{
  type = "request"
  id = "ping-1"
  method = "ping"
  closeAfterResponse = $true
} | ConvertTo-Json -Compress

Write-Host "Waiting for JLCEDA extension on ws://127.0.0.1:9050 ..."
Write-Host "If this waits too long, open JLCEDA Pro and check MCP Bridge -> Configure..."
$request | & $websocat -B 10485760 -t --no-close --oneshot ws-l:127.0.0.1:9050 -
