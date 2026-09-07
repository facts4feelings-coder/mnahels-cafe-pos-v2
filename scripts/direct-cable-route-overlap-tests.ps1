# Mnahel's Cafe POS - non-mutating direct-cable regression checks.
# Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
$ErrorActionPreference = 'Stop'
$tokens = $null; $errors = $null
$source = [IO.File]::ReadAllText((Join-Path (Get-Location) 'reports/direct-cable/server-apply.ps1'))
$ast = [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Generated setup script does not parse.' }
$number = @($ast.FindAll({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'IPv4-Number'}, $true))
$guard = @($ast.FindAll({param($n) $n -is [System.Management.Automation.Language.ForEachStatementAst] -and $n.Condition.Extent.Text -like '*Get-NetRoute -AddressFamily IPv4*'}, $true))
if ($number.Count -ne 1 -or $guard.Count -ne 1) { throw 'Expected exactly one route guard and IPv4 helper.' }
# Execute only the extracted pure helper and route guard, never the setup body.
. ([scriptblock]::Create($number[0].Extent.Text))
$check = [scriptblock]::Create($guard[0].Extent.Text)
function Get-NetRoute { param($AddressFamily) $script:routes }
$idx = 7
$cases = @(
    @{ Prefix='10.77.61.0/24'; Block=$true },
    @{ Prefix='10.77.61.128/25'; Block=$true },
    @{ Prefix='10.77.61.2/32'; Block=$true },
    @{ Prefix='10.77.61.1/32'; Block=$true },
    @{ Prefix='10.77.61.255/32'; Block=$true },
    @{ Prefix='10.77.0.0/16'; Block=$true },
    @{ Prefix='10.0.0.0/8'; Block=$true },
    @{ Prefix='0.0.0.0/1'; Block=$true },
    @{ Prefix='128.0.0.0/1'; Block=$false },
    @{ Prefix='10.77.60.0/24'; Block=$false },
    @{ Prefix='10.77.62.0/24'; Block=$false },
    @{ Prefix='192.168.1.0/24'; Block=$false },
    @{ Prefix='0.0.0.0/0'; Block=$false },
    @{ Prefix='10.77.61.0/24'; Block=$false; Same=$true }
)
foreach ($ip in @('10.77.61.1', '10.77.61.2')) {
    foreach ($case in $cases) {
        $script:routes = @([pscustomobject]@{InterfaceIndex=$(if ($case.Same) {7} else {8}); DestinationPrefix=$case.Prefix})
        $blocked = $false
        try { & $check }
        catch {
            if ($_.Exception.Message -notlike '*Another adapter/VPN*') { throw }
            $blocked = $true
        }
        if ($blocked -ne $case.Block) { throw "Incorrect overlap result: $ip vs $($case.Prefix), same adapter=$($case.Same)" }
    }
}
Write-Output 'PASS: 28 route-overlap cases against the actual generated setup guard; no network operations executed.'
