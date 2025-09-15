# 🏗️ UNITAR PROIECT - Management Proiecte & Facturare

## 📋 Overview
Aplicație Next.js pentru management proiecte cu sistem hibrid de facturare (PDF + ANAF) care generează facturi PDF complete cu integrare automată ANAF pentru datele companiilor. Include management complet al subproiectelor și auto-completare date client din baza de date.

## 🛠️ Stack Tehnologic
- **Frontend:** Next.js 13.4.19, React 18, TypeScript
- **Backend:** API Routes, BigQuery, Firebase Auth
- **Database:** Google BigQuery (dataset: PanouControlUnitar)
- **PDF:** jsPDF + html2canvas (optimizat pentru Vercel)
- **Styling:** Tailwind CSS (inline)
- **External APIs:** ANAF API pentru validare date companii

## 📊 Structura BigQuery

### Tabele principale:
- **Proiecte** - ID_Proiect, Denumire, Client, Status, Valoare_Estimata, Data_Start, Data_Final
- **Clienti** - id, nume, cui, nr_reg_com, adresa, email, telefon, banca, iban
- **Subproiecte** - ID_Subproiect, ID_Proiect, Denumire, Responsabil, Status, Valoare_Estimata
- **FacturiGenerate** - id, proiect_id, client_id, serie, numar, subtotal, total_tva, total, status
- **SesiuniLucru** - time tracking pentru proiecte

### 🗑️ Tabel eliminat:
- ~~**FacturiEmise**~~ - înlocuit cu FacturiGenerate (mai complet)

## ✅ Funcționalități Implementate

### 🚀 SISTEM HIBRID FACTURI (COMPLET - FUNCȚIONAL)
- ✅ **PDF instant** cu template profesional HTML + CSS
- ✅ **Scalare optimizată** - PDF ocupă 100% din pagina A4
- ✅ **Integrare ANAF** pentru preluare automată date companii
- ✅ **Auto-completare client** din baza de date
- ✅ **Management subproiecte** - adăugare și includere în facturi
- ✅ **Modal interactiv** cu linii multiple de facturare
- ✅ **Calcule automate** TVA, subtotaluri, total general
- ✅ **Validări complete** pentru toate câmpurile
- ✅ **Fără diacritice** în PDF pentru compatibilitate maximă
- ✅ **Date firmă actualizate** - CUI, adrese, conturi bancare complete

### 📂 MANAGEMENT SUBPROIECTE (NOU - COMPLET)
- ✅ **Buton "Adauga subproiect"** în ProiectActions
- ✅ **Modal creare subproiect** cu toate câmpurile
- ✅ **Afișare ierarhică** în ProiecteTable
- ✅ **Selector subproiecte** în factură
- ✅ **Adăugare automată** la liniile facturii
- ✅ **Diferențiere vizuală** proiecte vs subproiecte

### 🔗 AUTO-COMPLETARE DIN BD (NOU - COMPLET)
- ✅ **Căutare automată client** pe baza numelui din proiect
- ✅ **Pre-completare toate câmpurile** (CUI, adresă, telefon)
- ✅ **Client ID lookup** pentru legătura cu BD
- ✅ **Indicator vizual** când datele sunt din BD
- ✅ **Fallback inteligent** dacă clientul nu e găsit

### 🔧 ÎMBUNĂTĂȚIRI INFRASTRUCTURĂ
- ✅ **BigQuery integration** optimizată cu JOIN-uri
- ✅ **Error handling** & validation complete
- ✅ **Responsive design** pentru toate componentele
- ✅ **Compatibilitate Vercel** 100%
- ✅ **Fix URL redirect** - nu mai redirecționează după download
- ✅ **Loading states** pentru toate operațiunile
- ✅ **Toast notifications** informative

## 🎯 Status Actual

### ✅ SISTEM COMPLET FUNCȚIONAL
- **PDF generare** - Scale optimizat la 100% A4
- **ANAF integration** - Funcționează perfect
- **Auto-completare BD** - Client data preluată automat
- **Subproiecte** - Management complet implementat
- **UI/UX** - Complet și intuitiv cu loading states
- **BigQuery** - Salvare completă în FacturiGenerate

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Accesează: `http://localhost:3000/admin/rapoarte/proiecte`

## 📁 Structura Fișiere Key

- .env.local
- package-lock.json
- package.json
- README.md
- lib
- - templates-helpers.ts
- - firebaseConfig.ts
- tsconfig.json
- .gitignore
- pages
- - api
- - - queryBigQuery.ts
- - - chat.ts
- next.config.js
- app
- - login
- - - page.tsx
- - test-page
- - - page.tsx
- - admin
- - - layout.tsx
- - - anaf
- - - - monitoring
- - - - - page.tsx
- - - - setup
- - - - - page.tsx
- - - setari
- - - - firma
- - - - - page.tsx
- - - - contracte
- - - - - page.tsx
- - - - banca
- - - - - page.tsx
- - - - page.tsx
- - - - facturare
- - - - - page.tsx
- - - rapoarte
- - - - layout.tsx
- - - - clienti
- - - - - page.tsx
- - - - - components
- - - - - - ANAFClientSearch.tsx
- - - - - - ClientEditModal.tsx
- - - - - - ClientNouModal.tsx
- - - - page.tsx
- - - - facturi
- - - - - page.tsx
- - - - proiecte
- - - - - [id]
- - - - - - page.tsx
- - - - - page.tsx
- - - - - components
- - - - - - SarcinaNouaModal.tsx
- - - - - - SubcontractantSearch.tsx
- - - - - - ContractModal.tsx
- - - - - - SarciniProiectModal.tsx
- - - - - - ProiectEditModal.tsx
- - - - - - ProiectActions.tsx
- - - - - - TimeTrackingNouModal.tsx
- - - - - - ResponsabilSearch.tsx
- - - - - - ProcesVerbalModal.tsx
- - - - - - SubproiectModal.tsx
- - - - - - ProiectNouModal.tsx
- - - - - - ProiecteTable.tsx
- - - - - - FacturaHibridModal.tsx
- - - - - - ProiectFilters.tsx
- - - - - - SubcontractantNouModal.tsx
- - - - - - FacturiList.tsx
- - - - - - EditFacturaModal.tsx
- - - - components
- - - - - ActionDropdown.tsx
- - - - - FilterBar.tsx
- - - - - BaseTable.tsx
- - - page.tsx
- - layout.tsx
- - api
- - - actions
- - - - invoices
- - - - - download-pdf
- - - - - - route.ts
- - - - - webhook
- - - - - - route.ts
- - - - - generate-hibrid
- - - - - - route.ts
- - - - - regenerate-pdf
- - - - - - route.ts
- - - - - efactura-details
- - - - - - route.ts
- - - - - download
- - - - - - [id]
- - - - - - - route.ts
- - - - - generate-xml
- - - - - - route.ts
- - - - - update
- - - - - - route.ts
- - - - - delete
- - - - - - route.ts
- - - - - list
- - - - - - route.ts
- - - - - get-pdf-filename
- - - - - - route.ts
- - - - contracts
- - - - - generate
- - - - - - route.ts
- - - - clients
- - - - - sync-factureaza
- - - - - - route.ts
- - - - pv
- - - - - generate
- - - - - - route.ts
- - - - email
- - - - - send-client
- - - - - - route.ts
- - - test-contract-data
- - - - route.ts
- - - utilizatori
- - - - curent
- - - - - route.ts
- - - user-role
- - - - route.ts
- - - proceseaza-upload
- - - - docx
- - - - - route.ts
- - - - xlsx
- - - - - route.ts
- - - - txt
- - - - - route.ts
- - - - pdf
- - - - - route.ts
- - - user-database
- - - - route.ts
- - - anaf
- - - - error-handler
- - - - - route.ts
- - - - oauth
- - - - - callback
- - - - - - route.ts
- - - - - callback-test
- - - - - - route.ts
- - - - - token
- - - - - - route.ts
- - - - - authorize
- - - - - - route.ts
- - - - monitoring
- - - - - route.ts
- - - - notifications
- - - - - route.ts
- - - - search-clients
- - - - - route.ts
- - - - company-info
- - - - - route.ts
- - - setari
- - - - firma
- - - - - route.ts
- - - - contracte
- - - - - route.ts
- - - - - templates
- - - - - - route.ts
- - - - - next-number
- - - - - - route.ts
- - - - banca
- - - - - route.ts
- - - - facturare
- - - - - route.ts
- - - rapoarte
- - - - sarcini
- - - - - route.ts
- - - - subproiecte
- - - - - route.ts
- - - - proiecte-responsabili
- - - - - route.ts
- - - - timetracking
- - - - - route.ts
- - - - utilizatori
- - - - - route.ts
- - - - comentarii
- - - - - route.ts
- - - - etape-contract
- - - - - route.ts
- - - - procese-verbale
- - - - - route.ts
- - - - cheltuieli
- - - - - route.ts
- - - - clienti
- - - - - route.ts
- - - - subproiecte-responsabili
- - - - - route.ts
- - - - contracte
- - - - - route.ts
- - - - facturi
- - - - - last-number
- - - - - - route.ts
- - - - anexe-contract
- - - - - route.ts
- - - - proiecte
- - - - - export
- - - - - - route.ts
- - - - - route.ts
- - - - - [id]
- - - - - - route.ts
- - - - dashboard
- - - - - route.ts
- - - - subcontractanti
- - - - - route.ts
- - - queryOpenAI
- - - - route.ts
- - - verify-recaptcha
- - - - route.ts
- - - curs-valutar
- - - - route.ts
- - - genereaza
- - - - docx
- - - - - route.ts
- - - - xlsx
- - - - - route.ts
- - - - txt
- - - - - route.ts
- - - - pdf
- - - - - route.ts
- - - debug-template
- - - - route.ts
- - - bigquery
- - - - route.ts
- - - ai-database
- - - - route.ts
- - - verify-anaf
- - - - route.ts
- - page.tsx
- - components
- - - UserChatbot.tsx
- - - UserDashboard.tsx
- - profil
- - - page.tsx
- - logout
- - - page.tsx
- components
- - ProtectedRoute.tsx
- - Chatbot.tsx
- - FileUploader.tsx
- scripts
- - setup-uploads.js
- next-env.d.ts
- hooks
- - useANAFCompanyInfo.ts
- uploads
- - temp
- - contracte
- - - templates
- - - - contract-template.txt
- - - - anexa-template.txt
- - - - pv-template.txt
- - - .gitignore
- - facturi
- git-filter-repo.py



package.json:
{
  "name": "unitar-admin",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "postinstall": "node ./scripts/setup-uploads.js"
  },
  "dependencies": {
    "@google-cloud/bigquery": "^8.1.1",
    "@types/pdf-parse": "^1.1.5",
    "@types/pdfkit": "^0.17.2",
    "@types/puppeteer": "^7.0.4",
    "@types/react-google-recaptcha": "^2.1.9",
    "docx": "^9.5.1",
    "dotenv": "^17.2.1",
    "exceljs": "^4.4.0",
    "fast-xml-parser": "^4.5.3",
    "firebase": "^11.10.0",
    "framer-motion": "^10.18.0",
    "get-stream": "^9.0.1",
    "jszip": "^3.10.1",
    "lucide-react": "^0.525.0",
    "mammoth": "^1.9.1",
    "next": "^13.4.19",
    "nodemailer": "^7.0.5",
    "openai": "^5.10.2",
    "pdf-parse": "^1.1.1",
    "pdfkit": "^0.17.1",
    "puppeteer": "^24.15.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-dropzone": "^14.3.8",
    "react-firebase-hooks": "^5.1.1",
    "react-google-recaptcha": "^3.1.0",
    "react-hot-toast": "^2.5.2",
    "react-toastify": "^11.0.5",
    "recharts": "^3.1.0",
    "tailwindcss": "^4.1.11",
    "uuid": "^11.1.0",
    "xlsx": "^0.18.5",
    "xmlbuilder2": "^3.1.1"
  },
  "devDependencies": {
    "@types/jszip": "^3.4.0",
    "@types/node": "^20.19.9",
    "@types/nodemailer": "^6.4.17",
    "@types/react": "^18.3.23",
    "@types/react-dom": "^18.3.7",
    "@types/react-dropzone": "^4.2.2",
    "typescript": "^5.8.3"
  }
}

Coduri care au legatura cu facturarea:
app/admin/rapoarte/proiecte/[id]/page.tsx
app/admin/rapoarte/proiecte/components/FacturaHibridModal.tsx
app/api/actions/invoices/generate-hibrid/route.ts
app/api/curs-valutar/route.ts
app/api/rapoarte/subproiecte/route.ts
app/admin/rapoarte/facturi/page.tsx
app/admin/rapoarte/proiecte/components/FacturiList.tsx
app/admin/rapoarte/proiecte/components/EditFacturaModal.tsx
app/api/rapoarte/proiecte/[id]/route.ts
app/api/actions/invoices/list/route.ts
app/api/actions/invoices/update/route.ts
app/api/actions/invoices/regenerate-pdf/route.ts
app/admin/rapoarte/proiecte/components/ProiecteTable.tsx

Coduri care au legatura cu Utilizatorii (Responsabili):
app/admin/rapoarte/proiecte/components/ResponsabilSearch.tsx
app/api/rapoarte/utilizatori/route.ts
app/api/user-role/route.ts
app/api/user-database/route.ts
app/api/utilizatori/curent/route.ts
app/login/page.tsx
lib/firebaseConfig.ts

Tabel Bigquery Utilizatori

Coduri care au legatura cu subcontractantii:
app/api/rapoarte/subcontractanti/route.ts
app/admin/rapoarte/proiecte/components/SubcontractantSearch.tsx
app/admin/rapoarte/proiecte/components/SubcontractantNouModal.tsx
Tabel Bigquery Subcontractanti

Coduri pentru sarcini si timetracking:
app/api/rapoarte/sarcini/route.ts
app/api/rapoarte/comentarii/route.ts
app/api/rapoarte/timetracking/route.ts
app/admin/rapoarte/proiecte/components/SarciniProiectModal.tsx
app/admin/rapoarte/proiecte/components/SarcinaNouaModal.tsx
app/admin/rapoarte/proiecte/components/TimeTrackingNouModal.tsx

Tabele Bigquery: Sarcini, SarciniResponsabili, ProiectComentarii, TimeTracking

Coduri pentru contracte:
app/api/setari/contracte/route.ts
app/api/setari/contracte/next-number/route.ts
app/admin/setari/contracte/page.tsx
app/api/setari/contracte/templates/route.ts
app/api/actions/contracts/generate/route.ts
app/api/rapoarte/contracte/route.ts
app/admin/rapoarte/proiecte/components/ContractModal.tsx
uploads/contracte/templates/contract-template.txt  = sablon contract cu placeholdere
scripts/setup-contract-templates.js = sters, pentru ca incurca la folosirea template
lib/templates-helpers.ts
app/api/rapoarte/etape-contract/route.ts
Tabel Bigquery Contracte si EtapeContract

Coduri pentru lista contracte:
app/admin/rapoarte/contracte/page.tsx
app/admin/rapoarte/contracte/components/ContracteTable.tsx
app/admin/rapoarte/contracte/components/ContractActions.tsx
app/admin/rapoarte/contracte/components/ContractFilters.tsx
app/api/rapoarte/contracte/export/route.ts
app/admin/rapoarte/contracte/components/ContractSignModal.tsx


Coduri pentru anexe contract:
app/api/rapoarte/anexe-contract/route.ts

Coduri pentru PV procese verbale predare:
app/admin/rapoarte/proiecte/components/ProcesVerbalModal.tsx
app/api/actions/pv/generate/route.ts
app/api/rapoarte/procese-verbale/route.ts

Coduri legate de chatbot si Bigquery:
app/api/gueryOpenAI/route.ts
app/api/bigquery/route.ts
pages/api/queryBigQuery.ts
app/components/UserChatbot.tsx
Codurile unde se gaseste o metoda simplificata de extragere date din Bigquery:
components/Chatbot.tsx
app/api/ai-database/route.ts
pages/api/chat.ts

Coduri Timetracking si Management modern:
app/api/analytics/time-tracking/route.ts = API pentru extragerea datelor de analiză time tracking
app/admin/analytics/timetracking/page.tsx = Dashboard principal pentru analiza time tracking
app/admin/analytics/components/QuickTimeEntryModal.tsx = Modal rapid pentru înregistrarea timpului lucrat cu timer live
app/admin/analytics/components/CalendarView.tsx = Calendar view pentru vizualizarea sarcinilor și deadline-urilor
app/api/analytics/calendar-data/route.ts = API pentru extragerea datelor de calendar (sarcini, deadlines, proiecte)
app/admin/analytics/components/GanttChart.tsx = Gantt Chart pentru vizualizarea timeline proiecte cu dependencies
app/api/analytics/gantt-data/route.ts = API pentru extragerea datelor Gantt Chart cu hierarhie și dependencies
app/admin/analytics/components/TeamPerformanceDetail.tsx = Analiza detaliată performance echipă cu heatmap și insights
app/api/analytics/team-performance/route.ts = API extins pentru analiza detaliată performance echipă
app/api/analytics/daily-activity/route.ts = API pentru extragerea activității zilnice pentru heatmap și analysis
app/api/analytics/skills-analysis/route.ts = API pentru analiza skills și growth tracking pe categorii
app/admin/analytics/components/LiveTimerSystem.tsx = Sistem live timer cu management echipă și sesiuni active
app/api/analytics/live-timer/route.ts = API pentru management live timer sessions cu real-time tracking
app/admin/analytics/components/AdvancedAnalytics.tsx = Dashboard avansat cu predictive analytics și business insights
app/api/analytics/predictions/route.ts = API pentru predictive analytics cu ML algorithms și trend forecasting
app/api/analytics/roi-analysis/route.ts = API pentru analiza ROI cu cost analysis, completion probability și risk assessment
app/api/analytics/burnout-analysis/route.ts = API pentru analiza burnout cu detection risc, stress indicators și recommended actions
app/api/analytics/resource-optimization/route.ts = API pentru optimizarea resurselor cu bottleneck detection, utilization analysis și reallocation suggestions
app/api/analytics/market-trends/route.ts = API pentru market trends și skills investment cu demand analysis și strategic recommendations
app/admin/analytics/components/MobileTimeEntry.tsx = PWA-optimized mobile component pentru time tracking cu voice notes și offline capability
app/admin/analytics/components/NotificationCenter.tsx = Sistem centralizat de notificări cu real-time alerts, custom rules și email/SMS integration



### 📋 Descriere Componente Cheie

#### 🎯 **FacturaHibridModal.tsx**
- **Auto-completare client** din BD pe baza numelui proiectului
- **Selector subproiecte** cu adăugare automată la factură
- **Integrare ANAF** pentru verificare date companii
- **Generare PDF** cu scalare optimizată (jsPDF + html2canvas)
- **Validări complete** și error handling
- **UI responsive** cu loading states și toast notifications

#### ⚙️ **ProiectActions.tsx**
- **Dropdown acțiuni** complete pentru proiecte și subproiecte
- **Buton "Adauga subproiect"** (doar pentru proiecte principale)
- **Modal creare subproiect** cu toate câmpurile necesare
- **Generare factură hibridă** cu un click
- **Acțiuni diferențiate** pentru proiecte vs subproiecte
- **Status management** integrat

#### 📊 **ProiecteTable.tsx**
- **Afișare ierarhică** proiecte și subproiecte
- **Încărcare automată** din multiple API endpoints
- **Diferențiere vizuală** cu indentare pentru subproiecte
- **Filtrare avansată** și export Excel
- **Refresh automat** după operațiuni

#### 🔗 **API Routes**
- **`/api/actions/invoices/generate-hibrid`** - Generare facturi cu client lookup și metadata
- **`/api/rapoarte/proiecte`** - CRUD complet proiecte
- **`/api/rapoarte/subproiecte`** - CRUD subproiecte cu JOIN către proiecte
- **`/api/rapoarte/clienti`** - CRUD clienti cu validări și căutare
- **`/api/anaf/company-info`** - Integrare ANAF pentru validare companii

## 🔑 Environment Variables

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=u
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=1
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_API_AI_URL=https://unitar-admin.vercel.app
NEXT_PUBLIC_BASE_URL=https://admin.unitarproiect.eu
GOOGLE_CLOUD_PROJECT_ID=hale-mode-464009-i6
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----....-----END PRIVATE KEY-----"
GOOGLE_CLOUD_CLIENT_EMAIL=
GOOGLE_CLOUD_CLIENT_ID=
UNITAR_CUI=35639210
UNITAR_ADRESA=Str. Dristorului, nr. 98, bl. 11, sc. B, ap. 85, mun. Bucuresti, sector 3
UNITAR_TELEFON=0765486044
UNITAR_EMAIL=office@unitarproiect.eu
# Factureaza.me API Integration
FACTUREAZA_API_ENDPOINT=https://api.factureaza.me
FACTUREAZA_API_KEY=
# Webhook URL pentru notificări (opțional)
FACTUREAZA_WEBHOOK_URL=
# Pentru debugging client nou
NEXT_PUBLIC_FACTUREAZA_ENABLED=false
# Pentru debugging
NEXT_PUBLIC_DEBUG=true
```

## 🏢 Configurare Firmă

### Date Actualizate în Template:
- **Denumire:** UNITAR PROIECT TDA SRL
- **CUI:** RO35639210
- **Nr. Reg. Com.:** J2016002024405
- **Adresa:** Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4
- **Telefon:** 0765486044
- **Email:** contact@unitarproiect.eu

### Conturi Bancare:
- **Cont Principal ING:** RO82INGB0000999905667533
- **Cont Trezorerie:** RO29TREZ7035069XXX018857 (Trezoreria sectorului 3 Bucuresti)

## 🎉 Funcționalități Avansate

### 💰 **Sistem Facturare Hibrid**
1. **Template HTML** cu CSS optimizat pentru PDF
2. **Conversie PDF** cu jsPDF + html2canvas
3. **Scalare 100%** pe pagina A4
4. **Salvare metadata** completă în BigQuery
5. **Client lookup** automat pentru legătura cu BD

### 📂 **Management Subproiecte**
1. **Creare subproiecte** din ProiectActions
2. **Afișare ierarhică** în tabel cu indentare
3. **Includere în facturi** cu selector dedicat
4. **Tracking separat** pentru costuri și progres

### 🔗 **Auto-completare Inteligentă**
1. **Căutare client** automată în BD
2. **Pre-completare toate câmpurile** din profil client
3. **Validare ANAF** pentru verificare date
4. **Fallback manual** dacă datele nu sunt găsite

## 📊 Metrici și Raportare

- **Proiecte active/finalizate/suspendate**
- **Facturi generate/plătite/în așteptare**
- **Valori financiare** pe proiecte și subproiecte
- **Export Excel** cu filtrare avansată
- **Time tracking** pe sesiuni de lucru

## 🔮 Dezvoltări Viitoare

- [ ] **Dashboard analitic** cu grafice și KPI-uri
- [ ] **Sincronizare automată** cu sisteme de contabilitate
- [ ] **Notificări email** pentru deadline-uri și facturi
- [ ] **Mobile app** pentru time tracking
- [ ] **API public** pentru integrări externe

## 📞 Support

Pentru întrebări tehnice sau probleme:
- **Email:** contact@unitarproiect.eu
- **Telefon:** 0765486044

---

**Status:** ✅ **COMPLET FUNCȚIONAL** - Sistem hibrid de facturare cu management proiecte și subproiecte implementat integral.


1. Integrare Clienti noi cu baza de date ANAF
Este adaugata adresa publica fara autentiticare:
https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva
Functioneaza cu aceasta pagina
Fisiere asociate cu integrarea ANAF:
app/api/anaf/search-clients/route.ts // DESCRIERE: Căutare și import clienți din ANAF în baza de date
app/api/anaf/company-info/route.ts // DESCRIERE: Preluare informații companie din ANAF - Actualizat cu fallback URLs
app/api/anaf/search-clients/route.ts // DESCRIERE: Căutare și import clienți din ANAF în baza de date
app/api/verify-anaf/route.ts
app/admin/rapoarte/clienti/components/ANAFClientSearch.tsx // DESCRIERE: Componentă pentru căutare și import clienți din ANAF
app/admin/rapoarte/clienti/components/ClientNouModal.tsx // MODIFICAT: Integrare completă ANAF cu componenta ANAFClientSearch
2. Realizare Contract- de facut
Motivație:

Ușor de implementat cu infrastructura actuală
Funcționalitate completă de management proiecte
Valoare comercială imediată.
3. E-factura ANAF
Motivație:

Cel mai complex dar și cel mai valoros
Necesită date client validate (din etapa 1)
Impact major pentru conformitatea fiscală
Rezumat implementare OAuth ANAF
✅ API Endpoints create:

/api/anaf/oauth/authorize - Inițiază flow OAuth
/api/anaf/oauth/callback - Primește codul de la ANAF
/api/anaf/oauth/token - Management tokens (check, refresh, revoke)
app/api/actions/invoices/generate-xml/route.ts // DESCRIERE: Generare XML UBL 2.1 pentru e-Factura ANAF
app/admin/anaf/setup/page.tsx // DESCRIERE: Pagină pentru configurarea și testarea OAuth ANAF

app/api/actions/invoices/get-pdf-filename/route.ts
app/api/actions/invoices/download-pdf/route.ts
app/api/actions/invoices/efactura-details/route.ts

Pentru monitorizare si erori Oauth si e-factura:
app/api/anaf/error-handler/route.ts // DESCRIERE: Centralized Error Handling & Categorization pentru ANAF
app/api/anaf/notifications/route.ts // DESCRIERE: Email Notifications System pentru ANAF Error Monitoring
app/api/anaf/monitoring/route.ts // DESCRIERE: API Backend pentru ANAF Monitoring Dashboard
app/admin/anaf/monitoring/page.tsx // DESCRIERE: Dashboard complet pentru ANAF Monitoring cu real-time updates
Dashbord erori: https://admin.unitarproiect.eu/admin/anaf/monitoring
app/admin/page.tsx // DESCRIERE: Dashboard admin cu buton ANAF Monitoring adăugat în secțiunea Management Facturi
app/admin/rapoarte/facturi/page.tsx // DESCRIERE: Pagină dedicată pentru gestionarea facturilor cu buton ANAF Monitoring
// ==================================================================

✅ Funcționalități:

Security: State verification pentru CSRF protection
Encryption: Token-urile sunt criptate în BigQuery cu AES-256
Management: Dezactivare automată tokens vechi
Error handling: Logging complet și redirecturi corecte

Implementare setari cu datele pentru facturare, setari firma, setari conturi banca, adaugare cheltuieli la Proiecte, adaugare curs valutar la facturare si curs BNR, adaugare statusuri pentru proiecte-predat/nepredat, pentru contracte Semnat/Nesemnat/Nu e cazul, pentru facturi Facturat/Nefacturat, pentru Achitari
📋 PLAN DE IMPLEMENTARE
ETAPA 1: ZONA DE SETĂRI 🔧
Prioritate: ÎNALTĂ - fundația pentru toate celelalte funcții
Pagini noi necesare:

app/admin/setari/page.tsx - Dashboard setări= implementat
app/admin/setari/facturare/page.tsx - Setări facturare=implementat
app/admin/setari/firma/page.tsx - Date firmă = implementat
app/admin/setari/banca/page.tsx - Conturi bancare= implementat

API-uri noi necesare:

app/api/setari/facturare/route.ts - CRUD setări numerotare = implementat
app/api/setari/firma/route.ts - CRUD date firmă =implementat
app/api/setari/banca/route.ts - CRUD conturi bancare= implementat

Tabele BigQuery noi:
sql- SetariFacturare (serii, numerotare, timp_intarziere_efactura) = implementat
- SetariFirma (nume, adresa, cui, nr_reg_com, email, telefon) = implementat
- SetariBanca (nume_banca, iban, cont_principal, observatii) = implementat
ETAPA 2: ÎMBUNĂTĂȚIRI PROIECTE 💼
Prioritate: ÎNALTĂ - extinde funcționalitatea de bază
Modificări la tabele existente:
sql- Proiecte: +moneda, +status_predare, +status_contract, +status_facturare, +status_achitare
- Subproiecte: +moneda, +status_predare, +status_contract, +status_facturare, +status_achitare
Tabel nou:
sql- ProiecteCheltuieli (id, proiect_id, tip_cheltuiala, furnizor, descriere, valoare, moneda, status_*)
app/api/rapoarte/cheltuieli/route.ts // DESCRIERE: API pentru managementul cheltuielilor proiectelor (subcontractanți, materiale, etc.)
Componente de modificat:

ProiectNouModal.tsx - adaugă câmpuri noi = implementat
ProiecteTable.tsx - afișare status-uri multiple = este implementat
ProiectActions.tsx - acțiuni pentru cheltuieli = este implementat
La pagina Proiecte Actuni/Editeaza pagina ar trebui sa fie identica cu cea pentru Proiect nou, in plus cu optiunea sterge proiect = este implementat
La pagina Proiecte Totalul estimat este aratat in RON, nu este coroborat cu moneda si valoarea din Proiect Nou= nu este implementat


ETAPA 3: SISTEM MULTI-VALUTĂ 💱
Prioritate: MEDIE - necesită API BNR
API-uri noi:

app/api/curs-valutar/route.ts - Integrare BNR = implementat
De facut tabel in Bigquery cu cursul valutar din 2025 si sa se scrie zilnic cursul zilei, ma intereseaza doar EUR, USD, GBP.
Modificare generate-hibrid/route.ts - calcule multi-valută

ETAPA 4: EDITARE/STORNARE FACTURI ✏️
Prioritate: ÎNALTĂ - funcționalitate critică
Componente noi:

EditareFacturaModal.tsx - modal editare identic cu generarea = este implementat
Modificare FacturiList.tsx - buton editare = este implementat

API-uri modificate:

app/api/actions/invoices/ - endpoints pentru editare/stornare = este implementat
Informare despre date:
Extragere Date din Bigquery
BigQuery prin Node.js client returnează DATE fields ca obiecte {value: "2025-08-16"} în loc de string-uri simple.

