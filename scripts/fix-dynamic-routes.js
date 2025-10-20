#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Lista de fișiere care trebuie fix-uite (din log-ul Vercel)
const files = [
  'app/api/actions/invoices/efactura-details/route.ts',
  'app/api/analytics/burnout-analysis/route.ts',
  'app/api/analytics/daily-activity/route.ts',
  'app/api/analytics/live-timer/hierarchy/route.ts',
  'app/api/analytics/market-trends/route.ts',
  'app/api/analytics/predictions/route.ts',
  'app/api/analytics/roi-analysis/route.ts',
  'app/api/analytics/resource-optimization/route.ts',
  'app/api/analytics/skills-analysis/route.ts',
  'app/api/analytics/team-performance/route.ts',
  'app/api/analytics/time-tracking/route.ts',
  'app/api/planificator/search/route.ts',
  'app/api/user/planificator/search/route.ts',
  'app/api/rapoarte/proiecte/export/route.ts',
  'app/api/rapoarte/contracte/export/route.ts',
  'app/api/test-contract-data/route.ts',
  'app/api/user/objectives/route.ts',
  'app/api/verify-anaf/route.ts',
  'app/api/oauth/google-drive/callback/route.ts'
];

const insertText = `
// Force dynamic rendering for this route (fixes DynamicServerError)
export const dynamic = 'force-dynamic';
`;

let fixedCount = 0;
let skippedCount = 0;
let notFoundCount = 0;

console.log('🔧 Fixing DynamicServerError in API routes...\n');

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    notFoundCount++;
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Verifică dacă fișierul deja conține "export const dynamic"
  if (content.includes('export const dynamic')) {
    console.log(`⏭️  Skipping (already fixed): ${file}`);
    skippedCount++;
    return;
  }

  // Găsește ultima linie de import
  const lines = content.split('\n');
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('import{')) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex === -1) {
    console.log(`⚠️  No imports found in: ${file}`);
    notFoundCount++;
    return;
  }

  // Inserează după ultimul import
  // Găsește prima linie goală sau prima linie non-import după ultimul import
  let insertIndex = lastImportIndex + 1;
  while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
    insertIndex++;
  }

  // Inserează textul
  lines.splice(insertIndex, 0, insertText.trim());

  // Scrie înapoi în fișier
  const newContent = lines.join('\n');
  fs.writeFileSync(filePath, newContent, 'utf8');

  console.log(`✅ Fixed: ${file}`);
  fixedCount++;
});

console.log('\n📊 Summary:');
console.log(`   ✅ Fixed: ${fixedCount} files`);
console.log(`   ⏭️  Skipped: ${skippedCount} files (already fixed)`);
console.log(`   ⚠️  Not found: ${notFoundCount} files`);
console.log('\n🎉 Done! Please rebuild the project.');
