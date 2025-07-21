# 🏗️ UNITAR PROIECT - Management Proiecte & Facturare

## 📋 Overview
Aplicație Next.js pentru management proiecte cu sistem hibrid de facturare (PDF + ANAF).

## 🛠️ Stack Tehnologic
- **Frontend:** Next.js 13.4.19, React 18, TypeScript
- **Backend:** API Routes, BigQuery, Firebase Auth
- **Database:** Google BigQuery (dataset: PanouControlUnitar)
- **PDF:** Puppeteer 24.14.0
- **Styling:** Tailwind CSS (inline)

## 📊 Structura BigQuery

### Tabele principale:
- `Proiecte` - ID_Proiect, Denumire, Client, Status, Valoare_Estimata
- `Clienti` - id, nume, cui, nr_reg_com, adresa, email, telefon
- `FacturiGenerate` - id, proiect_id, client_nume, subtotal, total, status
- `SesiuniLucru` - time tracking pentru proiecte
- `Subproiecte` - managementul sub-task-urilor

## ✅ Funcționalități Implementate

### 🚀 SISTEM HIBRID FACTURI (COMPLET)
- **PDF instant** cu template profesional
- **Integrare ANAF** pentru preluare date companii
- **Modal interactiv** în ProiectActions
- **API routes complete:**
  - `app/api/actions/invoices/generate-hibrid/route.ts`
  - `app/api/actions/invoices/download/[id]/route.ts`  
  - `app/api/actions/invoices/list/route.ts`
  - `app/api/anaf/company-info/route.ts`

### 📱 Componente UI
- `FacturaHibridModal.tsx` - Generare factură cu ANAF
- `FacturiList.tsx` - Lista facturilor cu filtre
- `ProiectActions.tsx` - Dropdown acțiuni (MODIFICAT)
- `hooks/useANAFCompanyInfo.ts` - Hook pentru ANAF

### 🔧 Infrastructura
- BigQuery integration optimizată
- File upload system (uploads/facturi/)
- Error handling & validation
- Responsive design

## 🎯 Roadmap Următoare

### 📅 FAZA 3: Time Management (URMĂTOAREA)
- [ ] Time tracker component
- [ ] Calendar integration cu FullCalendar
- [ ] Grafic Gantt pentru proiecte
- [ ] Rapoarte ore lucrate

### 🌐 FAZA 4: eFactura ANAF Completă
- [ ] XML UBL generation
- [ ] OAuth2 ANAF authentication
- [ ] Upload eFactura în background
- [ ] Import facturi primite

### 📊 FAZA 5: Analytics & Dashboard
- [ ] Metrici avansate
- [ ] Real-time updates cu WebSockets
- [ ] Export Excel îmbunătățit
- [ ] Notificări email

## 🚀 Quick Start

```bash
npm install
npm run dev
```

## 📁 Structura Fișiere Key

```
app/
├── admin/rapoarte/
│   ├── proiecte/
│   │   ├── components/
│   │   │   ├── FacturaHibridModal.tsx ✅
│   │   │   ├── FacturiList.tsx ✅
│   │   │   └── ProiectActions.tsx ✅ (MODIFICAT)
│   │   └── page.tsx
│   └── facturi/page.tsx ✅ (NOU)
├── api/
│   ├── actions/invoices/ ✅ (SISTEM COMPLET)
│   ├── anaf/ ✅ (INTEGRARE COMPLETĂ)
│   └── rapoarte/proiecte/route.ts
└── hooks/useANAFCompanyInfo.ts ✅

uploads/
├── facturi/ ✅ (PDF-uri generate)
├── contracte/
└── temp/
```

## 🔑 Environment Variables
```
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_CLIENT_EMAIL=
GOOGLE_CLOUD_PRIVATE_KEY=
GOOGLE_CLOUD_CLIENT_ID=
```

## 🐛 Debugging Notes
- Puppeteer needs `--no-sandbox` in production
- BigQuery location: 'EU'
- ANAF API: webservicesp.anaf.ro (no auth needed)

## 📞 Claude.ai Context pentru Chat-uri Noi
**Ultimul chat completat:** Sistem Hibrid Facturi ✅
**Status:** FUNCȚIONAL - gata pentru producție
**Următoarea prioritate:** Time Management System

---
*Actualizat: Ianuarie 2025 - Chat Sistem Hibrid Facturi*
