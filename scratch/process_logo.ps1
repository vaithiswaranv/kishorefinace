Add-Type -AssemblyName System.Drawing

$srcPath = Resolve-Path "icons\finflow_logo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
$width = $bmp.Width
$height = $bmp.Height

Write-Host "Original image: $width x $height"

# 1. Create a transparent version by converting white background (RGB > 240) to alpha
$transBmp = New-Object System.Drawing.Bitmap $width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb

$minX = $width
$maxX = 0
$minY = $height
$maxY = 0

# Also find bounding box for the 'F' icon (top portion above the text "FinFlow")
# And bounding box for full logo
for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        # Background is white/near-white (R > 240, G > 240, B > 240)
        # We can calculate luminance / whiteness
        $brightness = ($c.R + $c.G + $c.B) / 3.0
        if ($brightness -gt 245) {
            $transBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
        } elseif ($brightness -gt 230) {
            # Smooth edge alpha
            $alpha = [int]((245 - $brightness) / 15.0 * 255)
            $transBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B))
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        } else {
            $transBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

$bmp.Dispose()

Write-Host "Full logo bounds: X: $minX to $maxX, Y: $minY to $maxY"

# Save transparent full logo
$transBmp.Save("icons\finflow_logo_transparent.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Crop tight full logo
$cropW = ($maxX - $minX) + 20
$cropH = ($maxY - $minY) + 20
$padX = [Math]::Max(0, $minX - 10)
$padY = [Math]::Max(0, $minY - 10)
$cropFull = New-Object System.Drawing.Bitmap $cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$gFull = [System.Drawing.Graphics]::FromImage($cropFull)
$gFull.DrawImage($transBmp, [System.Drawing.Rectangle]::new(0, 0, $cropW, $cropH), [System.Drawing.Rectangle]::new($padX, $padY, $cropW, $cropH), [System.Drawing.GraphicsUnit]::Pixel)
$gFull.Dispose()
$cropFull.Save("icons\finflow_logo_cropped.png", [System.Drawing.Imaging.ImageFormat]::Png)
$cropFull.Dispose()

# Now find the bounding box of just the top 'F' icon (from top down to where text starts)
# Let's inspect where the text "FinFlow" starts vertically.
# "FinFlow" text is roughly in the lower 35% of the logo.
$iconMinX = $width
$iconMaxX = 0
$iconMinY = $height
$iconMaxY = 0

for ($y = 0; $y -lt [int]($maxY * 0.72); $y++) {
    for ($x = 0; $x -lt $width; $x++) {
        $c = $transBmp.GetPixel($x, $y)
        if ($c.A -gt 20) {
            if ($x -lt $iconMinX) { $iconMinX = $x }
            if ($x -gt $iconMaxX) { $iconMaxX = $x }
            if ($y -lt $iconMinY) { $iconMinY = $y }
            if ($y -gt $iconMaxY) { $iconMaxY = $y }
        }
    }
}

Write-Host "Icon bounds: X: $iconMinX to $iconMaxX, Y: $iconMinY to $iconMaxY"

$iconW = ($iconMaxX - $iconMinX) + 16
$iconH = ($iconMaxY - $iconMinY) + 16
$iconPadX = [Math]::Max(0, $iconMinX - 8)
$iconPadY = [Math]::Max(0, $iconMinY - 8)

$iconBmp = New-Object System.Drawing.Bitmap $iconW, $iconH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$gIcon = [System.Drawing.Graphics]::FromImage($iconBmp)
$gIcon.DrawImage($transBmp, [System.Drawing.Rectangle]::new(0, 0, $iconW, $iconH), [System.Drawing.Rectangle]::new($iconPadX, $iconPadY, $iconW, $iconH), [System.Drawing.GraphicsUnit]::Pixel)
$gIcon.Dispose()
$iconBmp.Save("icons\finflow_icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$iconBmp.Dispose()

# Also create square 256x256 icon for favicon
$squareSize = [Math]::Max($iconW, $iconH) + 20
$sqBmp = New-Object System.Drawing.Bitmap $squareSize, $squareSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$gSq = [System.Drawing.Graphics]::FromImage($sqBmp)
$gSq.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gSq.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$offsetX = ($squareSize - $iconW) / 2
$offsetY = ($squareSize - $iconH) / 2
$iconRaw = [System.Drawing.Bitmap]::FromFile("icons\finflow_icon.png")
$gSq.DrawImage($iconRaw, [float]$offsetX, [float]$offsetY, [float]$iconW, [float]$iconH)
$iconRaw.Dispose()
$gSq.Dispose()

$favBmp = New-Object System.Drawing.Bitmap 256, 256, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$gFav = [System.Drawing.Graphics]::FromImage($favBmp)
$gFav.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gFav.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gFav.DrawImage($sqBmp, 0, 0, 256, 256)
$gFav.Dispose()
$sqBmp.Dispose()
$favBmp.Save("icons\favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$favBmp.Dispose()

$transBmp.Dispose()
Write-Host "Processed images generated successfully!"
