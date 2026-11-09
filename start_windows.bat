@echo off
cd /d "%~dp0"
where py >nul 2>&1
if not errorlevel 1 (
  start "Vampire Dominion server" cmd /k py -m http.server 8080
) else (
  start "Vampire Dominion server" cmd /k python -m http.server 8080
)
timeout /t 2 /nobreak >nul
start "" http://localhost:8080
