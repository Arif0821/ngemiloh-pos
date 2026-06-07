$files = Get-ChildItem -Path C:\POS_Nabil\frontend\src -File -Recurse
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    $newContent = $content -replace 'http://\$\{window\.location\.hostname\}:3000/api', '/api' -replace 'http://\$\{hostname\}:3000/api', '/api'
    if ($content -ne $newContent) {
        Set-Content -Path $f.FullName -Value $newContent -NoNewline
        Write-Host "Updated" $f.FullName
    }
}
