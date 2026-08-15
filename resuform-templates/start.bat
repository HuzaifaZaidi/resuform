@echo off
cd /d "%~dp0"
echo Starting ResuForm templates edition on http://127.0.0.1:8081/
echo Original app is unchanged on port 8080.
set PICA_PORT=8081
py -3 server.py
if errorlevel 1 python server.py
pause
