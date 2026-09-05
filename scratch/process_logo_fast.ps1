$csharp = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class LogoProcessor
{
    public static void ProcessLogo(string sourcePath, string outputLogoTrans, string outputIconTrans, string outputFavicon)
    {
        using (Bitmap src = new Bitmap(sourcePath))
        {
            int w = src.Width;
            int h = src.Height;

            Bitmap trans = new Bitmap(w, h, PixelFormat.Format32bppArgb);

            BitmapData srcData = src.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            BitmapData dstData = trans.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);

            int bytes = Math.Abs(srcData.Stride) * h;
            byte[] srcRgb = new byte[bytes];
            byte[] dstRgb = new byte[bytes];

            Marshal.Copy(srcData.Scan0, srcRgb, 0, bytes);

            int minX = w, maxX = 0, minY = h, maxY = 0;
            int iconMinX = w, iconMaxX = 0, iconMinY = h, iconMaxY = 0;

            for (int y = 0; y < h; y++)
            {
                int rowOffset = y * srcData.Stride;
                for (int x = 0; x < w; x++)
                {
                    int i = rowOffset + (x * 4);
                    byte b = srcRgb[i];
                    byte g = srcRgb[i + 1];
                    byte r = srcRgb[i + 2];

                    int brightness = (r + g + b) / 3;

                    if (brightness >= 246)
                    {
                        dstRgb[i] = 0;
                        dstRgb[i + 1] = 0;
                        dstRgb[i + 2] = 0;
                        dstRgb[i + 3] = 0; // Alpha 0
                    }
                    else
                    {
                        byte alpha = 255;
                        if (brightness > 220)
                        {
                            alpha = (byte)((246 - brightness) * 255 / 26);
                        }

                        dstRgb[i] = b;
                        dstRgb[i + 1] = g;
                        dstRgb[i + 2] = r;
                        dstRgb[i + 3] = alpha;

                        if (alpha > 30)
                        {
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;

                            // Icon is strictly in top emblem region (y <= 328)
                            if (y <= 328)
                            {
                                if (x < iconMinX) iconMinX = x;
                                if (x > iconMaxX) iconMaxX = x;
                                if (y < iconMinY) iconMinY = y;
                                if (y > iconMaxY) iconMaxY = y;
                            }
                        }
                    }
                }
            }

            Marshal.Copy(dstRgb, 0, dstData.Scan0, bytes);
            src.UnlockBits(srcData);
            trans.UnlockBits(dstData);

            // 1. Crop full logo with padding
            int cropX = Math.Max(0, minX - 16);
            int cropY = Math.Max(0, minY - 16);
            int cropW = Math.Min(w - cropX, (maxX - minX) + 32);
            int cropH = Math.Min(h - cropY, (maxY - minY) + 32);

            using (Bitmap cropLogo = new Bitmap(cropW, cropH, PixelFormat.Format32bppArgb))
            {
                using (Graphics g = Graphics.FromImage(cropLogo))
                {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.DrawImage(trans, new Rectangle(0, 0, cropW, cropH), new Rectangle(cropX, cropY, cropW, cropH), GraphicsUnit.Pixel);
                }
                cropLogo.Save(outputLogoTrans, ImageFormat.Png);
            }

            // 2. Crop Icon strictly
            int icX = Math.Max(0, iconMinX - 12);
            int icY = Math.Max(0, iconMinY - 12);
            int icW = Math.Min(w - icX, (iconMaxX - iconMinX) + 24);
            int icH = Math.Min(h - icY, (iconMaxY - iconMinY) + 24);

            using (Bitmap cropIcon = new Bitmap(icW, icH, PixelFormat.Format32bppArgb))
            {
                using (Graphics g = Graphics.FromImage(cropIcon))
                {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.DrawImage(trans, new Rectangle(0, 0, icW, icH), new Rectangle(icX, icY, icW, icH), GraphicsUnit.Pixel);
                }
                cropIcon.Save(outputIconTrans, ImageFormat.Png);

                // 3. Favicon square (256x256)
                using (Bitmap fav = new Bitmap(256, 256, PixelFormat.Format32bppArgb))
                {
                    using (Graphics g = Graphics.FromImage(fav))
                    {
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.SmoothingMode = SmoothingMode.HighQuality;
                        float scale = Math.Min(200f / icW, 200f / icH);
                        float targetW = icW * scale;
                        float targetH = icH * scale;
                        float offX = (256f - targetW) / 2f;
                        float offY = (256f - targetH) / 2f;
                        g.DrawImage(cropIcon, offX, offY, targetW, targetH);
                    }
                    fav.Save(outputFavicon, ImageFormat.Png);
                }
            }

            trans.Dispose();
        }
    }
}
"@

Add-Type -TypeDefinition $csharp -ReferencedAssemblies "System.Drawing.dll" -IgnoreWarnings

$src = (Resolve-Path "icons\finflow_logo.png").Path
$outLogo = Join-Path (Get-Location) "icons\finflow_logo_transparent.png"
$outIcon = Join-Path (Get-Location) "icons\finflow_icon.png"
$outFav = Join-Path (Get-Location) "icons\favicon.png"

[LogoProcessor]::ProcessLogo($src, $outLogo, $outIcon, $outFav)
Write-Host "Processed images generated with perfect emblem and logo boundaries!"
