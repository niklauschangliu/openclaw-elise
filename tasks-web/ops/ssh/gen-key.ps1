$ErrorActionPreference = 'Stop'
$exe = 'C:\Windows\System32\OpenSSH\ssh-keygen.exe'
if (!(Test-Path $exe)) { throw "ssh-keygen.exe not found" }
Set-Location 'C:\Users\elise\.openclaw\workspace\tasks-web\ops\ssh'
# Use explicit empty passphrase string
& $exe -q -t ed25519 -f '.\openclaw_ed25519' -N "" -C 'openclaw-bot'
Get-Content '.\openclaw_ed25519.pub'
