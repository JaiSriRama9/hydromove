import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function extractDominantColor(base64: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.crossOrigin = "Anonymous";
    
    // Use a timeout to ensure it doesn't hang if image fails to load properly
    const timeout = setTimeout(() => resolve('#22c55e'), 2000);

    img.onload = () => {
      clearTimeout(timeout);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return resolve('#22c55e');

      // Higher resolution for better sampling
      const size = 100;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);

      try {
        const imageData = ctx.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0, count = 0;

        // Sample more densely
        for (let i = 0; i < imageData.length; i += 4 * 4) {
          const R = imageData[i];
          const G = imageData[i + 1];
          const B = imageData[i + 2];
          const A = imageData[i + 3];

          if (A < 128) continue; // Skip semi-transparent

          // Skip extremely dark or extremely bright pixels (neutral)
          const brightness = (R + G + B) / 3;
          if (brightness < 30 || brightness > 230) continue;

          // Skip neutral/grayish pixels (low saturation)
          const max = Math.max(R, G, B);
          const min = Math.min(R, G, B);
          if (max - min < 20) continue; 
          
          r += R;
          g += G;
          b += B;
          count++;
        }

        if (count === 0) {
          // If no vibrant pixels found, try one more pass without the saturation filter
          for (let i = 0; i < imageData.length; i += 4 * 10) {
             r += imageData[i];
             g += imageData[i + 1];
             b += imageData[i + 2];
             count++;
          }
        }

        if (count === 0) return resolve('#22c55e');

        const avgR = Math.round(r / count);
        const avgG = Math.round(g / count);
        const avgB = Math.round(b / count);

        resolve(rgbToHex(avgR, avgG, avgB));
      } catch (e) {
        console.error("Color extraction error", e);
        resolve('#22c55e');
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve('#22c55e');
    };
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Ensure the color is vibrant enough for an accent but not too dark for white text
export function adjustColorForAccent(hex: string): string {
  // Convert HEX to RGB
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  // Convert RGB to HSL
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  // ADJUST: Boost saturation and fix luminosity for UI
  s = Math.max(s, 0.6); // Minimum 60% saturation for vibrant feel
  l = Math.max(0.4, Math.min(l, 0.6)); // Keep brightness between 40% and 60% for contrast

  // Convert HSL back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  r = hue2rgb(p, q, h + 1/3);
  g = hue2rgb(p, q, h);
  b = hue2rgb(p, q, h - 1/3);

  return rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}
