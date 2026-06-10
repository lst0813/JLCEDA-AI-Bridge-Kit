param(
  [int]$Port = 9050,
  [int]$TimeoutMs = 30000
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Join-Path $here "runtime\node.exe"
if (!(Test-Path $node)) {
  $node = "node"
}

& $node (Join-Path $here "scripts\bridge-call.js") --method tools.list --port $Port --timeout $TimeoutMs
