Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path "icons\finflow_logo.png").Path)
$w = $src.Width
$h = $src.Height

# Let's inspect the bounding box of the emblem vs the word "FinFlow".
# Look at the original image:
# The 'F' is composed of:
# 1. An upper dark-to-blue curve
# 2. A lower blue tail stem that curves down on the left: extends down to near the baseline of the logo mark
# 3. A cyan-to-green arrow rising up to the right
# 4. Underneath the whole emblem is the word "FinFlow", centered horizontally below the emblem!
#
# Let's verify where the word "FinFlow" begins.
# Let's check text rows: in the original 1024x558 image, what is the Y range of the emblem vs the text?

for ($y = 0; $y -lt $h; $y += 10) {
    $darkCount = 0
    for ($x = 0; $x -lt $w; $x++) {
        $c = $src.GetPixel($x, $y)
        if ($c.R -lt 230 -or $c.G -lt 230 -or $c.B -lt 230) {
            $darkCount++
        }
    }
    Write-Host "Y=$y : $darkCount pixels"
}

$src.Dispose()
