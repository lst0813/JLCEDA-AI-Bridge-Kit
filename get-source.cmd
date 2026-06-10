@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0get-source-node.ps1" %*
