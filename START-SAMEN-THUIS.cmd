@echo off
title Samen Thuis
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-samen-thuis.ps1"
if errorlevel 1 (
  echo.
  echo Starten is niet gelukt. Lees de foutmelding hierboven.
  pause
)
