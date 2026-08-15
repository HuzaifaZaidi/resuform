@echo off
cd /d "%~dp0"
echo Starting ResuForm resume builder...
py -3 server.py
if errorlevel 1 python server.py
pause
