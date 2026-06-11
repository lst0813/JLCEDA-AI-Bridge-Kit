param(
  [Parameter(Mandatory=$true)]
  [string]$Name,

  [string]$ArgumentsJson = "{}",
  [int]$Port = 9050,
  [int]$TimeoutMs = 60000
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $here "jlc-agent.cmd") call --tool $Name --args-json $ArgumentsJson --port $Port --timeout $TimeoutMs
