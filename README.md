🏗️ UNITAR PROIECT - Management Proiecte & Facturare
📋 Overview
Aplicație Next.js pentru management proiecte cu sistem hibrid de facturare (PDF + ANAF) care generează facturi PDF complete cu integrare automată ANAF pentru datele companiilor.
🛠️ Stack Tehnologic

Frontend: Next.js 13.4.19, React 18, TypeScript
Backend: API Routes, BigQuery, Firebase Auth
Database: Google BigQuery (dataset: PanouControlUnitar)
PDF: jsPDF + html2canvas (înlocuit PDFKit pentru compatibilitate Vercel)
Styling: Tailwind CSS (inline)

📊 Structura BigQuery
Tabele principale:

Proiecte - ID_Proiect, Denumire, Client, Status, Valoare_Estimata
Clienti - id, nume, cui, nr_reg_com, adresa, email, telefon
FacturiGenerate - id, proiect_id, client_nume, subtotal, total, status
SesiuniLucru - time tracking pentru proiecte
Subproiecte - managementul sub-task-urilor

✅ Funcționalități Implementate
🚀 SISTEM HIBRID FACTURI (COMPLET - FUNCȚIONAL)

PDF instant cu template profesional HTML + CSS
Integrare ANAF pentru preluare automată date companii
Modal interactiv cu linii multiple de facturare
Calcule automate TVA, subtotaluri, total general
Validări complete pentru toate câmpurile
API routes complete:

app/api/actions/invoices/generate-hibrid/route.ts ✅
app/api/anaf/company-info/route.ts ✅



📱 Componente UI

FacturaHibridModal.tsx - Modal complet cu ANAF + PDF ✅
ProiectActions.tsx - Dropdown acțiuni complete ✅
hooks/useANAFCompanyInfo.ts - Hook pentru ANAF ✅

🔧 Infrastructura

BigQuery integration optimizată ✅
Error handling & validation complete ✅
Responsive design ✅
Compatibilitate Vercel 100% ✅

🎯 Status Actual

SISTEM FUNCȚIONAL pe Vercel
PDF se generează dar apare gol (următoarea optimizare)
ANAF integration funcționează perfect
UI/UX complet și intuitiv

🔧 Problema Actuală
PDF-ul se generează cu success dar conținutul este gol. Cauze posibile:

HTML template nu se randează corect în jsPDF
CSS-ul inline nu e compatibil cu html2canvas
Timing issues în procesarea asincronă

🚀 Quick Start
bashnpm install
npm run dev
📁 Structura Fișiere Key
app/
├── admin/rapoarte/
│   ├── proiecte/
│   │   ├── components/
│   │   │   ├── FacturaHibridModal.tsx ✅ (COMPLET)
│   │   │   ├── ProiectActions.tsx ✅ (COMPLET)
│   │   │   └── ProiecteTable.tsx ✅
│   │   └── page.tsx
│   └── facturi/page.tsx ✅
├── api/
│   ├── actions/invoices/generate-hibrid/route.ts ✅ (HTML+jsPDF)
│   ├── anaf/company-info/route.ts ✅ (ANAF COMPLET)
│   └── rapoarte/proiecte/route.ts
└── components/ (globale)
🔑 Environment Variables
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_CLIENT_EMAIL=
GOOGLE_CLOUD_PRIVATE_KEY=
GOOGLE_CLOUD_CLIENT_ID=
📞 Context pentru Chat-uri Noi
Status: Sistem funcțional cu PDF-uri goale - necesită optimizare HTML→PDF
Tehnologii: Next.js 13 + BigQuery + jsPDF + html2canvas + ANAF API
Problemă actuală: Template HTML nu se randează în PDF (conținut gol)
Următoarea prioritate: Optimizare generare PDF cu conținut complet

💡 Soluții Propuse pentru PDF Gol
🔧 Problema Identificată
HTML-ul generat de API nu se convertește corect în PDF prin jsPDF + html2canvas.
🎯 Soluții de Optimizare:
1. 🚀 Simplificare Template (Recomandat)

Elimină CSS complex (grid, flexbox)
Folosește doar <table> pentru layout
Reduce dependințele de fonturi externe

2. 📋 Debugging Metodic

Console.log HTML-ul înainte de conversie
Testează template-ul direct în browser
Verifică dacă html2canvas captează elementul

3. 🔄 Alternativă: React-PDF

Înlocuiește jsPDF cu @react-pdf/renderer
Control total asupra layout-ului
Compatibilitate garantată cu Vercel

4. ⚡ Fix Rapid

Adaugă await la încărcarea HTML-ului în DOM
Crește timeout-ul pentru procesare
Verifică dimensiunile elementului temporar
