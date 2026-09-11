@echo off
rem Stops and removes the "TestFarm Watchdog" Windows Service.
rem Run from an elevated prompt.

net session >nul 2>&1
if errorlevel 1 (
    echo This script must be run as Administrator.
    exit /b 1
)

py "%~dp0watchdog.py" stop
py "%~dp0watchdog.py" remove
