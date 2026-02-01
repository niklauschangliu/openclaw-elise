$h = @{ Authorization = 'Bearer devtoken123' }
$r = Invoke-RestMethod -Headers $h -Uri 'http://127.0.0.1:8787/state'
$r | ConvertTo-Json -Depth 6
