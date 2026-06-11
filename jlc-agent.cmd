@echo off
setlocal
set "HERE=%~dp0"
set "NODE=%HERE%runtime\node.exe"
if not exist "%NODE%" set "NODE=node"
"%NODE%" "%HERE%agent\jlc-agent.js" %*
