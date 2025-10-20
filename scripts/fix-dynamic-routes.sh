#!/bin/bash

# Script pentru adăugarea "export const dynamic = 'force-dynamic'" în API routes care au DynamicServerError

echo "🔧 Fixing DynamicServerError in API routes..."

# Lista de fișiere care trebuie fix-uite (din log-ul Vercel)
files=(
  "app/api/actions/invoices/efactura-details/route.ts"
  "app/api/analytics/burnout-analysis/route.ts"
  "app/api/analytics/daily-activity/route.ts"
  "app/api/analytics/live-timer/hierarchy/route.ts"
  "app/api/analytics/market-trends/route.ts"
  "app/api/analytics/predictions/route.ts"
  "app/api/analytics/roi-analysis/route.ts"
  "app/api/analytics/resource-optimization/route.ts"
  "app/api/analytics/skills-analysis/route.ts"
  "app/api/analytics/team-performance/route.ts"
  "app/api/analytics/time-tracking/route.ts"
  "app/api/notifications/cron/route.ts"
  "app/api/planificator/search/route.ts"
  "app/api/user/planificator/search/route.ts"
  "app/api/rapoarte/proiecte/export/route.ts"
  "app/api/rapoarte/contracte/export/route.ts"
  "app/api/test-contract-data/route.ts"
  "app/api/user/objectives/route.ts"
  "app/api/verify-anaf/route.ts"
  "app/api/oauth/google-drive/callback/route.ts"
)

count=0

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Verifică dacă fișierul nu conține deja "export const dynamic"
    if ! grep -q "export const dynamic" "$file"; then
      echo "✅ Fixing: $file"

      # Adaugă export const dynamic după importuri (după ultimul import)
      # Folosim sed pentru a insera după ultimul import
      sed -i '/^import /,/^[^import]/{/^[^import]/i\
\
// Force dynamic rendering for this route\
export const dynamic = '\''force-dynamic'\'';
}' "$file"

      count=$((count + 1))
    else
      echo "⏭️  Skipping (already fixed): $file"
    fi
  else
    echo "⚠️  File not found: $file"
  fi
done

echo ""
echo "🎉 Fixed $count API routes!"
echo "📝 Please review the changes and rebuild the project."
