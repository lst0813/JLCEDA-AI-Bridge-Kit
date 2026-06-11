param(
  [int]$Port = 9050,
  [int]$TimeoutMs = 60000
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $here "jlc-agent.cmd") ping --port $Port --timeout $TimeoutMs
