@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ping-node.ps1" %*
