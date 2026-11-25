@echo off
cd /d "%~dp0"
set PORT=8765
echo.
echo   Campus Market  -  http://127.0.0.1:%PORT%/
echo   Keep this window open. Press Ctrl+C to stop.
echo.
start "" "http://127.0.0.1:%PORT%/"
python -m http.server %PORT% --bind 127.0.0.1 --directory web
if errorlevel 1 (
  echo.
  echo   Python not found. Install Python, or run:  npx serve web
  pause
)
