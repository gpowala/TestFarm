#Requires -Version 5.1
<#
.SYNOPSIS
    Registers the TestFarm Executor as a scheduled task that starts at boot and keeps running.

.DESCRIPTION
    The task runs run.py as a named account, using the interpreter from the repository
    virtual environment, and is restarted automatically whenever it stops:

      * a repeating trigger tries to launch it every -RestartIntervalMinutes; while the
        Executor is still alive the attempt is dropped ("do not start a new instance"),
        so this acts as an unbounded restart loop
      * "restart on failure" covers a non-zero exit in between those attempts

    Being a scheduled task rather than a service means the account password is stored by
    Windows in LSA instead of anywhere in this repository.

.EXAMPLE
    .\install.ps1 -Username ACCSD\srv_mongoosevui

.EXAMPLE
    .\install.ps1 -Username ACCSD\srv_mongoosevui -LogFile D:\Logs\TestFarm\testfarm_executor.log
#>
[CmdletBinding()]
param(
    [string] $TaskName = "TestFarm Executor",

    [Parameter(Mandatory = $true)]
    [string] $Username,

    [securestring] $Password,

    # Defaults to <repo>\Agents\.venv\Scripts\python.exe
    [string] $PythonExe,

    # Defaults to <repo>\Agents\Executor
    [string] $ExecutorDir,

    [ValidateRange(1, 999)]
    [int] $RestartIntervalMinutes = 5,

    # Gives the network stack time to come up before the Executor calls the TestFarm API.
    [ValidateRange(0, 3600)]
    [int] $BootDelaySeconds = 30,

    [switch] $NoStart
)

$ErrorActionPreference = "Stop"

function Assert-Elevated {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)

    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "This script must be run from an elevated PowerShell session."
    }
}

function ConvertTo-PlainText([securestring] $Secure) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

Assert-Elevated

$agentsDir = Split-Path -Parent $PSScriptRoot

if (-not $PythonExe)   { $PythonExe   = Join-Path $agentsDir ".venv\Scripts\python.exe" }
if (-not $ExecutorDir) { $ExecutorDir = Join-Path $agentsDir "Executor" }

$PythonExe   = [IO.Path]::GetFullPath($PythonExe)
$ExecutorDir = [IO.Path]::GetFullPath($ExecutorDir)

if (-not (Test-Path -LiteralPath $PythonExe)) {
    throw "Interpreter not found: $PythonExe`nCreate the virtual environment first, or pass -PythonExe."
}

$entryPoint = Join-Path $ExecutorDir "run.py"
if (-not (Test-Path -LiteralPath $entryPoint)) {
    throw "Executor entry point not found: $entryPoint"
}

# The Executor writes its own rotating log file; this script only needs to know where, so
# it can make the directory writable for the task account.
$executorConfigPath = Join-Path $ExecutorDir "config.json"
if (-not (Test-Path -LiteralPath $executorConfigPath)) {
    throw "Executor configuration not found: $executorConfigPath"
}

$executorConfig = Get-Content -LiteralPath $executorConfigPath -Raw | ConvertFrom-Json

$logDir = "C:\logs\testfarm"
if ($executorConfig.Logging -and $executorConfig.Logging.LogDir) {
    $logDir = $executorConfig.Logging.LogDir
}
$logDir = [IO.Path]::GetFullPath($logDir)

# Anything that fails before logging is configured never reaches that file, so stderr is
# captured separately. It stays empty on a healthy run.
$startupLog = Join-Path $logDir "testfarm_executor.startup.log"

if (-not $Password) {
    $Password = Read-Host -AsSecureString "Password for $Username"
}

if (-not (Test-Path -LiteralPath $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    Write-Host "Created log directory $logDir"
}

# The task account has to be able to write the Executor log and the startup log.
& icacls.exe $logDir /grant "${Username}:(OI)(CI)(M)" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Could not grant $Username write access to $logDir - the Executor may not be able to write its log."
}

# -u keeps Python unbuffered, otherwise output only appears in 8 KB chunks.
$arguments = '/c ""{0}" -u run.py 2>> "{1}""' -f $PythonExe, $startupLog

$action = New-ScheduledTaskAction `
    -Execute "$env:SystemRoot\System32\cmd.exe" `
    -Argument $arguments `
    -WorkingDirectory $ExecutorDir

$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = "PT${BootDelaySeconds}S"

# An -AtStartup trigger has no Repetition object of its own, so borrow one from a
# throwaway -Once trigger. Leaving the duration unset means "repeat indefinitely".
$trigger.Repetition = (New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes $RestartIntervalMinutes)).Repetition
$trigger.Repetition.StopAtDurationEnd = $false

$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartInterval (New-TimeSpan -Minutes $RestartIntervalMinutes) `
    -RestartCount 999 `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable

# Tasks default to below-normal priority, which noticeably slows the tests the Executor runs.
$settings.Priority = 5
$settings.IdleSettings.StopOnIdleEnd = $false

$plainPassword = ConvertTo-PlainText $Password

try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -User $Username `
        -Password $plainPassword `
        -RunLevel Limited `
        -Description "Runs the TestFarm Executor and restarts it automatically." `
        -Force | Out-Null
}
catch {
    throw ("Could not register the task: {0}`n" -f $_.Exception.Message) +
          "If this is a logon failure, check the password and make sure '$Username' holds the " +
          "'Log on as a batch job' right (secpol.msc -> Local Policies -> User Rights Assignment)."
}
finally {
    $plainPassword = $null
    [GC]::Collect()
}

Write-Host ""
Write-Host "Registered scheduled task '$TaskName'" -ForegroundColor Green
Write-Host "  Runs as     : $Username"
Write-Host "  Command     : `"$PythonExe`" -u run.py"
Write-Host "  Working dir : $ExecutorDir"
Write-Host "  Log file    : $(Join-Path $logDir 'testfarm_executor.log') (from Executor\config.json)"
Write-Host "  Startup log : $startupLog"
Write-Host "  Restarts    : every $RestartIntervalMinutes minute(s) while not running"

if (-not $NoStart) {
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 2
    $state = (Get-ScheduledTask -TaskName $TaskName).State
    Write-Host "  State       : $state"
}

Write-Host ""
Write-Host "Check on it with:"
Write-Host "  Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
Write-Host "  Get-Content '$(Join-Path $logDir 'testfarm_executor.log')' -Tail 50 -Wait"
