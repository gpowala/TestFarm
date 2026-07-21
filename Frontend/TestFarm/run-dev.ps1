<#
.SYNOPSIS
    Runs the TestFarm Angular frontend in watch/live-reload mode against a
    backend API expected at http://localhost:3000.

.DESCRIPTION
    - Ensures npm dependencies are installed.
    - Optionally checks that the backend on port 3000 is reachable.
    - Starts `ng serve` (Angular dev server) which watches source files and
      reloads the browser on change.

    The API base URL is defined in src/environments/environment.ts and already
    points at http://localhost:3000, so no extra config is needed.

.PARAMETER Port
    Port for the Angular dev server (default 4200).

.PARAMETER Open
    Open the browser automatically once the server is up.

.EXAMPLE
    ./run-dev.ps1
    ./run-dev.ps1 -Port 4300 -Open
#>
[CmdletBinding()]
param(
    [int]$Port = 4200,
    [switch]$Open
)

$ErrorActionPreference = 'Stop'

# Always operate from the folder this script lives in.
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "TestFarm frontend -> backend API at http://localhost:3000" -ForegroundColor Cyan

# 1. Install dependencies if missing.
if (-not (Test-Path (Join-Path $scriptDir 'node_modules/@angular/cli'))) {
    Write-Host "Installing npm dependencies (first run)..." -ForegroundColor Yellow
    npm install
}

# 2. Friendly heads-up if the backend isn't up yet (non-fatal).
$backend = Test-NetConnection -ComputerName 'localhost' -Port 3000 -WarningAction SilentlyContinue
if (-not $backend.TcpTestSucceeded) {
    Write-Host "WARNING: Nothing is listening on localhost:3000 yet." -ForegroundColor Yellow
    Write-Host "         Start the backend (Backend/TestFarmApi: node server.js) so API calls succeed." -ForegroundColor Yellow
}

# 3. Serve with watch + live reload.
$serveArgs = @('serve', '--port', $Port)
if ($Open) { $serveArgs += '--open' }

Write-Host "Starting Angular dev server on http://localhost:$Port (watching for changes)..." -ForegroundColor Green
npx ng @serveArgs
