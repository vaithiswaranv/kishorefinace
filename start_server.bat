@echo off
title FinFlow Local Server
echo Starting FinFlow Local Server at http://localhost:8080 ...
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8080
pause
