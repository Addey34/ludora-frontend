// One-shot generator for the social share image (public/og-image.png, 1200x630).
// Run with a temporary sharp install: `npm i --no-save sharp && node scripts/make-og-image.mjs`.
// The PNG is the committed artifact; sharp is not a project dependency.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/og-image.png');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4361ee"/>
      <stop offset="1" stop-color="#3a0ca3"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="90" y="205" width="220" height="220" rx="52" fill="#f4f4f9"/>
  <text x="200" y="315" font-family="Arial, Helvetica, sans-serif" font-weight="bold"
        font-size="150" fill="#4361ee" text-anchor="middle" dominant-baseline="central">GZ</text>
  <text x="360" y="285" font-family="Arial, Helvetica, sans-serif" font-weight="bold"
        font-size="104" fill="#ffffff">Games Zone</text>
  <text x="364" y="365" font-family="Arial, Helvetica, sans-serif"
        font-size="42" fill="#dbe2ff">39 free browser games — play instantly</text>
  <text x="364" y="420" font-family="Arial, Helvetica, sans-serif"
        font-size="42" fill="#dbe2ff">No download · No sign-up</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log('wrote', out);
