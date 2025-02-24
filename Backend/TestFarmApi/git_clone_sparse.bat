@echo off
setlocal enabledelayedexpansion

:: Get command-line arguments
set REPO_URL=%1
set TARGET_DIR=%2
set EXTENSION=%3

:: Clone the repository without checking out files
git clone --no-checkout %REPO_URL% %TARGET_DIR%
if %errorlevel% neq 0 exit /b %errorlevel%
cd %TARGET_DIR%

:: Enable sparse checkout
git sparse-checkout init --cone
git sparse-checkout set --no-cone

:: Find files with the specified extension
for /f "delims=" %%F in ('git ls-tree -r --name-only HEAD ^| findstr "%EXTENSION%"') do (
    set FILE_LIST=!FILE_LIST! %%F
)

:: Check if any files were found
if "%FILE_LIST%"=="" (
    echo No files with extension .%EXTENSION% found.
    exit /b 1
)

:: Add found files to sparse checkout
git sparse-checkout set %FILE_LIST%

:: Checkout only the specified files
git checkout

echo Successfully cloned and checked out all .%EXTENSION% files!
exit /b 0
