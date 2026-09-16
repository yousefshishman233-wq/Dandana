# سكريبت مزامنة ملفات الـ Frontend
# بعد أي تعديل في frontend/src، شغّل الأمر ده عشان تتزامن مع C:\dandana-frontend

param(
    [switch]$Watch
)

$source = "c:\Users\PanDa\Desktop\دندنه\frontend\src"
$dest = "C:\dandana-frontend\src"

function Sync-Files {
    Copy-Item -Recurse -Force "$source\*" "$dest\" -ErrorAction SilentlyContinue
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Synced src files to dandana-frontend" -ForegroundColor Green
}

if ($Watch) {
    Write-Host "Watching for changes in frontend/src..." -ForegroundColor Cyan
    $watcher = New-Object System.IO.FileSystemWatcher
    $watcher.Path = $source
    $watcher.IncludeSubdirectories = $true
    $watcher.EnableRaisingEvents = $true

    $action = { Sync-Files }
    Register-ObjectEvent $watcher "Changed" -Action $action | Out-Null
    Register-ObjectEvent $watcher "Created" -Action $action | Out-Null
    Register-ObjectEvent $watcher "Deleted" -Action $action | Out-Null

    while ($true) { Start-Sleep 2 }
} else {
    Sync-Files
}
