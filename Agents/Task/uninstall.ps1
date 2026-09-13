#Requires -Version 5.1
<#
.SYNOPSIS
    Stops and removes the TestFarm Executor scheduled task.

.DESCRIPTION
    Ends the running Executor and unregisters the task. Log files are left alone.

.EXAMPLE
    .\uninstall.ps1
#>
[CmdletBinding()]
param(
    [string] $TaskName = "TestFarm Executor"
)

$ErrorActionPreference = "Stop"

function Assert-Elevated {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)

    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "This script must be run from an elevated PowerShell session."
    }
}

Assert-Elevated

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if (-not $task) {
    Write-Host "Scheduled task '$TaskName' is not registered - nothing to do."
    return
}

if ($task.State -eq "Running") {
    Write-Host "Stopping '$TaskName'..."
    Stop-ScheduledTask -TaskName $TaskName

    # Stop-ScheduledTask only asks; give the Executor a moment to actually go away.
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        if ((Get-ScheduledTask -TaskName $TaskName).State -ne "Running") { break }
    }

    if ((Get-ScheduledTask -TaskName $TaskName).State -eq "Running") {
        Write-Warning "'$TaskName' is still running - unregistering it anyway, which terminates it."
    }
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false

Write-Host "Removed scheduled task '$TaskName'." -ForegroundColor Green
