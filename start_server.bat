@echo off
title Kishore Finance Local Server
echo Starting Kishore Finance Local Server at http://localhost:8080 ...
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8080
pause
