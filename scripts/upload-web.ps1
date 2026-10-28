param(
  [Parameter(Mandatory = $true)][string]$Dist,
  [Parameter(Mandatory = $true)][string]$Bucket,
  [string]$Prefix = 'web',
  [string]$Config = ''
)
$ErrorActionPreference = 'Stop'
$wrangler = Join-Path $PSScriptRoot '..\mail-worker\node_modules\wrangler\bin\wrangler.js'
if (-not (Test-Path $wrangler)) { throw 'wrangler not installed; run pnpm install in mail-worker first' }

function Get-ContentType([string]$name) {
  switch -Wildcard ($name) {
    '*.html' { 'text/html; charset=utf-8' }
    '*.js' { 'application/javascript; charset=utf-8' }
    '*.css' { 'text/css; charset=utf-8' }
    '*.json' { 'application/json; charset=utf-8' }
    '*.svg' { 'image/svg+xml' }
    '*.png' { 'image/png' }
    '*.jpg' { 'image/jpeg' }
    '*.jpeg' { 'image/jpeg' }
    '*.ico' { 'image/x-icon' }
    '*.woff2' { 'font/woff2' }
    '*.woff' { 'font/woff' }
    '*.webmanifest' { 'application/manifest+json' }
    default { 'application/octet-stream' }
  }
}

$files = Get-ChildItem $Dist -Recurse -File | Where-Object { $_.Name -ne 'index.html' }
$ok = 0; $fail = 0
foreach ($file in $files) {
  $rel = $file.FullName.Substring($Dist.Length + 1).Replace('\', '/')
  $key = "$Bucket/$Prefix/$rel"
  $arguments = @($wrangler, 'r2', 'object', 'put', $key, '--file', $file.FullName, '--content-type', (Get-ContentType $file.Name), '--remote')
  if ($Config) { $arguments += @('--config', $Config) }
  & node @arguments *> $null
  if ($LASTEXITCODE -eq 0) { $ok++ } else { $fail++; Write-Output "FAIL $rel" }
}

# index.html last: never point the browser at assets that are still missing.
$index = Join-Path $Dist 'index.html'
$arguments = @($wrangler, 'r2', 'object', 'put', "$Bucket/$Prefix/index.html", '--file', $index, '--content-type', 'text/html; charset=utf-8', '--remote')
if ($Config) { $arguments += @('--config', $Config) }
& node @arguments *> $null
if ($LASTEXITCODE -eq 0) { $ok++ } else { $fail++; Write-Output 'FAIL index.html' }
Write-Output "UPLOAD OK=$ok FAIL=$fail"
if ($fail -gt 0) { exit 1 }
