param(
  [Parameter(Mandatory=$true)]
  [string]$Name,

  [string]$ArgumentsJson = "{}",
  [int]$Port = 9050,
  [int]$TimeoutMs = 60000
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Join-Path $here "runtime\node.exe"
if (!(Test-Path $node)) {
  $node = "node"
}

& $node (Join-Path $here "scripts\bridge-call.js") --tool $Name --args $ArgumentsJson --port $Port --timeout $TimeoutMs
