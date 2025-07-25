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

```
app/
├── admin/rapoarte/
│   ├── proiecte/
│   │   ├── components/
│   │   │   ├── FacturaHibridModal.tsx ✅ (COMPLET + Auto-completare + Subproiecte)
│   │   │   ├── ProiectActions.tsx ✅ (COMPLET + Buton Adauga Subproiect + Modal)
│   │   │   ├── ProiecteTable.tsx ✅ (COMPLET + Afișare ierarhică subproiecte)
│   │   │   ├── ProiectFilters.tsx ✅ (Filtrare avansată)
│   │   │   └── ProiectNouModal.tsx ✅ (Creare proiecte noi)
│   │   └── page.tsx ✅ (Layout principal cu filtre și tabel)
│   └── facturi/page.tsx ✅ (Management facturi generate)
├── api/
│   ├── actions/invoices/
│   │   └── generate-hibrid/route.ts ✅ (HTML+jsPDF + Client lookup + Metadata)
│   ├── anaf/
│   │   └── company-info/route.ts ✅ (ANAF API integration completă)
│   └── rapoarte/
│       ├── proiecte/route.ts ✅ (CRUD complet proiecte)
│       ├── subproiecte/route.ts ✅ (CRUD complet subproiecte cu JOIN)
│       └── clienti/route.ts ✅ (CRUD complet clienti)
└── components/ (globale)
```

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
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLOUD_CLIENT_ID=your-client-id
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
