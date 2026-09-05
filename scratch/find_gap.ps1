Add-Type -AssemblyName System.Drawing

$trans = [System.Drawing.Bitmap]::FromFile((Resolve-Path "icons\finflow_logo_transparent.png").Path)
$w = $trans.Width
$h = $trans.Height

# Count non-transparent pixels per horizontal line (row)
$rowCounts = @()
for ($y = 0; $y -lt $h; $y++) {
    $count = 0
    for ($x = 0; $x -lt $w; $x++) {
        $c = $trans.GetPixel($x, $y)
        if ($c.A -gt 30) { $count++ }
    }
    $rowCounts += [PSCustomObject]@{ Row = $y; Count = $count }
}

# Print rows where count is 0 or low between row 150 and 350
$emptyRows = $rowCounts | Where-Object { $_.Row -ge 150 -and $_.Row -le 350 -and $_.Count -eq 0 }
$emptyRows | ForEach-Object { Write-Host "Gap row: $($_.Row)" }

$iconBottom = ($rowCounts | Where-Object { $_.Row -lt 300 -and $_.Count -gt 0 } | Select-Object -Last 1).Row
$textTop = ($rowCounts | Where-Object { $_.Row -gt 250 -and $_.Count -gt 0 } | Select-Object -First 1).Row

Write-Host "Icon bottom: $iconBottom, Text top: $textTop"
$trans.Dispose()
