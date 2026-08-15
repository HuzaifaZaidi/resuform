@echo off
cd /d "%~dp0"
echo Starting ResuForm resume builder (Flask)...
py -3 -c "import flask" 2>nul
if errorlevel 1 (
  echo Installing Flask...
  py -3 -m pip install -r requirements.txt
  if errorlevel 1 python -m pip install -r requirements.txt
)
py -3 flask_app.py
if errorlevel 1 python flask_app.py
pause
