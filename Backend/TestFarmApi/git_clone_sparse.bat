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

:: Find files with the specified extension and add in batches of 10
set FILE_COUNT=0
set FILE_LIST=

for /f "delims=" %%F in ('git ls-tree -r --name-only HEAD ^| findstr "%EXTENSION%"') do (
    set /a FILE_COUNT+=1
    set FILE_LIST=!FILE_LIST! %%F
    
    if !FILE_COUNT! geq 10 (
        git sparse-checkout add !FILE_LIST!
        set FILE_LIST=
        set FILE_COUNT=0
    )
)

:: Add any remaining files
if not "!FILE_LIST!"=="" (
    git sparse-checkout add !FILE_LIST!
)

:: Checkout only the specified files
git checkout

echo Successfully cloned and checked out all .%EXTENSION% files!
exit /b 0
