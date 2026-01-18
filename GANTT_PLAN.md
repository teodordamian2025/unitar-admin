# PLAN IMPLEMENTARE GANTT AVANSAT + ALOCARE RESURSE

**DATA START**: 18.01.2026
**STATUS**: IN PROGRESS
**ULTIMA ACTUALIZARE**: 18.01.2026

---

## BUG CRITIC IDENTIFICAT - JOIN MULTIPLICATION

### Problema
În `/app/api/analytics/gantt-data/route.ts`, query-ul pentru proiecte și subproiecte face JOIN cu tabelele de responsabili (`ProiecteResponsabili_v2`, `SubproiecteResponsabili_v2`), ceea ce multiplică rezultatele din `TimeTracking_v2`.

**Exemplu**:
- Proiect cu 12 responsabili
- TimeTracking real: 59 ore
- După JOIN: 59 × 12 = **708 ore** (GREȘIT!)

### Soluția
Calcularea orelor lucrate într-un CTE separat, fără JOIN cu responsabili.

### Fișiere Afectate
- `/app/api/analytics/gantt-data/route.ts` - Liniile 64-150 (proiecte), 184-265 (subproiecte)

---

## FAZA 1: FIX BUG + AFIȘARE TIMP ECONOMIC

### Obiective
1. ✅ Corectare bug JOIN multiplication
2. Adăugare câmpuri noi în răspunsul API:
   - `economicHoursAllocated` - ore alocate economic = (Valoare - Cheltuieli) / Cost_Ora
   - `economicHoursRemaining` - ore rămase economic
   - `economicProgress` - progres economic (%)
3. Afișare în modal "Detalii Sarcină" din Gantt

### Tabele Utilizate
- `TimeTracking_v2`: ore_lucrate, sarcina_id, proiect_id, subproiect_id
- `SetariCosturi_v2`: cost_ora, ore_pe_zi
- `Proiecte_v2`: Valoare_Estimata, valoare_ron
- `ProiecteCheltuieli_v2`: valoare_ron

### Fișiere de Modificat
- `/app/api/analytics/gantt-data/route.ts` - Fix bug + adăugare câmpuri economice
- `/app/admin/analytics/gantt/page.tsx` - Afișare în modal detalii

---

## FAZA 2: DROPDOWN ALOCARE LUCRĂTORI PE ZI

### Obiective
1. Adăugare dropdown în modal Gantt pentru alocare lucrători zilnic
2. UI pentru selectare dată + lucrător
3. Salvare în tabel `PlanificariZilnice_v2` (NOU)

### Tabel Nou: PlanificariZilnice_v2
```sql
CREATE TABLE PanouControlUnitar.PlanificariZilnice_v2 (
  id STRING NOT NULL,
  data_planificare DATE NOT NULL,
  utilizator_uid STRING NOT NULL,
  utilizator_nume STRING NOT NULL,

  -- Referință la ce e planificat
  proiect_id STRING,
  subproiect_id STRING,
  sarcina_id STRING,

  -- Detalii alocare
  ore_planificate NUMERIC(5,2) DEFAULT 8,
  prioritate STRING DEFAULT 'normala',
  observatii STRING,

  -- Metadata
  creat_de STRING,
  creat_de_nume STRING,
  data_creare TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  data_actualizare TIMESTAMP,
  activ BOOL DEFAULT TRUE
)
PARTITION BY data_planificare
CLUSTER BY (utilizator_uid, proiect_id);
```

### API-uri Noi
- `GET /api/planificari-zilnice/list` - Lista planificări pe dată/utilizator
- `POST /api/planificari-zilnice` - Creare alocare
- `PUT /api/planificari-zilnice/[id]` - Update alocare
- `DELETE /api/planificari-zilnice/[id]` - Ștergere alocare

### Fișiere de Creat
- `/app/api/planificari-zilnice/route.ts`
- `/app/api/planificari-zilnice/[id]/route.ts`
- `/scripts/planificari-zilnice-create-table.sql`

### Fișiere de Modificat
- `/app/admin/analytics/gantt/page.tsx` - Adăugare dropdown în modal

---

## FAZA 3: SYNC AUTOMAT GANTT → PLANIFICATOR PERSONAL

### Obiective
1. Când se face alocare din Gantt (Faza 2), se creează automat entry în `PlanificatorPersonal_v2`
2. Sincronizare bidirecțională (opțional)

### Tabel Existent: PlanificatorPersonal_v2
- `id`, `utilizator_uid`, `tip_item`, `item_id`, `ordine_pozitie`
- `is_pinned`, `pin_timestamp_start`, `pin_timestamp_stop`, `pin_total_seconds`

### Logic Sync
```typescript
// După creare PlanificariZilnice:
await createPlanificatorEntry({
  utilizator_uid: allocation.utilizator_uid,
  tip_item: allocation.sarcina_id ? 'sarcina' : allocation.subproiect_id ? 'subproiect' : 'proiect',
  item_id: allocation.sarcina_id || allocation.subproiect_id || allocation.proiect_id,
  ordine_pozitie: nextPosition,
  comentariu_personal: `Planificat pentru ${formatDate(allocation.data_planificare)}`
});
```

### Fișiere de Modificat
- `/app/api/planificari-zilnice/route.ts` - Adăugare sync la POST

---

## FAZA 4: PAGINĂ VIZUALIZARE PLANNING TOȚI UTILIZATORII

### Obiective
1. Pagină nouă: `/admin/analytics/planning-overview`
2. View calendar cu toți utilizatorii pe orizontală, zile pe verticală
3. Cod culori pentru alocare (supraalocare = roșu, subalocare = verde)
4. Filtre: perioadă, proiect, echipă

### Componente
- Tabel grid: utilizatori × zile
- Celule cu ore planificate + culoare indicator
- Click pe celulă = modal detalii + editare
- Export Excel/PDF

### Fișiere de Creat
- `/app/admin/analytics/planning-overview/page.tsx`
- `/app/api/analytics/planning-overview/route.ts`

---

## STRUCTURĂ FIȘIERE FINALE

```
app/
├── api/
│   ├── analytics/
│   │   ├── gantt-data/route.ts         # ✅ FIX BUG + câmpuri economice
│   │   └── planning-overview/route.ts  # NOU - Faza 4
│   └── planificari-zilnice/
│       ├── route.ts                    # NOU - Faza 2
│       └── [id]/route.ts               # NOU - Faza 2
├── admin/
│   └── analytics/
│       ├── gantt/page.tsx              # ✅ MOD - Faza 1,2
│       └── planning-overview/page.tsx  # NOU - Faza 4
└── scripts/
    └── planificari-zilnice-create-table.sql  # NOU - Faza 2
```

---

## PROGRES

| Fază | Status | Data Start | Data Finish |
|------|--------|------------|-------------|
| Bug Fix JOIN | 🔄 In Progress | 18.01.2026 | - |
| Faza 1 | ⏳ Pending | - | - |
| Faza 2 | ⏳ Pending | - | - |
| Faza 3 | ⏳ Pending | - | - |
| Faza 4 | ⏳ Pending | - | - |

---

## NOTE IMPORTANTE

### BigQuery Date Fields
- Returnează obiecte `{value: "2025-08-16"}`, nu string-uri
- Accesare: `row.Data_Start?.value || row.Data_Start`

### Tabele V2
- Toate tabelele folosesc sufixul `_v2`
- Partitioning + clustering activat

### Formule Economice
```
Ore Alocate Economic = (Valoare_Proiect - Total_Cheltuieli) / Cost_Ora
Ore Rămase Economic = Ore_Alocate_Economic - Ore_Lucrate
Progres Economic (%) = (Ore_Lucrate / Ore_Alocate_Economic) * 100
```

### Setări Costuri (din SetariCosturi_v2)
- cost_ora: 40 EUR (default)
- cost_zi: 320 EUR (default)
- ore_pe_zi: 8 (default)
