#!/usr/bin/env node

// Script pentru generarea iconurilor PWA corecte
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Asigură-te că directorul există
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Șablon SVG pentru iconuri
const generateSVG = (size) => `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad${size})" rx="${size * 0.15}" />
  <text x="50%" y="50%" text-anchor="middle" dy="0.35em" fill="white" font-family="Arial, sans-serif" font-size="${size * 0.4}" font-weight="bold">U</text>
</svg>`;

// Dimensiuni iconuri necesare pentru PWA
const sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];

console.log('🎨 Generez iconuri PWA...');

sizes.forEach(size => {
  const svgContent = generateSVG(size);
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(iconsDir, filename);

  fs.writeFileSync(filepath, svgContent);
  console.log(`✅ Generat: ${filename}`);
});

// Generează iconuri specifice pentru shortcuts
const shortcuts = [
  { name: 'dashboard', emoji: '📊', size: 192 },
  { name: 'projects', emoji: '📋', size: 192 },
  { name: 'clients', emoji: '👥', size: 192 },
  { name: 'invoices', emoji: '💰', size: 192 }
];

shortcuts.forEach(shortcut => {
  const svgContent = `<svg width="${shortcut.size}" height="${shortcut.size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad${shortcut.name}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad${shortcut.name})" rx="${shortcut.size * 0.15}" />
    <text x="50%" y="50%" text-anchor="middle" dy="0.15em" font-size="${shortcut.size * 0.5}">${shortcut.emoji}</text>
  </svg>`;

  const filename = `shortcut-${shortcut.name}.svg`;
  const filepath = path.join(iconsDir, filename);

  fs.writeFileSync(filepath, svgContent);
  console.log(`✅ Generat shortcut: ${filename}`);
});

console.log('🎊 Toate iconurile au fost generate cu succes!');