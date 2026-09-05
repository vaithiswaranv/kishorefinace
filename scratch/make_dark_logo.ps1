$csharp = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class LogoDarkThemeGenerator
{
    public static void GenerateDarkThemeLogo(string transPath, string outputDarkLogo)
    {
        using (Bitmap src = new Bitmap(transPath))
        {
            int w = src.Width;
            int h = src.Height;

            Bitmap darkLogo = new Bitmap(w, h, PixelFormat.Format32bppArgb);

            BitmapData srcData = src.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            BitmapData dstData = darkLogo.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);

            int bytes = Math.Abs(srcData.Stride) * h;
            byte[] srcRgb = new byte[bytes];
            byte[] dstRgb = new byte[bytes];

            Marshal.Copy(srcData.Scan0, srcRgb, 0, bytes);

            // In the cropped transparent logo, the text is at the lower part.
            // Let's check: for the emblem (top), we keep original colors.
            // For the word "Fin" (left half of text, deep navy): convert to crisp white (#F8FAFC)
            // For the word "Flow" (right half of text, cyan): keep the bright cyan / boost vibrancy
            for (int y = 0; y < h; y++)
            {
                int rowOffset = y * srcData.Stride;
                for (int x = 0; x < w; x++)
                {
                    int i = rowOffset + (x * 4);
                    byte b = srcRgb[i];
                    byte g = srcRgb[i + 1];
                    byte r = srcRgb[i + 2];
                    byte a = srcRgb[i + 3];

                    if (a == 0)
                    {
                        dstRgb[i] = 0;
                        dstRgb[i + 1] = 0;
                        dstRgb[i + 2] = 0;
                        dstRgb[i + 3] = 0;
                        continue;
                    }

                    // If it's in the lower text area (Y > h * 0.65) and in the "Fin" region (x < w * 0.48)
                    // and color is dark navy (r < 60 && g < 100 && b > 80):
                    if (y > (int)(h * 0.65) && x < (int)(w * 0.48) && (r < 80 && g < 110 && b > 70))
                    {
                        // Make it crisp bright white with original alpha
                        dstRgb[i] = 255;
                        dstRgb[i + 1] = 250;
                        dstRgb[i + 2] = 245;
                        dstRgb[i + 3] = a;
                    }
                    else
                    {
                        dstRgb[i] = b;
                        dstRgb[i + 1] = g;
                        dstRgb[i + 2] = r;
                        dstRgb[i + 3] = a;
                    }
                }
            }

            Marshal.Copy(dstRgb, 0, dstData.Scan0, bytes);
            src.UnlockBits(srcData);
            darkLogo.UnlockBits(dstData);

            darkLogo.Save(outputDarkLogo, ImageFormat.Png);
            darkLogo.Dispose();
        }
    }
}
"@

Add-Type -TypeDefinition $csharp -ReferencedAssemblies "System.Drawing.dll" -IgnoreWarnings

$trans = Join-Path (Get-Location) "icons\finflow_logo_transparent.png"
$outDark = Join-Path (Get-Location) "icons\finflow_logo_darktheme.png"

[LogoDarkThemeGenerator]::GenerateDarkThemeLogo($trans, $outDark)
Write-Host "Dark theme logo created!"
