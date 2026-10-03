# تأكدي من تجاوز السياسة
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

# أزيلي الحظر
Get-ChildItem .\setup-*.ps1 -ErrorAction SilentlyContinue | Unblock-File

# أصلحي الترميز لكل السكربتات (اقرأ UTF-8، اكتب UTF-8 BOM)
Get-ChildItem .\setup-*.ps1 | ForEach-Object {
  Write-Host "  🔧 معالجة: $($_.Name)" -ForegroundColor Yellow
  $content = Get-Content -Path $_.FullName -Raw -Encoding UTF8
  [System.IO.File]::WriteAllText(
    $_.FullName,
    $content,
    (New-Object System.Text.UTF8Encoding($true))
  )
}
Write-Host "`n✅ تم إصلاح الترميز لكل الملفات`n" -ForegroundColor Green

# الآن شغّلي
.\setup-1.ps1