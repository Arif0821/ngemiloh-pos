$ErrorActionPreference = 'Stop'

$files = Get-ChildItem -Path "C:\POS_Nabil\frontend\src" -Include *.svelte,*.ts -Recurse | Where-Object { !($_.Name -match 'api.client.ts|layout.ts|db.ts') }

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    if ($null -eq $content) { continue }
    $orig = $content
    
    $content = $content -replace 'fetch\(`\/api', 'api.request(`/api'
    $content = $content -replace 'fetch\(''\/api', "api.request('/api"
    $content = $content -replace 'fetch\(url', 'api.request(url'
    
    if ($content -ne $orig) {
        if ($content -notmatch "import \{ api \}") {
            if ($f.Extension -eq '.svelte') {
                $content = $content -replace '<script lang="ts">', "<script lang=`"ts`">`n  import { api } from `'$lib/services/api.client`';"
                $content = $content -replace '<script>', "<script>`n  import { api } from `'$lib/services/api.client`';"
            } else {
                $content = "import { api } from `'$lib/services/api.client`';`n" + $content
            }
        }
        
        Set-Content -Path $f.FullName -Value $content -NoNewline
        Write-Host "Updated $($f.Name)"
    }
}
