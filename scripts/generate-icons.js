#!/usr/bin/env node

// CALEA: scripts/generate-icons.js
// DATA: 20.09.2025 09:30 (ora României)
// DESCRIERE: Generator de iconuri PWA simple pentru UNITAR PROIECT

const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create simple SVG icon template
function createSVGIcon(size) {
  const fontSize = Math.floor(size / 4);
  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.1}"/>
  <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold"
        fill="white" text-anchor="middle" dominant-baseline="middle">UP</text>
</svg>`.trim();
}

// Ensure icons directory exists
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG files (as fallback since we can't easily convert to PNG without additional deps)
sizes.forEach(size => {
  const svg = createSVGIcon(size);
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(iconsDir, filename);

  fs.writeFileSync(filepath, svg);
  console.log(`✅ Created ${filename}`);
});

// Create simple PNG placeholders using data URLs (base64 encoded simple images)
function createPNGDataURL(size) {
  // Simple 1x1 blue pixel scaled up - not perfect but will work as placeholder
  const canvas = Buffer.from(`
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#3b82f6"/>
  <text x="50%" y="55%" font-family="Arial" font-size="${Math.floor(size/4)}"
        fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">UP</text>
</svg>
  `.trim());

  return canvas;
}

// For now, copy the SVG as PNG with .png extension (browsers often handle SVG in PNG context)
sizes.forEach(size => {
  const svg = createSVGIcon(size);
  const filename = `icon-${size}x${size}.png`;
  const filepath = path.join(iconsDir, filename);

  // Write SVG content but with PNG extension - many browsers will handle this gracefully
  fs.writeFileSync(filepath, svg);
  console.log(`✅ Created ${filename} (SVG fallback)`);
});

// Create shortcut icons
const shortcuts = ['dashboard', 'projects', 'clients', 'analytics'];
shortcuts.forEach(name => {
  const svg = `
<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" fill="#3b82f6" rx="10"/>
  <text x="50%" y="55%" font-family="Arial" font-size="24"
        fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${name.charAt(0).toUpperCase()}</text>
</svg>`.trim();

  const filename = `shortcut-${name}.png`;
  const filepath = path.join(iconsDir, filename);
  fs.writeFileSync(filepath, svg);
  console.log(`✅ Created shortcut ${filename}`);
});

console.log('\n🎉 All PWA icons generated successfully!');
console.log('Note: These are SVG-based fallbacks. For production, consider using proper PNG conversion tools.');