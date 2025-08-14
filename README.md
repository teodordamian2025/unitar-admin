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
- - - - - - ProiectEditModal.tsx
- - - - - - ProiectActions.tsx
- - - - - - SubproiectModal.tsx
- - - - - - ProiectNouModal.tsx
- - - - - - ProiecteTable.tsx
- - - - - - FacturaHibridModal.tsx
- - - - - - ProiectFilters.tsx
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
- - - - email
- - - - - send-client
- - - - - - route.ts
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
- - - - banca
- - - - - route.ts
- - - - facturare
- - - - - route.ts
- - - rapoarte
- - - - subproiecte
- - - - - route.ts
- - - - cheltuieli
- - - - - route.ts
- - - - clienti
- - - - - route.ts
- - - - facturi
- - - - - last-number
- - - - - - route.ts
- - - - proiecte
- - - - - export
- - - - - - route.ts
- - - - - route.ts
- - - - - [id]
- - - - - - route.ts
- - - - dashboard
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
- - facturi
- git-filter-repo.py


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

Ultimele lucruri implementate:
Rezumat Toate Problemele Rezolvate:
✅ 1. ProiectNouModal - Adăugat câmp Adresa:
app/admin/rapoarte/proiecte/components/ProiectNouModal.tsx
Câmp nou "Adresa Proiect" în formular
Validare și trimitere în API
Reset form include și adresa=functional

✅ 2. API Proiecte - Suport pentru Adresa:
app/admin/rapoarte/proiecte/components/ProiectNouModal.tsx
POST include câmpul Adresa în INSERT
PUT permite actualizarea Adresei
GET include căutare și în câmpul Adresa=functional

✅ 3. Dropdown Actions - Poziționare Inteligentă:
app/admin/rapoarte/proiecte/components/ProiectActions.tsx
Calculează spațiul disponibil automat
Se afișează deasupra când e aproape de jos
useRef pentru referința butonului=functional

✅ 4. Vezi Detalii și Editează - Implementate:
app/admin/rapoarte/proiecte/components/ProiectActions.tsx
"Vezi Detalii" afișează informații complete în toast
"Editează" pregătit pentru modal/pagină de editare
Console.log pentru debugging=functional

✅ 5. TVA 21% - Adăugat în dropdown:
app/admin/rapoarte/proiecte/components/FacturaHibridModal.tsx
Opțiune nouă "21%" pentru noua reglementare din august 2025


2025-07-25 19:10
REZUMAT FINAL - Fix-uri Complete UnitarProiect
🎯 Probleme Rezolvate Complet
✅ 1. Butonul "Proiect Nou" - READĂUGAT
Problema: Butonul "Proiect Nou" a dispărut din pagina principală
Soluția:

Fișier: app/admin/rapoarte/proiecte/page.tsx
Fix: Readăugat butonul în header-ul paginii, între titlu și filtre
Funcționalitate: Deschide modalul ProiectNouModal pentru crearea de proiecte noi

✅ 2. Erori HTTP 500 API - REZOLVATE COMPLET
Problema: "Parameter types must be provided for null values via the 'types' field"
Soluția:

Fișiere: app/api/rapoarte/proiecte/route.ts și app/api/rapoarte/subproiecte/route.ts
Fix Principal: Adăugat câmpul types în toate query-urile BigQuery
Implementări:

Types specificate pentru toate parametrii (STRING, DATE, FLOAT64)
Null handling explicit pentru câmpuri opționale
Error handling îmbunătățit cu success: false în răspunsuri
Debug logging pentru troubleshooting



✅ 3. React Error #31 - ELIMINAT COMPLET
Problema: "object with keys {value}" la deschiderea modalului subproiect
Soluția:

Fișier: app/admin/rapoarte/proiecte/components/ProiectActions.tsx
Fix Principal:

Implementare safe state management cu strings
Helper pentru formatarea datelor cu support dual (string | {value: string})
Toast sistem propriu fără dependențe externe (react-toastify)
Modal subproiect implementat complet în aceeași componentă



📁 Fișiere Actualizate
🎯 Frontend Components:

app/admin/rapoarte/proiecte/page.tsx

✅ Readăugat butonul "Proiect Nou" în header
✅ Handler pentru refresh după adăugarea proiectelor
✅ Layout optimizat cu butonul vizibil


app/admin/rapoarte/proiecte/components/ProiectActions.tsx

✅ Fix React Error #31 cu state management safe
✅ Toast sistem propriu fără dependențe externe
✅ Modal subproiect implementat în aceeași componentă
✅ Handler-e funcționale pentru toate acțiunile
✅ Support dual pentru formate de date (string | {value: string})



🎯 Backend API Routes:

app/api/rapoarte/proiecte/route.ts

✅ Types specificate pentru toate query-urile BigQuery
✅ Null handling explicit pentru câmpuri opționale
✅ Error handling îmbunătățit cu success: false
✅ Support complet pentru câmpul Adresa
✅ Debug logging pentru troubleshooting


app/api/rapoarte/subproiecte/route.ts

✅ Types specificate pentru toate parametrii
✅ Query simplificat fără câmpuri inexistente (activ, data_creare)
✅ Join optimizat cu tabelul Proiecte
✅ Null handling explicit și error handling complet



🚀 Funcționalități Restaurate/Implementate
✅ Management Proiecte Complet:

✅ Butonul "Proiect Nou" functional în header
✅ Vezi detalii cu toast formatat elegant
✅ Editează cu modal de confirmare
✅ Toate acțiunile din dropdown funcționale

✅ Management Subproiecte Complet:

✅ Modal adăugare subproiect functional
✅ API backend pentru CRUD subproiecte
✅ Afișare ierarhică în tabel (funcția există deja)
✅ Includere în facturi (funcția există deja)

✅ API Backend Robust:

✅ BigQuery queries cu types specificate
✅ Error handling complet cu logging
✅ Support pentru câmpuri nullable
✅ Răspunsuri standardizate cu success: true/false

🔍 Test Plan Pentru Verificare
1. Test Buton Proiect Nou:
✅ Accesează /admin/rapoarte/proiecte
✅ Verifică că butonul "Proiect Nou" apare în header (verde, dreapta sus)
✅ Click pe buton → se deschide modalul ProiectNouModal
✅ Completează și submit → proiectul se adaugă fără erori BigQuery
2. Test Vezi Detalii:
✅ Click pe "Acțiuni" pentru orice proiect
✅ Click "Vezi Detalii" → apare toast cu informații complete
✅ Verifică că toate câmpurile sunt afișate corect=functional
3. Test Adăugare Subproiect:
✅ Click pe "Acțiuni" pentru un proiect principal
✅ Click "Adaugă Subproiect" → se deschide modalul fără erori React
✅ Completează și submit → subproiectul se creează
✅ Verifică în listă că subproiectul apare=functional
4. Test Generare Factură:
✅ Click pe "Acțiuni" → "Generare Factură"
✅ Verifică că se încarcă subproiectele disponibile
✅ Verifică că butonul de adăugare subproiecte funcționează
✅ Generează PDF cu succes
⚡ Quick Fix Implementation=functional
De facut:
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
Modificare generate-hibrid/route.ts - calcule multi-valută

ETAPA 4: EDITARE/STORNARE FACTURI ✏️
Prioritate: ÎNALTĂ - funcționalitate critică
Componente noi:

EditareFacturaModal.tsx - modal editare identic cu generarea = este implementat
Modificare FacturiList.tsx - buton editare = este implementat

API-uri modificate:

app/api/actions/invoices/ - endpoints pentru editare/stornare = este implementat
Probleme actuale:
1.La generarea facturii este cumva legat de valoarea proiectului in RON din tabelul Proiecte si Subproiecte din Bigquery pentru articolele care sunt initial in valuta si cat am cautat nu am gasit cum sa dezlegam aceasta legatura astfel atunci cand facem factura sa folosim cursul valutar din ziua facturarii, nu cea din ziua crearii proiectului si subproiectelor. Ideal ar fi ca la meniul de generare a facturii sa fie o rubrica "Data curs valutar" unde sa alegem data, iar la fiecare articol sa mai fie o coloana cu valorile editabile ale cursului valutar pentru valutele prezente in articole, iar acestea sa fie folosite mai departe pentru a calcula valoarea articolului respectiv. Nota de la finalul facturii despre cursul valutar poate sa ramana, dar pot fi scoase celelalte note intermediare de la meniul de la generarea facturii referitoare la cursul valutar, acesta se va afisa doar in coloana noua, corespunzator datei alese.
2. La partea de Lista Proiecte : https://admin.unitarproiect.eu/admin/rapoarte/proiecte sa se afiseze valoarea echivalenta in RON pentru cele care sunt in valuta, asa cum au fost definite cand s-a creat proiectul.
3. Cand se editeaza proiectul, daca se vrea sa se modifice cursul valutar pentru alta zi, actiunea trebuie sa se propage si la subproiecte.
