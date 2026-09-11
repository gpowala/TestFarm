@echo off
rem Installs and starts the "TestFarm Watchdog" Windows Service.
rem Run from an elevated prompt. The interpreter `py` resolves to here is baked into the
rem service, so activate the venv first if the dependencies live in one.
rem Extra options are forwarded to the install command, e.g.:
rem     install.bat --username .\testfarm --password secret

net session >nul 2>&1
if errorlevel 1 (
    echo This script must be run as Administrator.
    exit /b 1
)

py "%~dp0watchdog.py" --startup auto %* install
if errorlevel 1 exit /b 1

py "%~dp0watchdog.py" start
