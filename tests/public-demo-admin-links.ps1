$ErrorActionPreference = 'Stop'

$siteRoot = Split-Path -Parent $PSScriptRoot
$files = @(
    (Join-Path $siteRoot 'campus-mall\login.html'),
    (Join-Path $siteRoot 'campus-mall\js\app.js')
)
$forbiddenPatterns = @(
    'admin\.html',
    '\badmin\b',
    '\bcurrentRole\b',
    '\bswitchRole\b'
)

function Get-NormalLoginViolations {
    param([string]$Content)

    $requiredPatterns = @(
        'API\.post\(\s*[''"'']/user/login[''"'']',
        'Token\.set\s*\(',
        'location\.href\s*=\s*[''"'']index\.html[''"'']'
    )

    foreach ($pattern in $requiredPatterns) {
        if ($Content -notmatch $pattern) {
            "login.html: required normal-login behavior is missing /$pattern/"
        }
    }
}

$loginFile = Join-Path $siteRoot 'campus-mall\login.html'
$loginContent = Get-Content -Raw $loginFile

$missingApiCall = $loginContent -replace 'API\.post\(\s*[''"'']/user/login[''"'']', "API.post('/removed/login'"
if (-not (Get-NormalLoginViolations $missingApiCall | Where-Object { $_ -match 'API\\.post' })) {
    Write-Error 'The normal-login API assertion did not fail for a missing login call.'
    exit 1
}

$normalLoginViolations = Get-NormalLoginViolations $loginContent
if ($normalLoginViolations) {
    $normalLoginViolations | ForEach-Object { Write-Error $_ }
    exit 1
}

$violations = foreach ($file in $files) {
    $content = Get-Content -Raw $file
    foreach ($pattern in $forbiddenPatterns) {
        if ($content -match $pattern) {
            "$(Split-Path -Leaf $file): forbidden public-demo admin reference matches /$pattern/"
        }
    }
}

if ($violations) {
    $violations | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output 'PASS: public-demo login retains normal authentication and contains no admin routes or role UI.'
