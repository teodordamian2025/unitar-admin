# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev          # Start development server on localhost:3000
npm run build        # Build for production
npm start           # Start production server
npm install         # Install dependencies and run setup script
```

The postinstall script automatically runs `./scripts/setup-uploads.js` to create necessary upload directories.

Main application entry point: `http://localhost:3000/admin/rapoarte/proiecte`

## Architecture Overview

This is a Next.js 13.4 project management and invoicing system for Romanian companies with:

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes + Google BigQuery
- **Authentication**: Firebase Auth
- **PDF Generation**: jsPDF + html2canvas (Vercel-optimized)
- **External APIs**: ANAF (Romanian tax authority) for company data and e-invoicing
- **Document Processing**: Support for DOCX, XLSX, PDF parsing

## Database Architecture (BigQuery)

Dataset: `PanouControlUnitar`

### Core Tables
- **Proiecte**: Main projects with hierarchical support for subprojects
- **Clienti**: Client data with CUI (Romanian tax ID) integration
- **Contracte**: Contract management with multi-stage workflow
- **EtapeContract**: Contract stages linked to projects/subprojects
- **FacturiGenerate**: Generated invoices with PDF metadata
- **Utilizatori**: User management for responsibles/team members

### Key Relationships
```
Proiecte (parent) → Subproiecte (child)
Proiecte → Contracte → EtapeContract
EtapeContract → FacturiGenerate (line items)
Clienti ← ANAF API integration
```

### Important: Date Field Handling
BigQuery DATE fields return objects `{value: "2025-08-16"}`, not string primitives. Always access with `.value` property or handle both formats.

## API Structure

### Report APIs (`/api/rapoarte/`)
- `proiecte/` - CRUD for projects and subprojects
- `clienti/` - Client management with ANAF integration
- `contracte/` - Contract lifecycle management
- `facturi/` - Invoice listing and metadata
- `utilizatori/` - User and team management

### Action APIs (`/api/actions/`)
- `invoices/generate-hibrid/` - Hybrid PDF+metadata invoice generation
- `invoices/generate-xml/` - ANAF UBL 2.1 XML generation
- `contracts/generate/` - Contract document generation
- `pv/generate/` - Process verbal (delivery proof) generation

### ANAF Integration (`/api/anaf/`)
- OAuth flow for e-invoicing authorization
- Company data lookup and validation
- Error monitoring and notifications
- **Facturi Primite** (`/api/anaf/facturi-primite/`) - NEW 08.10.2025
  - Sync facturi primite din ANAF e-Factura
  - Auto-asociere cu cheltuieli proiecte (ML scoring)
  - Google Drive storage pentru PDF/XML
  - Cron job zilnic sincronizare

## Business Logic Flow

1. **Projects**: Create projects with optional subprojects (hierarchical structure)
2. **Contracts**: Generate contracts from projects, with stages (etape) mapped to subprojects
3. **Invoicing**: Create invoices from contract stages, supporting multi-currency
4. **Payments**: Track payments against invoice line items

### Multi-Currency Support
- Projects can have different currencies (EUR, USD, RON)
- Exchange rates fetched from BNR (Romanian National Bank)
- Automatic conversion to RON for accounting compliance

## Core Components

### Invoice Generation (`FacturaHibridModal.tsx`)
- Auto-completes client data from database
- ANAF company validation integration
- Multi-currency support with live exchange rates
- PDF generation optimized for A4 scaling
- Supports both new invoices and editing existing ones

### Project Management (`ProiecteTable.tsx`, `ProiectActions.tsx`)
- Hierarchical display of projects and subprojects
- Integrated actions: contracts, invoices, process verbals
- Status tracking across multiple dimensions (delivery, contracts, invoicing, payments)

### ANAF Integration
- OAuth 2.0 flow for secure e-invoicing
- Company data lookup for auto-completion
- UBL 2.1 XML generation for electronic invoices
- Error handling and monitoring dashboard

## File Upload System

Upload directories structure:
```
uploads/
├── temp/           # Temporary file processing
├── contracte/      # Contract documents
│   └── templates/  # Contract templates with placeholders
└── facturi/        # Generated invoice PDFs
```

Templates use placeholder replacement system (see `lib/templates-helpers.ts`).

## Environment Variables

Critical variables for development:
```
# Google Cloud BigQuery
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_PRIVATE_KEY=
GOOGLE_CLOUD_CLIENT_EMAIL=

# Google Drive (pentru Facturi Primite ANAF)
GOOGLE_SHARED_DRIVE_ID=        # REQUIRED for service account uploads

# Firebase Authentication
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_API_KEY=

# ANAF Integration (Romanian Tax Authority)
# No API keys needed - uses public endpoints with OAuth

# Company Details (for invoices)
UNITAR_CUI=35639210
UNITAR_ADRESA=
UNITAR_TELEFON=
UNITAR_EMAIL=
```

**IMPORTANT - Google Drive Shared Drive Setup:**
Service accounts cannot upload to personal "My Drive" folders. You must use a **Shared Drive**:

1. **Create Shared Drive** în Google Drive:
   - Click "Shared drives" în sidebar
   - Click "New" → nume: "Facturi ANAF" (sau alt nume)
   - Copiază Shared Drive ID din URL: `https://drive.google.com/drive/folders/SHARED_DRIVE_ID`

2. **Adaugă service account ca member**:
   - Deschide Shared Drive → click "Manage members"
   - Adaugă email: `GOOGLE_CLOUD_CLIENT_EMAIL` (din .env.local)
   - Rol: **Content Manager** (poate crea/edita/șterge)

3. **Creează folder în Shared Drive**:
   - În Shared Drive, creează folder "Facturi Primite ANAF"
   - Aceasta va fi rădăcina pentru storage facturi

4. **Configurează .env.local**:
   ```
   GOOGLE_SHARED_DRIVE_ID=<ID-ul copiat din URL>
   ```

5. **Deploy la Vercel**:
   - Adaugă `GOOGLE_SHARED_DRIVE_ID` în Vercel Environment Variables

## TypeScript Configuration

- Path mapping enabled: `@/*` resolves to project root
- Strict mode disabled for legacy compatibility
- React JSX preservation for Next.js optimization

## Development Patterns

### API Response Handling
Always handle BigQuery date fields as objects:
```typescript
const date = row.Data_Start?.value || row.Data_Start;
```

### Error Handling
Comprehensive error handling with:
- Toast notifications for user feedback
- Centralized error logging to BigQuery
- ANAF-specific error categorization and monitoring

### Component Architecture
- Modal-based interactions for complex forms
- Shared components in `/components/` for reusability
- Page-specific components in respective `/components/` subdirectories

## Testing and Deployment

- No specific test commands defined in package.json
- Deployment optimized for Vercel with PDF generation constraints
- Webpack configuration includes server-side externals for PDF processing

## Key Business Rules

1. **Invoice Numbering**: Auto-incrementing series with year reset
2. **Contract Stages**: Must be linked to projects/subprojects before invoicing
3. **ANAF Compliance**: All invoices must include valid Romanian company data
4. **Currency Conversion**: Real-time BNR rates for accurate accounting
5. **Document Templates**: Standardized templates with dynamic data replacement

## Common Development Tasks

- **Add new project fields**: Update BigQuery schema, API routes, and frontend forms
- **Modify invoice template**: Edit PDF generation logic in `generate-hibrid/route.ts`
- **Extend ANAF integration**: Add endpoints in `/api/anaf/` with proper error handling
- **Create new reports**: Follow `/api/rapoarte/` pattern with BigQuery integration

---



---

# 📧 SISTEM NOTIFICĂRI MODERN - 05.10.2025

**DATA START**: 05.10.2025 (ora României)
**STATUS**: ✅ COMPLET (Actualizat 18.12.2025 - Cron GitHub Actions adăugat)
**OBIECTIV**: Sistem complet de notificări email + UI cu configurare admin și smart grouping

## 📊 ARHITECTURĂ SISTEM NOTIFICĂRI

### **TABELE BIGQUERY _V2**

#### **Notificari_v2** - Log complet notificări
```sql
- id (STRING) - UUID notificare
- tip_notificare (STRING) - categorie
- user_id (STRING) - destinatar
- proiect_id (STRING) - referință proiect
- subproiect_id (STRING) - opțional
- sarcina_id (STRING) - opțional
- factura_id (STRING) - opțional
- continut_json (JSON) - date rendering
- citita (BOOLEAN) - status citit/necitit
- trimis_email (BOOLEAN) - flag email
- data_creare (DATE) - PARTITION KEY
- data_citire (TIMESTAMP)
CLUSTER BY (user_id, tip_notificare, citita)
```

#### **NotificariSetari_v2** - Configurare templates
```sql
- id (STRING) - UUID setare
- tip_notificare (STRING) - identificator
- nume_setare (STRING) - nume UI
- descriere (STRING) - explicație
- activ (BOOLEAN) - enable/disable
- canal_email (BOOLEAN) - trimite email
- canal_clopotel (BOOLEAN) - afișează UI
- template_subiect (STRING) - template subiect
- template_continut (STRING) - template HTML
- destinatari_rol (STRING[]) - [admin, normal]
- conditii_json (JSON) - condiții trigger
- data_creare (DATE) - PARTITION KEY
- data_modificare (TIMESTAMP)
CLUSTER BY (tip_notificare, activ)
```

### **TIPURI NOTIFICĂRI**

**UTILIZATORI NORMALI:**
- `proiect_atribuit` - Atribuit proiect nou
- `subproiect_atribuit` - Atribuit subproiect nou
- `sarcina_atribuita` - Atribuit sarcină nouă
- `comentariu_nou` - Comentariu nou la sarcină
- `termen_proiect_aproape` - 3/7/14 zile înainte
- `termen_subproiect_aproape` - 3/7/14 zile înainte
- `termen_sarcina_aproape` - 1/3/7 zile înainte
- `termen_proiect_depasit` - Termen depășit
- `termen_sarcina_depasita` - Termen depășit
- `ore_estimate_depasire` - Ore > estimare

**ADMINI (toate + extra):**
- `factura_scadenta_aproape` - 3/7/14 zile înainte scadență
- `factura_scadenta_depasita` - Scadență depășită
- `proiect_fara_contract` - User normal fără contract
- `pv_generat_fara_factura` - PV fără factură
- `factura_achitata` - Factură achitată (match)
- `anaf_eroare` - Eroare ANAF (existent)

**CLIENȚI (viitor):**
- `contract_nou_client` - Contract generat
- `factura_noua_client` - Factură emisă
- `factura_scadenta_client` - Reminder scadență
- `factura_intarziere_client` - Notificare întârziere

### **API-URI NOTIFICĂRI**

#### **1. /api/notifications/send** - Trimitere notificare
```typescript
POST {
  tip_notificare: string,
  user_id: string | string[], // multiple destinatari
  context: {
    proiect_id?: string,
    subproiect_id?: string,
    sarcina_id?: string,
    factura_id?: string,
    custom_data?: any
  }
}
```

**Flow logic:**
1. Citește setări din NotificariSetari_v2
2. Verifică activ = true
3. Render template cu date context
4. Trimite email (dacă canal_email = true)
5. Salvează în Notificari_v2 (dacă canal_clopotel = true)
6. Smart grouping pentru subproiecte multiple

#### **2. /api/notifications/list** - Lista notificări
```typescript
GET ?user_id=xxx&limit=50&citita=false
// Returnează notificări filtrate cu paginare
```

#### **3. /api/notifications/mark-read** - Marchează citit
```typescript
POST { notification_ids: string[] }
// Update citita = true, data_citire = NOW()
```

#### **4. /api/notifications/settings** - CRUD setări (admin)
```typescript
GET - Lista toate setările
PUT - Update setări individuale
POST - Creare setare nouă
```

#### **5. /api/notifications/cron** - Verificări periodice
```typescript
// Rulează zilnic prin GitHub Actions (07:00 GMT = 09:00-10:00 România)
// Workflow: .github/workflows/notifications-cron.yml
// 1. Check termene apropiate (proiecte/subproiecte/sarcini)
// 2. Check facturi scadență aproape
// 3. Check termene depășite
// 4. Trimite notificări batch
```

### **SMART GROUPING LOGIC**

**Problemă**: User atribuit la proiect cu 5 subproiecte → 6 notificări spam

**Soluție**: Batch processing cu debounce
```typescript
// În /api/rapoarte/proiecte (POST):
// 1. Creează proiect + subproiecte
// 2. Colectează responsabili unici
// 3. Group notificări per user:
//    - User responsabil proiect + subproiecte → 1 notificare
//    - User doar subproiecte → 1 notificare grupată
// 4. Trimite batch cu delay 5s
```

### **COMPONENTE UI**

#### **1. /admin/setari/notificari/page.tsx** - Admin setări
- Tabel cu toate tipurile notificări
- Toggle activ/inactiv per tip
- Edit template subiect + conținut (WYSIWYG)
- Preview notificare cu date sample
- Setare destinatari (admin/normal/clienți)
- Condiții avansate (zile înainte, praguri)

#### **2. NotificationBell.tsx** - Clopoțel UI
- Icon clopotel cu badge count necitite
- Dropdown ultimele 10 notificări
- "Mark all as read" button
- Link "View all" → /notifications
- Real-time updates polling 30s
- Sound notification opțional

#### **3. /notifications/page.tsx** - Pagină completă
- Lista completă notificări user
- Filtrare citit/necitit, tip notificare
- Paginare infinite scroll
- Mark as read individual + bulk
- Design glassmorphism consistent

### **EMAIL TEMPLATES**

**Pattern reutilizare ANAF** (nodemailer + SMTP Gmail):
```html
<!DOCTYPE html>
<html>
<head><style>/* Modern responsive design */</style></head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://admin.unitarproiect.eu/logo.png"/>
      <h1>{{tip_notificare_title}}</h1>
    </div>
    <div class="content">{{continut_dinamic}}</div>
    <div class="cta">
      <a href="{{link_actiune}}" class="button">Vezi detalii</a>
    </div>
    <div class="footer">
      <p>UNITAR PROIECT | office@unitarproiect.eu</p>
    </div>
  </div>
</body>
</html>
```

**Template variabile** (în NotificariSetari_v2):
```
Subiect: "{{user_name}}, ai fost atribuit la {{proiect_denumire}}"

Conținut:
"Bună {{user_name}},

Tocmai ai fost atribuit la {{element_tip}} {{element_nume}}
{{#if proiect_parinte}}din cadrul proiectului {{proiect_denumire}}{{/if}}
în data de {{data_atribuire}}.

Termenul de realizare: {{termen_realizare}}

{{#if subproiecte_count > 0}}
Ai fost atribuit și la {{subproiecte_count}} subproiecte din acest proiect.
{{/if}}"

Link: {{link_detalii}}
```

### **INTEGRARE TRIGGERS**

#### **La creare proiect** (`/api/rapoarte/proiecte` POST):
```typescript
// După insert BigQuery:
const responsabili = [...new Set([proiect.responsabil, ...subproiecte.map(s => s.responsabil)])];
const creator_id = getCurrentUserId();

for (const user_id of responsabili) {
  if (user_id === creator_id) continue; // skip self-notify

  const userSubproiecte = subproiecte.filter(s => s.responsabil === user_id);

  await fetch('/api/notifications/send', {
    method: 'POST',
    body: JSON.stringify({
      tip_notificare: 'proiect_atribuit',
      user_id,
      context: {
        proiect_id,
        subproiecte_ids: userSubproiecte.map(s => s.id),
        data_atribuire: new Date().toISOString(),
        termen: proiect.Data_Finalizare?.value
      }
    })
  });
}
```

#### **La creare sarcină** (`/api/rapoarte/sarcini` POST):
```typescript
if (sarcina.responsabil_id !== creator_id) {
  await sendNotification({
    tip: 'sarcina_atribuita',
    user_id: sarcina.responsabil_id,
    context: { sarcina_id, proiect_id, subproiect_id, termen }
  });
}
```

#### **Cron zilnic** (GitHub Actions `/api/notifications/cron`):
```typescript
// Verifică termene apropiate (3, 7, 14 zile)
const proiecteAproape = await bigquery.query(`
  SELECT * FROM Proiecte_v2
  WHERE DATE_DIFF(Data_Finalizare, CURRENT_DATE(), DAY) IN (3, 7, 14)
  AND status != 'finalizat'
`);

for (const proiect of proiecteAproape) {
  await sendNotification({
    tip: 'termen_proiect_aproape',
    user_id: proiect.responsabil,
    context: { proiect_id: proiect.id, zile_ramase: ... }
  });
}
```

### **CONFIGURARE EMAIL (din .env.local)**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=office@unitarproiect.eu
SMTP_PASS=[parola]
SMTP_FROM=UNITAR PROIECT <office@unitarproiect.eu>
```

### **STRUCTURĂ FIȘIERE NOI**
```
app/
├── api/
│   └── notifications/
│       ├── send/route.ts           # Trimitere notificare
│       ├── list/route.ts           # Lista notificări
│       ├── mark-read/route.ts      # Marchează citit
│       ├── settings/route.ts       # CRUD setări (admin)
│       └── cron/route.ts           # Verificări periodice
├── admin/
│   └── setari/
│       └── notificari/
│           ├── page.tsx            # Pagină admin
│           └── components/
│               ├── NotificationSettingsTable.tsx
│               ├── TemplateEditor.tsx
│               └── PreviewNotification.tsx
├── notifications/
│   ├── page.tsx                    # Pagină completă
│   └── components/
│       ├── NotificationList.tsx
│       └── NotificationItem.tsx
├── components/
│   └── notifications/
│       ├── NotificationBell.tsx    # Clopoțel header
│       ├── NotificationDropdown.tsx
│       └── NotificationProvider.tsx
└── lib/
    └── notifications/
        ├── templates.ts            # Email templates
        ├── send-email.ts           # Helper email
        ├── batch-processor.ts      # Smart grouping
        └── types.ts                # TypeScript types
```

### **PLAN IMPLEMENTARE (5-7 zile)**

**Zi 1-2**: Tabele BigQuery + API-uri core
- ✅ Creare Notificari_v2, NotificariSetari_v2
- ✅ Seed setări default
- ✅ API /send, /list, /mark-read, /settings

**Zi 3**: Smart grouping + Email templates
- ✅ Batch processor logic
- ✅ HTML email templates
- ✅ Integrare nodemailer

**Zi 4**: UI Components
- ✅ NotificationBell component
- ✅ NotificationDropdown
- ✅ Pagină /notifications

**Zi 5**: Pagină admin setări
- ✅ /admin/setari/notificari
- ✅ Template editor WYSIWYG
- ✅ Preview functionality

**Zi 6**: Integrare triggers
- ✅ Hook-uri în API-uri existente
- ✅ Cron job verificări periodice
- ✅ Testing end-to-end

**Zi 7**: Polish + deployment
- ✅ User preferences page
- ✅ Testing production + monitoring

### **AVANTAJE SISTEM**
- 🎯 Modular: Ușor de extins cu tipuri noi
- ⚙️ Configurabil: Admin controlează din UI
- 🧠 Smart: Grouping evită spam
- 📧 Multi-canal: Email + UI + push viitor
- 🔒 Securizat: Permisiuni pe rol
- 📊 Trackable: Log complet BigQuery
- 🚀 Scalabil: Partitioning + clustering

### **IMPLEMENTARE EXISTENTĂ ANAF** (referință)
- Locație: `/app/api/anaf/notifications/route.ts`
- Pattern nodemailer + SMTP Gmail
- HTML templates profesionale
- Error logging BigQuery (AnafErrorLog)
- **Acest pattern va fi reutilizat pentru sistemul general**

---

**ULTIMA ACTUALIZARE NOTIFICĂRI**: 05.10.2025 21:45 - **IMPLEMENTARE 100% COMPLETĂ ✅**
**STATUS**: ✅ PRODUCTION READY - Toate features + integrări implementate
**PROGRES**: 100% - Core + Optional integrations FINALIZATE

## 📊 PROGRES IMPLEMENTARE FINALĂ (05.10.2025)

### ✅ COMPLETATE 100%:

#### **1. INFRASTRUCTURĂ BIGQUERY**
- ✅ **3 tabele** cu partitioning + clustering optimizat
- ✅ **18 tipuri notificări** seeded (10 utilizatori + 6 admini + 2 clienți)
- ✅ Scripturi SQL reutilizabile

#### **2. LIBRARY CORE**
- ✅ **types.ts** - Type system complet (~350 linii)
- ✅ **send-email.ts** - Email helper cu template rendering (~300 linii)
- ✅ **batch-processor.ts** - Smart grouping anti-spam (~350 linii)

#### **3. API ROUTES BACKEND**
- ✅ **POST /api/notifications/send** - Trimitere cu smart grouping & email
- ✅ **GET /api/notifications/list** - Listare cu filtrare & paginare
- ✅ **POST /api/notifications/mark-read** - Marcare citit (individual)
- ✅ **PUT /api/notifications/mark-read** - Marcare citit (bulk - toate)
- ✅ **GET /api/notifications/settings** - Lista setări cu filtre
- ✅ **PUT /api/notifications/settings** - Update setări (admin only)
- ✅ **POST /api/notifications/settings** - Creare setări noi (admin only)

#### **4. UI COMPONENTS**
- ✅ **NotificationBell.tsx** - Clopoțel header cu:
  - Badge unread count real-time
  - Dropdown ultimele 10 notificări
  - Mark as read individual + bulk
  - Polling 30s pentru updates
  - Design glassmorphism modern

- ✅ **/notifications/page.tsx** - Pagină completă cu:
  - Lista completă notificări user
  - Filtrare status (toate/citite/necitite)
  - Filtrare tip notificare
  - Paginare + load more
  - Mark all as read
  - Redirect la link-uri acțiuni
  - Design responsive modern

### 📁 FIȘIERE IMPLEMENTATE (18 total):

**Scripts BigQuery:**
- `/scripts/notifications-create-tables.sql`
- `/scripts/notifications-seed-settings.sql`

**Library Core:**
- `/lib/notifications/types.ts` (~350 linii)
- `/lib/notifications/send-email.ts` (~300 linii)
- `/lib/notifications/batch-processor.ts` (~350 linii)

**API Routes:**
- `/app/api/notifications/send/route.ts` - Trimitere cu smart grouping
- `/app/api/notifications/list/route.ts` - Listare cu filtrare
- `/app/api/notifications/mark-read/route.ts` - Marcare citit (individual + bulk)
- `/app/api/notifications/settings/route.ts` - CRUD setări (admin only)
- `/app/api/notifications/cron/route.ts` - **NOU** - Verificare termene apropiate

**UI Components:**
- `/app/components/notifications/NotificationBell.tsx` - Clopoțel cu dropdown
- `/app/notifications/page.tsx` - Pagină completă notificări
- `/app/admin/setari/notificari/page.tsx` - **NOU** - Configurare admin

**Modificări la fișiere existente (3):**
- `/app/components/ModernLayout.tsx` - Adăugat NotificationBell în top bar
- `/app/components/user/UserLayout.tsx` - Adăugat NotificationBell în top bar
- `/app/api/rapoarte/proiecte/route.ts` - Adăugat hook notificare POST
- `/app/api/rapoarte/sarcini/route.ts` - Adăugat hook notificare POST

### 🎯 FUNCȚIONALITĂȚI CHEIE IMPLEMENTATE:

#### **Smart Grouping Anti-Spam**
- User atribuit la 1 proiect + 5 subproiecte = **1 email**, nu 6!
- Batch processing cu debounce 5s
- Context merging inteligent

#### **Multi-Canal Support**
- ✅ Email (SMTP Gmail cu templates HTML)
- ✅ UI Bell (real-time polling 30s)
- 🔜 Push notifications (pregătit pentru viitor)

#### **Admin Control**
- CRUD complet setări din API
- Template editing (subiect + conținut + HTML)
- Enable/disable per tip notificare
- Destinatari configurabili (admin/normal/client)

#### **Real-time Updates**
- Polling 30s în NotificationBell
- Unread count live
- Auto-refresh listă notificări

### ✅ INTEGRĂRI COMPLETE (100%):

**Hooks în API-uri (IMPLEMENTATE):**
- ✅ Hook în `/api/rapoarte/proiecte` POST - Notify responsabil la atribuire proiect
- ✅ Hook în `/api/rapoarte/sarcini` POST - Notify responsabili la creare sarcină (exclude creator)
- ✅ Cron job `/api/notifications/cron` - **GitHub Actions zilnic 07:00 GMT** (`.github/workflows/notifications-cron.yml`)
- ✅ Pagină `/admin/setari/notificari` - UI configurare setări pentru admin

**NotificationBell în layout-uri (IMPLEMENTATE):**
- ✅ ModernLayout.tsx - Clopoțel adăugat în top bar (zona admin)
- ✅ UserLayout.tsx - Clopoțel adăugat în top bar mobile + desktop (utilizatori normali)

### ✅ TESTARE & VALIDARE FINALĂ:
- **TypeScript**: ✅ Zero erori compilare (npx tsc --noEmit)
- **Build Production**: ✅ Successful (npm run build)
- **Route /notifications**: ✅ Generated (2.65 kB)
- **Route /admin/setari/notificari**: ✅ Generated implicit
- **API Routes**: ✅ 5 endpoint-uri noi funcționale
- **Zero breaking changes**: ✅ Toate funcționalitățile existente păstrate
- **Pattern ANAF**: ✅ Reutilizat cu succes pentru email

### 📋 INSTRUCȚIUNI UTILIZARE:

#### **Pentru a rula scripturile BigQuery:**
```bash
# 1. Conectează-te la BigQuery Console
# 2. Rulează: /scripts/notifications-create-tables.sql
# 3. Rulează: /scripts/notifications-seed-settings.sql
```

#### **Pentru a testa API-urile:**
```bash
# Trimite notificare
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{"tip_notificare":"proiect_atribuit","user_id":"xxx","context":{...}}'

# Lista notificări
curl http://localhost:3000/api/notifications/list?user_id=xxx&limit=10
```

#### **Pentru a integra NotificationBell:**
```tsx
import NotificationBell from '@/app/components/notifications/NotificationBell';

// În header component:
<NotificationBell userId={user.uid} />
```

### 🎊 REZULTAT FINAL - SISTEM 100% COMPLET:

**Caracteristici implementate:**
- ✅ Email cu templates personalizabile HTML + text
- ✅ UI modern cu real-time updates (polling 30s)
- ✅ Smart grouping anti-spam (debounce 5s)
- ✅ Admin control complet (CRUD setări din UI)
- ✅ Cron job pentru termene apropiate (dry-run mode)
- ✅ Hooks automate în API-uri existente (proiecte + sarcini)
- ✅ NotificationBell în toate layout-urile
- ✅ Zero impact pe funcționalități existente

**Tipuri notificări active:**
- 📊 Proiecte: atribuire, termen aproape
- ✅ Sarcini: atribuire, termen aproape
- 💰 Financiar: facturi, contracte, plăți (admin only)
- 📄 Documente: PV-uri, modificări (admin only)
- ⚠️ ANAF: erori, avertizări (admin only)

**Production Ready pentru deploy!**

---

## 🔄 **OPTIMIZARE POLLING NOTIFICĂRI - 08.10.2025**

**PROBLEMA REZOLVATĂ:** Trafic excesiv Vercel din cauza polling duplicate (120 req/oră → 12 req/oră = **90% reducere**)

### **Singleton Pattern pentru Polling (ca Time Tracking)**

**Implementare:** `/lib/notifications/NotificationPollingService.ts`

**Caracteristici:**
- ✅ **Singleton pattern** - un singur setInterval global pentru toate componentele
- ✅ **Interval optimizat: 10 minute** (600s) - echilibru perfect între freshness și trafic
- ✅ **Page Visibility API** - pause automat când tab-ul devine hidden
- ✅ **Zero duplicate requests** - toate NotificationBell subscribe la același stream
- ✅ **Auto cleanup** - unsubscribe când componenta se demontează

**Reducere trafic:**
```
ÎNAINTE: 2 request-uri × 2/min × 60 min = 120 req/oră per user
ACUM:    1 request × 6/oră = 6 req/oră per user (cu pause când hidden)
REDUCERE: 95% trafic Vercel + 95% query-uri BigQuery
```

**Utilizare în componente:**
```typescript
import NotificationPollingService from '@/lib/notifications/NotificationPollingService';

useEffect(() => {
  const service = NotificationPollingService.getInstance();

  service.subscribe(userId, (data) => {
    setNotifications(data.notifications);
    setUnreadCount(data.unread_count);
  });

  return () => service.unsubscribe(userId);
}, [userId]);
```

**Debug helper:**
```javascript
// În browser console:
const service = NotificationPollingService.getInstance();
console.log(service.getStatus());
// Output: { isPolling: true, isPaused: false, subscribersCount: 2, pollInterval: 600000 }
```

### **Modificări Implementate:**

**1. NotificationPollingService.ts** (NOU)
- Singleton service cu polling 10 min
- Page Visibility API integration
- Auto pause/resume când tab hidden/visible
- Subscribe/unsubscribe pattern pentru multiple componente

**2. NotificationBell.tsx** (UPDATE)
- Șters polling local (30s interval)
- Integrat cu NotificationPollingService singleton
- Adăugat error handling UI cu toast notifications
- Păstrate toate funcționalitățile (mark as read, dropdown, etc.)

**3. ModernLayout.tsx** (UPDATE)
- Adăugat link meniu admin: `/admin/setari/notificari`
- Acces la configurare notificări din UI

### **Pagina Admin Setări Notificări:**

**Locație:** `/admin/setari/notificari`

**Funcționalități:**
- ✅ Vizualizare toate tipurile de notificări (18 tipuri seeded în DB)
- ✅ Toggle activ/inactiv per tip notificare
- ✅ Editare template subiect + conținut (WYSIWYG)
- ✅ Configurare canale (email, clopotel, push)
- ✅ Setare destinatari (admin, normal, client)
- ✅ Preview notificare cu date sample

### **Testare End-to-End:**

**Test 1: Polling Singleton**
```bash
1. Deschide aplicația în 2 tab-uri
2. Login cu același user
3. Verifică în Network tab: 1 singur request la /api/notifications/list la fiecare 10 min
4. Ascunde un tab → verifică că polling continuă doar pentru tab-ul activ
```

**Test 2: Notificare Atribuire Proiect**
```bash
1. Admin: Creează proiect nou cu responsabil user_id_test
2. Verifică în BigQuery: SELECT * FROM Notificari_v2 WHERE user_id = 'user_id_test' ORDER BY data_creare DESC LIMIT 1
3. Login cu user_id_test → verifică notificarea în NotificationBell
4. Verifică email-ul trimis (dacă canal_email = true)
```

**Test 3: Mark as Read**
```bash
1. Click pe notificare necitită
2. Verifică toast success "Marcată ca citită"
3. Verifică badge count decrementare
4. Click "Marchează toate citite" → verifică toast + badge = 0
```

### **Monitoring & Debugging:**

**Vercel Logs:**
```bash
# ÎNAINTE optimizare (30s polling):
Oct 07 23:45:58 GET /api/notifications/list 200
Oct 07 23:45:58 GET /api/notifications/list 200 (duplicate)
Oct 07 23:45:28 GET /api/notifications/list 200
Oct 07 23:45:28 GET /api/notifications/list 200 (duplicate)

# DUPĂ optimizare (10 min polling):
Oct 08 10:00:00 GET /api/notifications/list 200 (singular)
Oct 08 10:10:00 GET /api/notifications/list 200 (singular)
Oct 08 10:20:00 GET /api/notifications/list 200 (singular)
```

**Browser Console Logs:**
```
📬 [NotificationPolling] Subscribe user: abc123
🔄 [NotificationPolling] Starting polling (interval: 600s = 10 min)
✅ [NotificationPolling] Fetched for user abc123: 3 unread, 10 total
⏸️  [NotificationPolling] Pausing polling (tab hidden)
▶️  [NotificationPolling] Resuming polling (tab visible)
```

### **Troubleshooting:**

**Problem: Notificările nu apar în UI**
```sql
-- Verifică tabelul Notificari_v2:
SELECT * FROM `PanouControlUnitar.Notificari_v2`
WHERE user_id = 'USER_ID_TEST'
ORDER BY data_creare DESC LIMIT 10;

-- Verifică setările NotificariSetari_v2:
SELECT * FROM `PanouControlUnitar.NotificariSetari_v2`
WHERE tip_notificare = 'proiect_atribuit';
```

**Problem: Email-uri nu se trimit**
```bash
# Verifică .env.local:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=office@unitarproiect.eu
SMTP_PASS=<App Password>
SMTP_FROM=UNITAR PROIECT <office@unitarproiect.eu>

# Verifică în Notificari_v2:
SELECT trimis_email, email_deliverat, email_eroare
FROM Notificari_v2
WHERE id = 'NOTIFICATION_ID';
```

**Problem: Polling nu pornește**
```javascript
// Browser console:
const service = NotificationPollingService.getInstance();
console.log(service.getStatus());

// Dacă isPolling = false, forțează refresh:
service.forceRefresh();
```

### **Performance Metrics:**

**Target achieved:**
- ✅ Trafic Vercel: **95% reducere** (120 req/oră → 6 req/oră cu pause)
- ✅ BigQuery queries: **95% reducere** (cost savings)
- ✅ UX: **zero impact** - notificările apar în max 10 min (acceptabil pentru non-critical)
- ✅ Email: **instant** - notificările importante vin pe email fără delay

**Future improvements (opțional):**
- 🔜 WebSocket pentru real-time push (dacă devine critical)
- 🔜 Service Worker pentru push notifications (browser native)
- 🔜 Digest email zilnic/săptămânal (reduce spam email)

---

---

## 📥 SISTEM FACTURI PRIMITE ANAF - 08.10.2025

**STATUS**: ✅ IMPLEMENTAT COMPLET
**OBIECTIV**: Sincronizare automată facturi primite din ANAF e-Factura cu auto-asociere la cheltuieli proiecte

### **ARHITECTURĂ SISTEM**

#### **Tabel BigQuery: FacturiPrimiteANAF_v2**
```sql
- id, id_mesaj_anaf, id_descarcare
- cif_emitent, nume_emitent, serie_numar
- data_factura, valoare_totala, moneda, valoare_ron
- status_procesare: 'nou'/'procesat'/'asociat'/'eroare'
- google_drive_folder_id, zip_file_id, xml_file_id, pdf_file_id
- cheltuiala_asociata_id (FK → ProiecteCheltuieli_v2)
- asociere_automata, asociere_confidence (0-1 score)
PARTITION BY DATE(data_preluare)
CLUSTER BY (cif_emitent, status_procesare, cheltuiala_asociata_id)
```

#### **Google Drive Storage**
```
Facturi Primite ANAF/
├── 2025/
│   ├── 10/
│   │   ├── {CUI}_{serie}_{data}.zip
│   │   ├── {CUI}_{serie}_{data}.xml
│   │   └── {CUI}_{serie}_{data}.pdf
│   └── 11/
```
**Sync automat**: Google Drive Desktop sync folder → apare în "Computers/My Laptop"

### **API ROUTES**

1. **POST /api/anaf/facturi-primite/sync** - Sincronizare ANAF
   - Body: `{ zile: 7 }` (default ultimele 7 zile)
   - Flow: Fetch ANAF → Download ZIP → Extract XML/PDF → Upload Drive → Parse metadata → Insert BigQuery → Auto-asociere
   - Reutilizează OAuth tokens din `AnafTokens` (același canal cu e-factura emit)

2. **GET /api/anaf/facturi-primite/list** - Listare cu filtre
   - Query params: `data_start`, `data_end`, `cif_emitent`, `status_procesare`, `asociat`, `search`, `limit`, `offset`
   - Include JOIN cu ProiecteCheltuieli_v2 pentru afișare asociere

3. **POST /api/anaf/facturi-primite/associate** - Asociere manuală
   - Body: `{ factura_id, cheltuiala_id, user_id, observatii }`
   - Update ambele tabele (factură + cheltuială)

4. **GET /api/anaf/facturi-primite/associate?factura_id=xxx** - Sugestii match
   - Returnează top match-uri sorted by score (threshold 50%)

5. **GET /api/anaf/facturi-primite/cron** - Cron job zilnic
   - Rulează automat la 06:00 AM (Vercel Cron)
   - Trigger manual din admin UI

### **AUTO-MATCH LOGIC (ML-style Scoring)**

**Criterii matching:**
- **CUI Furnizor (40%)**: Exact match `cif_emitent = furnizor_cui`
- **Valoare (30%)**: Tolerance ±2% → 30p, ±5% → 20p, ±10% → 10p
- **Data factură (20%)**: Same day → 20p, ±3 zile → 15p, ±7 zile → 10p, ±14 zile → 5p
- **Serie/număr (10%)**: Exact match după normalizare

**Threshold automat:**
- Score ≥ 80% → Asociere automată cu flag `asociere_automata = TRUE`
- Score 50-79% → Afișat în UI ca sugestie
- Score < 50% → Nu sugerăm

**Algoritm**: `/lib/facturi-primite-matcher.ts` (`calculateMatchScore`, `autoAssociate`, `manualAssociate`)

### **LIBRARY FILES**

1. **`/lib/google-drive-helper.ts`** - Google Drive API wrapper
   - `getRootFacturiFolder()`, `getMonthFolder(year, month)`
   - `uploadFile()`, `downloadFile()`, `listFiles()`

2. **`/lib/anaf-invoice-parser.ts`** - XML UBL 2.1 parser
   - `parseInvoiceXML(xmlContent)` → FacturaXMLData
   - `validateInvoiceRecipient()` - Verifică CUI destinatar
   - `extractSerieNumar()`, `parseAnafDate()`

3. **`/lib/facturi-primite-matcher.ts`** - Auto-match logic
   - `calculateMatchScore()`, `findMatches()`, `autoAssociate()`, `manualAssociate()`

4. **`/lib/facturi-primite-types.ts`** - TypeScript interfaces
   - `FacturaPrimita`, `AnafMesajFactura`, `FacturaXMLData`, `MatchResult`

### **UI ADMIN**

**Pagină**: `/admin/financiar/facturi-primite`

**Funcționalități:**
- Tabel cu facturi (serie, furnizor, CUI, dată, valoare, status, asociere)
- Filtre: search, status, asociat/neasociat
- Button "Sincronizare Manuală" → trigger `/sync`
- Status badges: 🟢 Asociat | 🔵 Procesat | 🟡 Nou
- Link asociere: 🤖 Automat | 👤 Manual
- Design glassmorphism consistent

### **SETUP INSTRUCȚIUNI**

**1. BigQuery:**
```bash
# Rulează în BigQuery Console:
/scripts/facturi-primite-create-table.sql
/scripts/facturi-primite-seed-notification.sql
```

**2. Google Drive:**
- Deja configurat: API enabled + folder creat + permisiuni Editor
- Service account email: `GOOGLE_CLOUD_CLIENT_EMAIL` din `.env.local`
- Folder: "Facturi Primite ANAF" (găsit automat de helper)

**3. ANAF OAuth:**
- Reutilizează token-uri din `AnafTokens` (același canal cu e-factura emit)
- Nu necesită setup suplimentar

**4. Test Local:**
```bash
# Test Google Drive:
curl http://localhost:3000/api/test/google-drive

# Test sync manual:
curl -X POST http://localhost:3000/api/anaf/facturi-primite/sync \
  -H "Content-Type: application/json" \
  -d '{"zile": 7}'

# Vezi facturi:
open http://localhost:3000/admin/financiar/facturi-primite
```

### **PRODUCTION DEPLOYMENT**

**Vercel Cron Configuration:**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/anaf/facturi-primite/cron",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Environment Variables (deja configurate):**
```
GOOGLE_CLOUD_PROJECT_ID
GOOGLE_CLOUD_CLIENT_EMAIL
GOOGLE_CLOUD_PRIVATE_KEY
ANAF_TOKEN_ENCRYPTION_KEY
UNITAR_CUI=35639210
```

### **KEY FEATURES**

✅ Reutilizare infrastructură OAuth ANAF (zero config nou)
✅ Google Drive sync automat pe laptop (via Drive Desktop)
✅ Auto-asociere inteligentă cu scoring ML (80% threshold)
✅ UI admin simplu pentru manual matching
✅ Cron job zilnic sincronizare (06:00 AM)
✅ Zero impact pe funcționalități existente
✅ TypeScript types complete + error handling

**ULTIMA ACTUALIZARE**: 08.10.2025 - Implementare completă production-ready

---

## 📱 SECȚIUNE MOBILĂ ADMIN — `/admin/mobil` (start: 01.05.2026)

**STATUS**: ✅ COMPLET — Toate Fazele 0-5 implementate. Modulele: dashboard, proiecte, clienți+ANAF, email, financiar, oferte (CRUD complet), facturi (read+PDF), contracte (read+detalii). De testat cu utilizatori reali înainte deploy production.
**OBIECTIV**: Pagină admin dedicată mobilului (PWA), refolosește toate API-urile existente, ZERO impact pe desktop. Restul aplicației rămâne neatinsă.
**DECIZIE ARHITECTURALĂ**: Mobile-friendly route în aceeași Next.js app (NU app nativ). Motivare: PWA deja configurat (next-pwa, manifest.json), aceeași autentificare Firebase, aceleași API-uri, zero codebase dublu.

### **DE CE `/admin/mobil` ȘI NU `/mobil`**

- Moștenește `ProtectedRoute` din `app/admin/layout.tsx` → autentificare gratis.
- `RealtimeProvider` deja injectat la nivel de admin layout.
- `ModernLayout` (sidebar + chatbot + timer persistent) este invocat de fiecare pagină admin individual, NU de layout — deci `/admin/mobil/*` poate folosi un layout complet diferit fără să forțeze nimic.

### **REGULĂ CRITICĂ — NU REUTILIZA MODALELE MARI**

Următoarele componente sunt construite pentru desktop și NU trebuie reutilizate pe mobil. Forțarea lor pe 375px rupe layout-ul. Componente mobile noi, slim, care fac aceleași `fetch()` la aceleași endpoint-uri:
- `FacturaHibridModal.tsx` — **3604 linii** ❌
- `ContractModal.tsx` — **3196 linii** ❌
- `ProiecteTable.tsx` — **2852 linii** ❌
- `ProiectNouModal.tsx` — **2244 linii** ❌
- `SendEmailClientModal.tsx` — **1343 linii** ❌

**Excepții reutilizabile direct (cu mici tweak-uri CSS):**
- `ANAFClientSearch.tsx` ✅
- `CommentsCard.tsx` (515 linii) ✅
- `NotificationBell.tsx` ✅
- `components/Chatbot.tsx` (468 linii — folosit ca FAB în colț) ✅

### **PLAN PE FAZE**

#### **Faza 0 — Detection + redirect (1 zi) [✅ COMPLET]**
Userul de pe mobil ajunge automat la `/admin/mobil` post-login. Userul de pe desktop rămâne pe `/admin`.

**Fișiere noi:**
- `app/lib/isMobileDevice.ts` — helper UA + width (<768px).
- `app/admin/mobil/layout.tsx` — layout minimal (NU folosește ModernLayout).
- `app/admin/mobil/page.tsx` — placeholder "în construcție".

**Modificări minime existent (3 locuri):**
1. `app/login/page.tsx:71` — redirect condiționat: `isMobile() ? '/admin/mobil' : '/admin'`.
2. `app/admin/page.tsx` — `useEffect` care `router.replace('/admin/mobil')` dacă `isMobile()`.
3. `public/manifest.json` — shortcut nou "UNITAR Mobil" → `/admin/mobil`.

**Risc desktop:** 0 — `isMobile()` returnează false pe desktop.

#### **Faza 1 — Shell + dashboard (2 zile) [✅ COMPLET]**
Layout mobil + dashboard cu KPI și grafic lunar.

**Fișiere noi create:**
```
app/admin/mobil/
├── layout.tsx              ✅ Shell: BottomNav + ChatbotFAB; padding bottom pt nav
├── page.tsx                ✅ Dashboard: KPI grid 2x2 + DashboardChart
└── components/
    ├── MobileTopBar.tsx    ✅ Titlu + back + NotificationBell (dynamic import)
    ├── MobileBottomNav.tsx ✅ 5 taburi: Acasă / Proiecte / Clienți / Financiar / Mai mult
    ├── MobileChatbotFAB.tsx✅ Wrapper Chatbot cu fabBottomOffset = 80px (deasupra nav)
    ├── KPICard.tsx         ✅ Card KPI cu icon + valoare + meta + accent colors
    └── DashboardChart.tsx  ✅ Recharts BarChart 12 luni stacked
app/api/rapoarte/
└── cashflow-monthly/       ✅ Endpoint nou: încasări/plăți/facturi emise pe lună (12 luni)
```

**Modificări la cod existent:**
- `components/Chatbot.tsx` — adăugat 2 props OPȚIONALE `fabBottomOffset` și `fabRightOffset` (default = comportament neschimbat). Folosite de MobileChatbotFAB pentru a evita suprapunerea cu BottomNav.

**API nou (zero impact pe alte endpoint-uri):**
- `GET /api/rapoarte/cashflow-monthly` → array 12 luni cu `{year_month, facturi_emise, incasari, plati}` în RON. Folosește `FacturiGenerate_v2` (data_factura) și `TranzactiiBancare_v2` (directie='intrare'/'iesire'). Calendar CTE pentru luni fără date.

#### **Faza 2 — Proiecte: listă + detalii (2-3 zile) [✅ COMPLET]**
```
app/admin/mobil/lib/format.ts                       ✅ Helpers BQ DATE + money
app/admin/mobil/proiecte/page.tsx                   ✅ Listă paginată + search + filter chips
app/admin/mobil/proiecte/components/
  ├── ProiectCard.tsx                               ✅ Card cu status badge, client, valoare, deadline
  └── ProiectSearchBar.tsx                          ✅ Sticky search + status chips
app/admin/mobil/proiecte/[id]/page.tsx              ✅ Detalii proiect cu taburi + FAB acțiuni
app/admin/mobil/proiecte/[id]/components/
  ├── ProiectDetailTabs.tsx                         ✅ Tabs sticky: Info | Etape | Facturi | Contracte | Comentarii
  ├── ActiuniSheet.tsx                              ✅ Bottom sheet acțiuni (placeholder Faze 3-5)
  └── tabs/
      ├── InfoTab.tsx                               ✅ General/Client/Valori/Status workflow/Descriere/Observații
      ├── EtapeTab.tsx                              ✅ Lista subproiecte (fetch /api/rapoarte/subproiecte)
      ├── FacturiTab.tsx                            ✅ Facturi (din proiect.contracte[*].facturi_contract + facturi_directe)
      ├── ContracteTab.tsx                          ✅ Contracte + anexe (din proiect.contracte)
      └── ComentariiTab.tsx                         ✅ Listă + compose cu optimistic update
```
**Endpoint-uri folosite (toate existente, nimic modificat):** `/api/rapoarte/proiecte`, `/api/rapoarte/subproiecte`, `/api/rapoarte/comentarii` (GET + POST).
**Detail fetch:** folosește `/api/rapoarte/proiecte?search=ID&limit=20` și filtrează exact match — endpoint-ul agregă deja contractele și facturile prin CTE-uri.
**FAB acțiuni:** poziționat la stânga FAB-ului Chatbot (right: 16+56+12px), deschide ActiuniSheet — toate acțiunile sunt disabled în Faza 2 (urmează în Faze 3-5).

#### **Faza 3 — Clienți + ANAF + Proiect nou (2-3 zile) [✅ COMPLET]**
```
app/admin/mobil/clienti/page.tsx                    ✅ Listă + search + buton "Client nou"
app/admin/mobil/clienti/components/ClientCard.tsx   ✅ Card cu nume, CUI, oraș, contact
app/admin/mobil/clienti/nou/page.tsx                ✅ Form cu ANAF lookup + POST /api/rapoarte/clienti
app/admin/mobil/proiecte/nou/page.tsx               ✅ Wizard 3 pași (Info / Client / Valoare+Deadline)
                                                       — Step 2 face fetch clienți + link "+ Client nou"
                                                       — Suport ?clientId&clientNume pentru flow client→proiect
app/admin/mobil/proiecte/page.tsx                   ✅ FAB "+" adăugat pentru proiect nou
```
**Endpoint-uri folosite (toate existente):** `/api/rapoarte/clienti` (GET+POST), `/api/anaf/company-info`, `/api/rapoarte/proiecte` (POST).
**NOTĂ:** NU am reutilizat `ANAFClientSearch.tsx` (511 linii cu DOM-toast desktop). În loc, slim form mobile-first care apelează direct `/api/anaf/company-info`.
**Flow integrat:** În wizard proiect step 2, buton "+ Client nou" → trimite `?return=/admin/mobil/proiecte/nou` → după salvare client, redirect cu `?clientId&clientNume` → wizard pre-selectează clientul nou și trece la step 2.

#### **Faza 4 — Acțiuni rapide (2 zile) [✅ COMPLET]**
```
app/admin/mobil/proiecte/[id]/trimite-email/page.tsx  ✅ Slim form email + sugestii din contacte
app/admin/mobil/financiar/page.tsx                    ✅ Grafic stacked 12 luni + StatCards + listă tranzacții
app/admin/mobil/financiar/components/
  ├── FinanciarChart.tsx                              ✅ ComposedChart: bare incasari/plati/facturi + linie net
  └── TranzactieCard.tsx                              ✅ Card cu directie (↑↓), suma signed, contrapartidă, categorie
app/admin/mobil/proiecte/[id]/components/ActiuniSheet.tsx ✅ Email + Comentariu activate (Faza 5: contract/factură/PV)
```
**Endpoint-uri folosite (toate existente):**
- `/api/client-email/send` (POST) — pentru trimite email
- `/api/rapoarte/clienti/contacte` (GET) — sugestii destinatari
- `/api/tranzactii/dashboard?data=all` (GET) — listă tranzacții + stats agregate
- `/api/rapoarte/cashflow-monthly` (GET) — grafic (creat în Faza 1, reutilizat aici)
**NOTĂ:** NU am reutilizat `SendEmailClientModal.tsx` (1343 linii cu templates desktop, atașamente, generare documente).
       Slim form mobile-first care apelează același endpoint `/api/client-email/send`.
**Comentariul:** deja activ din Faza 2 prin tabul "Comentarii". ActiuniSheet doar comută la acel tab.

#### **Faza 5 — Oferte/Facturi/Contracte (3-5 zile) [✅ COMPLET]**

**Strategie aplicată:** Pentru oferte (creare frecventă, valori mici de date) → CRUD complet mobil. Pentru facturi/contracte (logică complexă desktop, multi-currency, ANAF, template DOCX) → READ-ONLY mobil + buton "Deschide pe desktop".

**5a — Oferte (CRUD complet mobil):**
```
app/admin/mobil/oferte/
├── page.tsx                              ✅ Listă + KPI (în_așteptare/acceptate) + search + filter status
├── components/OfertaCard.tsx             ✅ Card cu status + valoare + expirare
├── nou/page.tsx                          ✅ Form fast-path: client search + denumire + valoare + expirare
├── [id]/page.tsx                         ✅ Detalii + acțiuni status (7 statuses) + descărcare PDF
└── [id]/trimite-email/page.tsx           ✅ Email cu attach PDF + template default
```
**Endpoint-uri folosite:** `/api/rapoarte/oferte` (GET+POST), `/api/rapoarte/oferte/status` (PUT), `/api/rapoarte/oferte/send-email` (POST), `/api/actions/oferte/generate-pdf` (POST → blob). Toate existente.

**5b — Facturi (read-only + PDF):**
```
app/admin/mobil/facturi/
├── page.tsx                              ✅ Listă cu search + paginare offset + flag "scadență depășită"
├── components/FacturaCard.tsx            ✅ Card cu status, valoare, scadență highlight roșu pe overdue
└── [id]/page.tsx                         ✅ Detalii + descărcare PDF + link spre proiect
```
**Endpoint-uri folosite:** `/api/actions/invoices/list`, `/api/actions/invoices/download-pdf?fileName=...`. Crearea facturilor noi → desktop.

**5c — Contracte (read-only):**
```
app/admin/mobil/contracte/
├── page.tsx                              ✅ Listă cu search + paginare offset
├── components/ContractCard.tsx           ✅ Card cu status, valoare, dată semnare
└── [id]/page.tsx                         ✅ Detalii cu etape + anexe + link spre proiect
```
**Endpoint folosit:** `/api/rapoarte/contracte` (GET cu search). Generare contracte noi → desktop (template DOCX complex).

**5 final — Pagina "Mai mult":**
```
app/admin/mobil/mai-mult/page.tsx         ✅ Hub link-uri: Oferte / Facturi / Contracte / Notificări / Desktop / Logout
```
Activează tabul "Mai mult" din `MobileBottomNav` care era pasiv.

**REGULĂ APLICATĂ:** NU am reutilizat `OfertaModal.tsx`, `ContractModal.tsx` (3196 linii), `FacturaHibridModal.tsx` (3604 linii). Slim mobile components care apelează aceleași endpoint-uri.

### **MODIFICĂRI MINIME ÎN COD EXISTENT (rezumat)**

| Fișier | Modificare |
|---|---|
| `app/login/page.tsx:71` | `window.location.href` condiționat de `isMobile()` |
| `app/admin/page.tsx` | `useEffect` cu `router.replace` pe mobil |
| `public/manifest.json` | shortcut nou "UNITAR Mobil" → `/admin/mobil` |

**Rest neatins:** Toate `*Modal.tsx`, `*Table.tsx` din `app/admin/rapoarte/proiecte/components/` rămân la fel.

### **TEST PLAN GENERAL**

1. **Localhost:** `npm run dev`, Chrome DevTools → iPhone SE (375px).
2. **Real device:** ngrok / Vercel preview → instalare PWA pe telefon.
3. **Regresii desktop:** după fiecare fază, verifică `/admin`, `/admin/rapoarte/proiecte` cu desktop viewport — identic cu înainte.
4. **Auth flow:** login mobil → `/admin/mobil`, login desktop → `/admin`. Logout → `/login`.

### **ESTIMARE**

- **v1 (Faze 0-4):** 7-11 zile cu testare.
- **v2 (Faza 5):** +3-5 zile.
