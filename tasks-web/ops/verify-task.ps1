$ErrorActionPreference = 'Stop'
$tn = 'OpenClaw Tasks Web Status Service'
$log = 'C:\Users\elise\.openclaw\workspace\tasks-web\status-service\service.out.log'

try { schtasks /End /TN $tn | Out-Null } catch {}
Start-Sleep -Seconds 1
schtasks /Run /TN $tn | Out-Null
Start-Sleep -Seconds 3

if (Test-Path $log) {
  "log exists"
  Get-Content $log -Tail 80
} else {
  "log missing"
}

schtasks /Query /TN $tn /V /FO LIST | Select-String -Pattern 'Task To Run|要运行的任务|Last Result|上次结果|Status|模式'
