# INSTRUCȚIUNI: Adăugare Coloană progres_procent în BigQuery

**DATA**: 04.10.2025 21:50 (ora României)
**SCOP**: Adăugare tracking progres 0-100% pentru proiecte și subproiecte

## PASUL 1: Executare Script SQL în BigQuery Console

1. **Accesează BigQuery Console**: https://console.cloud.google.com/bigquery?project=hale-mode-464009-i6

2. **Deschide SQL Editor**

3. **Copiază și rulează scriptul** din fișierul `add-progres-column.sql`:

```sql
-- 1. Adăugare coloană în Proiecte_v2
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.Proiecte_v2`
ADD COLUMN IF NOT EXISTS progres_procent INT64;

-- 2. Adăugare coloană în Subproiecte_v2
ALTER TABLE `hale-mode-464009-i6.PanouControlUnitar.Subproiecte_v2`
ADD COLUMN IF NOT EXISTS progres_procent INT64;

-- 3. Setare valoare default 0 pentru înregistrările existente în Proiecte_v2
UPDATE `hale-mode-464009-i6.PanouControlUnitar.Proiecte_v2`
SET progres_procent = 0
WHERE progres_procent IS NULL;

-- 4. Setare valoare default 0 pentru înregistrările existente în Subproiecte_v2
UPDATE `hale-mode-464009-i6.PanouControlUnitar.Subproiecte_v2`
SET progres_procent = 0
WHERE progres_procent IS NULL;
```

4. **Verifică rezultatul** cu query-urile de verificare:

```sql
-- Verificare coloană adăugată în Proiecte_v2
SELECT column_name, data_type, is_nullable
FROM `hale-mode-464009-i6.PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'Proiecte_v2' AND column_name = 'progres_procent';

-- Verificare coloană adăugată în Subproiecte_v2
SELECT column_name, data_type, is_nullable
FROM `hale-mode-464009-i6.PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'Subproiecte_v2' AND column_name = 'progres_procent';

-- Verificare date actualizate în Proiecte_v2
SELECT ID_Proiect, Denumire, progres_procent
FROM `hale-mode-464009-i6.PanouControlUnitar.Proiecte_v2`
LIMIT 5;

-- Verificare date actualizate în Subproiecte_v2
SELECT ID_Subproiect, Denumire, progres_procent
FROM `hale-mode-464009-i6.PanouControlUnitar.Subproiecte_v2`
LIMIT 5;
```

## PASUL 2: Verificare Funcționalitate în Localhost

După executarea scriptului SQL:

1. **Accesează aplicația**: http://localhost:3001/admin/rapoarte/proiecte

2. **Deschide un proiect** și testează:
   - **Pentru proiecte FĂRĂ subproiecte**: Câmpul progres trebuie să fie editabil manual (0-100%)
   - **Pentru proiecte CU subproiecte**: Câmpul progres trebuie să fie disabled (se calculează automat)

3. **Editează progresul unui subproiect**:
   - Introdu o valoare între 0-100
   - Verifică că se actualizează în BigQuery
   - Verifică că progresul proiectului părinte se recalculează automat (media subproiectelor)

## PASUL 3: Testare Scenarii

### Scenariu 1: Proiect fără subproiecte
- **Operație**: Editează manual progres proiect la 50%
- **Așteptat**: Salvare reușită, progres afișat corect

### Scenariu 2: Proiect cu subproiecte
- **Operație**: Încearcă să editezi manual progres proiect
- **Așteptat**: Câmp disabled + mesaj "Se calculează automat din subproiecte"

### Scenariu 3: Actualizare progres subproiect
- **Operație**: Editează progres subproiect 1 la 30%, subproiect 2 la 70%
- **Așteptat**:
  - Progres subproiecte salvat corect
  - Progres proiect recalculat automat la 50% (media: (30+70)/2)
  - Toast notification cu valoarea recalculată

### Scenariu 4: Validare 0-100
- **Operație**: Încearcă să introduci valoare -10 sau 150
- **Așteptat**: Validare automată la 0 sau 100 (min/max)

## REZULTAT AȘTEPTAT

✅ **UI Modern**:
- Câmp progres proiect cu input + progress bar + procent
- Câmpuri progres subproiecte în grid (4 coloane: Denumire, Predare, Contract, Progres)
- Culori dinamice pentru progress bar (roșu < 30%, galben 30-70%, verde > 70%)

✅ **Logică Automată**:
- Proiecte fără subproiecte: editare manuală
- Proiecte cu subproiecte: calcul automat din media subproiectelor
- Validare 0-100% pentru toate inputurile

✅ **Sincronizare Bidirectională**:
- Frontend → BigQuery (UPDATE proiecte/subproiecte)
- BigQuery → Frontend (recalculare automată și refresh state local)

## STRUCTURĂ MODIFICĂRI

### Backend:
- ✅ `/scripts/add-progres-column.sql` - DDL BigQuery
- ✅ `/app/api/rapoarte/subproiecte/[id]/route.ts` - API UPDATE subproiect + recalculare proiect
- ✅ `/app/api/rapoarte/proiecte/[id]/route.ts` - API UPDATE proiect cu validare subproiecte

### Frontend:
- ✅ `/app/admin/rapoarte/proiecte/[id]/page.tsx` - Interfaces, handlers, UI components

## TROUBLESHOOTING

**Eroare: "progres_procent column not found"**
- Soluție: Rulează din nou scriptul SQL ADD COLUMN din PASUL 1

**Progresul proiectului nu se recalculează automat**
- Verifică: API-ul `/api/rapoarte/subproiecte/[id]` returnează `progres_proiect` în response
- Verifică: Handler-ul `handleSubproiectProgresUpdate` actualizează state-ul local

**Câmpul progres proiect nu e disabled pentru proiecte cu subproiecte**
- Verifică: `subproiecte.length > 0` în condiția `disabled` din input
- Verifică: `fetchSubproiecte()` este apelat în `useEffect` la încărcarea paginii

---

**ULTIMA ACTUALIZARE**: 04.10.2025 22:00 (ora României)
**STATUS**: Pregătit pentru testare în localhost după executare script SQL BigQuery
