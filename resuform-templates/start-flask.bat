@echo off
cd /d "%~dp0"
echo Starting ResuForm templates edition (Flask) on http://127.0.0.1:5001/
echo Original app is unchanged on port 5000 / 8080.
set PICA_FLASK_PORT=5001
py -3 -c "import flask" 2>nul
if errorlevel 1 (
  echo Installing Flask...
  py -3 -m pip install -r requirements.txt
  if errorlevel 1 python -m pip install -r requirements.txt
)
py -3 flask_app.py
if errorlevel 1 python flask_app.py
pause
