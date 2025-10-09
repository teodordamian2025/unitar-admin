# BigQuery Schema Reference - Tabele _v2

**Data:** 09.10.2025
**Scop:** Referință rapidă pentru evitarea erorilor de naming în JOIN-uri

## ⚠️ ATENȚIE: Naming Conventions Inconsistente

### **Proiecte_v2** - ID cu underscore
```sql
- ID_Proiect (STRING) -- ⚠️ NU "id"!
- Denumire (STRING)    -- ⚠️ NU "Denumire_Proiect"!
- Client (STRING)
- Data_Start (DATE)
- Data_Final (DATE)
```

**Exemple JOIN corecte:**
```sql
LEFT JOIN Proiecte_v2 p ON ch.proiect_id = p.ID_Proiect
SELECT p.Denumire AS proiect_denumire  -- NU p.Denumire_Proiect
```

### **Subproiecte_v2** - ID cu underscore
```sql
- ID_Subproiect (STRING) -- ⚠️ NU "id"!
- ID_Proiect (STRING)
- Denumire (STRING)      -- ✅ Consistent cu Proiecte_v2
- Responsabil (STRING)
```

**Exemple JOIN corecte:**
```sql
LEFT JOIN Subproiecte_v2 sp ON ch.subproiect_id = sp.ID_Subproiect
SELECT sp.Denumire AS subproiect_denumire
```

### **ProiecteCheltuieli_v2** - lowercase id
```sql
- id (STRING)            -- ✅ lowercase, consistent cu alte tabele _v2
- proiect_id (STRING)
- subproiect_id (STRING)
- furnizor_cui (STRING)
- valoare_ron (NUMERIC)
```

**Exemple JOIN corecte:**
```sql
LEFT JOIN ProiecteCheltuieli_v2 ch ON f.cheltuiala_asociata_id = ch.id
```

## ✅ Pattern Corect pentru JOIN-uri Triple

```sql
SELECT
  ch.id,
  ch.proiect_id,
  ch.subproiect_id,
  p.Denumire AS proiect_denumire,      -- ⚠️ NU Denumire_Proiect
  sp.Denumire AS subproiect_denumire
FROM ProiecteCheltuieli_v2 ch
LEFT JOIN Proiecte_v2 p
  ON ch.proiect_id = p.ID_Proiect      -- ⚠️ NU p.id
LEFT JOIN Subproiecte_v2 sp
  ON ch.subproiect_id = sp.ID_Subproiect  -- ⚠️ NU sp.id
WHERE ch.activ = TRUE
```

## 🚫 Erori Comune (EVITĂ)

### ❌ Greșit:
```sql
-- Eroare: "Name id not found inside p"
LEFT JOIN Proiecte_v2 p ON ch.proiect_id = p.id

-- Eroare: "Name Denumire_Proiect not found inside p"
SELECT p.Denumire_Proiect AS proiect_denumire

-- Eroare: Ambiguitate când folosești SELECT *
SELECT ch.* FROM ... LEFT JOIN Proiecte_v2 p ...
```

### ✅ Corect:
```sql
LEFT JOIN Proiecte_v2 p ON ch.proiect_id = p.ID_Proiect
SELECT p.Denumire AS proiect_denumire
SELECT ch.id, ch.proiect_id, ...  -- Lista explicită
```

## 📊 Alte Tabele _v2 Importante

### **FacturiPrimiteANAF_v2**
```sql
- id (STRING)
- cheltuiala_asociata_id (STRING) -- FK către ProiecteCheltuieli_v2.id
- cif_emitent (STRING)
- serie_numar (STRING)
- valoare_ron (NUMERIC)
```

### **Sarcini_v2**
```sql
- id (STRING)          -- ✅ lowercase
- proiect_id (STRING)
- subproiect_id (STRING)
- titlu (STRING)
```

### **TimeTracking_v2**
```sql
- id (STRING)          -- ✅ lowercase
- proiect_id (STRING)
- sarcina_id (STRING)
- ore_lucrate (NUMERIC)
```

## 🔍 Cum să Verifici Schema

```bash
# În terminal local:
grep "^TableName_v2," schema\ tabele\ bigquery.csv | head -20

# În BigQuery Console:
SELECT column_name, data_type
FROM `PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'Proiecte_v2'
ORDER BY ordinal_position
```

## 📝 Checklist Înainte de Deploy

- [ ] Toate JOIN-urile folosesc numele corecte: `ID_Proiect`, `ID_Subproiect`
- [ ] Toate SELECT-urile folosesc `p.Denumire` (NU `Denumire_Proiect`)
- [ ] Nu există `SELECT table.*` în query-uri cu JOIN-uri
- [ ] Toate coloanele din SELECT au prefix explicit (`ch.`, `p.`, `sp.`)
- [ ] TypeScript build trece fără erori: `npx tsc --noEmit`

---

**Ultima actualizare:** 09.10.2025 (după 3 hotfix-uri consecutive)
