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

# 🚀 PLAN DE MODERNIZARE - STADIUL CURENT

**Ultima actualizare**: 19.09.2025 23:55 (ora României) - **MODERNIZARE COMPLETĂ**

## 📋 STRUCTURA FINALĂ ȚINTĂ

### 🏠 Executive Dashboard (`/admin/dashboard`) - **✅ IMPLEMENTAT**
- ✅ KPIs în timp real (cash flow, proiecte, facturi, tranzacții)
- ✅ Alerturi critice (ANAF, termene, facturi întârziate)
- ✅ Quick actions bar pentru operațiuni frecvente
- ✅ Design glassmorphism modern cu hover effects

### 📊 Analytics Hub (`/admin/analytics`) - **✅ COMPLET IMPLEMENTAT**
- ✅ Overview Page cu metrici complete
- ✅ Time Tracking (existent - păstrat)
- ✅ Calendar View (`calendar/page.tsx`) - NOU IMPLEMENTAT
- ✅ Gantt Projects (`gantt/page.tsx`) - NOU IMPLEMENTAT
- ✅ Team Performance (`team/page.tsx`) - NOU IMPLEMENTAT
- ✅ Live Tracking (`live/page.tsx`) - NOU IMPLEMENTAT

### 💼 Operations (`/admin/rapoarte`) - **✅ COMPLET MODERNIZAT**
- ✅ Hub principal (Operations Hub cu KPI cards și quick access)
- ✅ Proiecte (design glassmorphism modern)
- ✅ Clienți (complet modernizat cu carduri glassmorphism)
- ✅ Contracte (funcțional, UI poate fi îmbunătățit în viitor)
- ✅ Facturi (funcțional, UI poate fi îmbunătățit în viitor)
- ✅ ANAF Monitoring (existent)

### 💰 Financial Hub (`/admin/tranzactii`) - **✅ COMPLET MODERNIZAT**
- ✅ Import CSV modernizat cu drag&drop și preview
- ✅ Dashboard Tranzacții complet modernizat cu design glassmorphism
- ✅ Live metrics integration cu real-time updates
- ✅ Advanced filtering și bulk operations
- ✅ Auto-matching (API existent)
- ✅ Manual matching (existent)

### ⚙️ Settings (`/admin/setari`) - **✅ COMPLET MODERNIZAT**
- ✅ Settings Hub central cu carduri interactive
- ✅ System stats display în timp real
- ✅ Action buttons pentru operațiuni sistem
- ✅ Design glassmorphism consistent cu restul aplicației

## 🎯 PROGRES IMPLEMENTARE

### 🎯 OBIECTIVE 100% COMPLETATE (19.09.2025 - FINALIZAT)
- ✅ Analiza schemei BigQuery (42 tabele) - toate datele necesare sunt disponibile
- ✅ Identificarea API-urilor existente pentru dashboard
- ✅ Plan de arhitectură definit
- ✅ **ModernLayout.tsx** - Layout modern cu sidebar collapsible
- ✅ **Design System Complet** - 6 componente glassmorphism
- ✅ **Executive Dashboard** - Dashboard executiv cu KPIs și alerturi
- ✅ **Analytics Hub Overview** - Pagina principală analytics
- ✅ **Calendar View** - Vizualizare evenimente și deadline-uri cu filtrare
- ✅ **Gantt Chart** - Timeline proiecte cu dependențe și progress
- ✅ **Team Performance** - Dashboard echipă cu analiza burnout
- ✅ **Live Tracking** - Sistem monitorizare timp real cu timer personal
- ✅ **Operations Hub** - Pagina principală `/admin/rapoarte` modernizată
- ✅ **Management Clienți** - UI complet modernizat cu carduri glassmorphism
- ✅ **Dependențe Avansate** - Instalate toate librăriile pentru PWA, charts, real-time
- ✅ **PWA Configuration** - Configurare completă next-pwa cu service workers și manifest
- ✅ **Enhanced Charts** - Implementare completă Victory.js cu 3 tipuri de grafice avansate
- ✅ **Real-time Features** - Sistem complet real-time cu polling și notificări live
- ✅ **Financial Hub Enhancement** - UI modern pentru `/admin/tranzactii` - COMPLET FINALIZAT
- ✅ **Settings Refresh** - Modernizare UI `/admin/setari` - COMPLET FINALIZAT

### 🎊 MODERNIZARE COMPLETĂ - TOATE OBIECTIVELE ATINSE!

**STATUS FINAL**: Toate componentele majore ale sistemului UNITAR PROIECT au fost modernizate cu succes!

## 🎨 COMPONENTE IMPLEMENTATE

### ModernLayout.tsx
- Sidebar collapsible cu animații smooth
- Navigation ierarhică cu expandare
- Top bar cu quick actions
- Design glassmorphism complet
- Responsive pentru toate dispozitivele

### Design System UI (/app/components/ui/)
- **Card.tsx** - Card glassmorphism cu 6 variante
- **Button.tsx** - Button modern cu loading și 7 variante
- **Modal.tsx** - Modal cu backdrop blur și animații
- **Input.tsx** - Input field cu validare și icons
- **Alert.tsx** - Alert component cu auto-close
- **LoadingSpinner.tsx** - Spinner cu overlay option
- **index.ts** - Export centralizat

### Analytics Suite Complete (/admin/analytics/)
- **page.tsx** - Overview cu team metrics și quick actions
- **calendar/page.tsx** - Calendar view cu evenimente și filtrare
- **gantt/page.tsx** - Gantt chart cu timeline și dependențe
- **team/page.tsx** - Team performance cu burnout analysis
- **live/page.tsx** - Live tracking cu timer personal și monitoring echipă

### Executive Dashboard (/admin/dashboard/)
- **page.tsx** - KPIs în timp real, alerturi ANAF, quick actions

### Operations Hub Complete (/admin/rapoarte/)
- **page.tsx** - Hub central modernizat cu KPI cards și quick access modules
- **clienti/page.tsx** - Management clienți cu carduri glassmorphism și grid layout
- **proiecte/page.tsx** - Era deja modernizat cu design glassmorphism
- **contracte/page.tsx** - Funcțional existent, UI poate fi îmbunătățit în viitor
- **facturi/page.tsx** - Funcțional existent, UI poate fi îmbunătățit în viitor

### Financial Hub Complete (/admin/tranzactii/)
- **dashboard/page.tsx** - Dashboard modernizat cu glassmorphism și live metrics
- **import/page.tsx** - Import CSV cu drag&drop, preview și statistici în timp real

### Settings Hub Complete (/admin/setari/)
- **page.tsx** - Settings hub central cu carduri interactive și system stats

### Enhanced Charts System (/app/components/charts/)
- **AdvancedLineChart.tsx** - Multi-series line charts cu area fill și animații
- **AdvancedBarChart.tsx** - Grouped/stacked/single bar charts cu orientare configurabilă
- **AdvancedPieChart.tsx** - Pie și donut charts cu legends și tooltips
- **index.ts** - Export centralizat pentru toate chart-urile

### Real-time Features System (/app/components/realtime/)
- **RealtimeProvider.tsx** - Context provider cu polling 30s și WebSocket simulation
- **LiveNotifications.tsx** - Bell icon cu dropdown notificări cu unread badge
- **LiveMetrics.tsx** - KPI metrics live cu trend indicators și animații
- **index.ts** - Export centralizat pentru toate componentele real-time

### PWA Configuration Complete
- **next.config.js** - Configurare completă next-pwa cu service workers
- **public/manifest.json** - PWA manifest cu meta-date și shortcuts
- **public/browserconfig.xml** - Configurare Windows tiles
- **app/layout.tsx** - Meta tags PWA și viewport configuration
- **app/components/PWAProvider.tsx** - Context provider pentru funcții PWA

## 📊 DESIGN SYSTEM ȚINTĂ

### Paleta de Culori
- Primară: #3B82F6 (Blue)
- Secundară: #10B981 (Green)
- Warning: #F59E0B (Amber)
- Danger: #EF4444 (Red)
- Background: #F8FAFC (Gray-50)
- Cards: rgba(255, 255, 255, 0.9) cu backdrop-blur(12px)

### Componente Glassmorphism
- Cards interactive cu hover effects
- Sidebar collapsible cu animații smooth
- Modal overlays cu backdrop blur
- Loading states cu skeleton placeholders

## 🔧 INSTRUCȚIUNI DEZVOLTARE

### Header Obligatoriu pentru Cod Nou
```
// CALEA: [path complet]
// DATA: [data.luna.an ora:minute] (ora României)
// DESCRIERE: [ce face codul]
```

### Tracking Progres
- După fiecare cod important: actualizare CLAUDE.md
- Solicitare aprobare înainte de continuare
- Focus pe cod nou, nu modificări la cod existent
- Citire autonomă a codurilor existente pentru referințe

## 📦 DEPENDENȚE INSTALATE

### UI/UX Moderne
- ✅ `@radix-ui/react-toast` - Toast-uri avansate cu animații
- ✅ `@radix-ui/react-alert-dialog` - Dialoguri moderne și accesibile
- ✅ `react-beautiful-dnd` - Drag & drop pentru Gantt
- ✅ `framer-motion` - Animații avansate (era deja instalat)

### PWA Support
- ✅ `next-pwa` - Progressive Web App support
- ✅ `workbox-webpack-plugin` - Service worker management

### Charts Avansate
- ✅ `victory` - Library grafice interactive avansate
- ✅ `@nivo/core` + `@nivo/calendar` - Grafice specializate

### Real-time Updates (implementat cu polling)
- ✅ `pusher-js` - WebSocket real-time communication (instalat pentru viitor)
- ✅ `@vercel/edge-config` - Edge configuration pentru Vercel
- ✅ Sistem polling implementat cu 30s refresh pentru demo

## 📈 METRICI DE SUCCES

### Performance Targets
- Dashboard load time: < 2 secunde
- Real-time updates: < 500ms latency
- Mobile responsiveness: 100% compatibility
- Accessibility: WCAG 2.1 AA compliance
- PWA support: Service workers, offline capability

### Business Targets
- Reducere timp acces la informații: 70%
- Creștere productivitate team: 40%
- Îmbunătățire UX satisfaction: 90%+
- Mobile adoption: 60%+ usage pe mobile devices