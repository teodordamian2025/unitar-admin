#!/bin/bash

# ==================================================================
# Script pentru adăugare ANAF_CERTIFICATE_SERIAL la Vercel
# ==================================================================

echo "🔧 Adăugare ANAF_CERTIFICATE_SERIAL la Vercel Environment Variables"
echo "===================================================================="
echo ""

# Certificate serial
CERT_SERIAL="501bf75e00000013b927"

echo "📋 Serial certificat: $CERT_SERIAL"
echo "📋 Valid până: 2 iulie 2028"
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI nu este instalat!"
    echo "💡 Instalează cu: npm i -g vercel"
    echo ""
    echo "SAU adaugă manual în Vercel Dashboard:"
    echo "   https://vercel.com/unitarproiect/admin/settings/environment-variables"
    echo ""
    echo "Variabilă de adăugat:"
    echo "   ANAF_CERTIFICATE_SERIAL=$CERT_SERIAL"
    echo "   Scope: Production, Preview, Development"
    exit 1
fi

echo "✅ Vercel CLI găsit"
echo ""

# Add environment variable
echo "🚀 Adăugare variabilă de environment..."
vercel env add ANAF_CERTIFICATE_SERIAL production preview development <<< "$CERT_SERIAL"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ANAF_CERTIFICATE_SERIAL adăugat cu succes!"
    echo ""
    echo "📋 Pași următori:"
    echo "   1. Redeploy aplicația: vercel --prod"
    echo "   2. Verifică logs: vercel logs"
    echo "   3. Testează upload factură din UI"
else
    echo ""
    echo "❌ Eroare la adăugare variabilă!"
    echo "💡 Adaugă manual în Vercel Dashboard:"
    echo "   https://vercel.com/unitarproiect/admin/settings/environment-variables"
    echo ""
    echo "Variabilă de adăugat:"
    echo "   Key: ANAF_CERTIFICATE_SERIAL"
    echo "   Value: $CERT_SERIAL"
    echo "   Scope: Production, Preview, Development"
fi

echo ""
