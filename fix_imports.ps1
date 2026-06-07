$ErrorActionPreference = 'Stop'

$files = Get-ChildItem -Path "C:\POS_Nabil\frontend\src" -Include *.svelte,*.ts -Recurse | Where-Object { !($_.Name -match 'api.client.ts|layout.ts|db.ts') }

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    if ($null -eq $content) { continue }
    
    $orig = $content
    
    $content = $content -replace "import \{ api \} from '/services/api.client';", "import { api } from '`$lib/services/api.client';"
    
    if ($content -ne $orig) {
        Set-Content -Path $f.FullName -Value $content -NoNewline
        Write-Host "Fixed import in $($f.Name)"
    }
}
