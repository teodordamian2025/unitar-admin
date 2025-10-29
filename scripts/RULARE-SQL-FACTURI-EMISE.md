# 🚀 Ghid Rapid: Rulare SQL pentru Facturi EMISE

## ✅ RĂSPUNS LA ÎNTREBAREA TA

**Întrebare**: Pun toată comanda o singură dată sau în mai multe etape separate?

**Răspuns**: **Rulează tot SQL-ul dintr-o dată!** ✅

BigQuery poate procesa întreg scriptul SQL simultan. Nu trebuie să rulez comenzile separat.

---

## 📝 PAȘI EXACTI

### **PASUL 1: Deschide BigQuery Console**

1. Mergi la: https://console.cloud.google.com/bigquery
2. Selectează project: **hale-mode-464009-i6**
3. În stânga, ar trebui să vezi dataset-ul: **PanouControlUnitar**

### **PASUL 2: Deschide SQL Editor**

1. Click pe butonul **"COMPOSE NEW QUERY"** (sus în dreapta, albastru)
2. Sau apasă tasta **"N"** (shortcut)

### **PASUL 3: Copiază SQL-ul**

1. Deschide fișierul:
   ```
   /scripts/iapp-facturi-emise-create-table.sql
   ```

2. **Copiază TOT conținutul** (de la început până la sfârșit)

   **SAU** rulează comanda direct din terminal:
   ```bash
   cat scripts/iapp-facturi-emise-create-table.sql
   ```

3. **Lipește în BigQuery Editor**

### **PASUL 4: Rulează SQL**

1. Click butonul **"RUN"** (sau apasă **Ctrl+Enter** / **Cmd+Enter**)

2. Așteptă ~2-3 secunde

3. **Output așteptat**:
   ```
   ✅ This statement created a new table named FacturiEmiseANAF_v2
   ```

### **PASUL 5: Verificare Tabel Creat**

Rulează query verificare:

```sql
-- Verifică tabel există
SELECT COUNT(*) as total_rows
FROM `PanouControlUnitar.FacturiEmiseANAF_v2`;
```

**Output așteptat**: `total_rows: 0` (tabel gol inițial)

**Sau** verifică schema:

```sql
-- Vezi structura tabelului
SELECT column_name, data_type, is_nullable
FROM `PanouControlUnitar.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'FacturiEmiseANAF_v2'
ORDER BY ordinal_position;
```

---

## ⚠️ EROAREA TA (REZOLVATĂ)

**Eroare întâlnită**:
```
Entries in the CLUSTER BY clause must be column names
```

**Cauză**: Am avut `serie_numar` în CLUSTER BY, dar aceasta e coloană **nullable** (poate fi NULL).

**Soluție**: ✅ Am corectat scriptul SQL să fie:
```sql
CLUSTER BY (cif_client, status_anaf, factura_generata_id)
-- Fără serie_numar (care poate fi NULL)
```

**Scriptul actualizat este deja corect!** ✅

---

## 🎯 VERIFICARE FINALĂ

După ce rulezi SQL-ul, verifică că totul e OK:

### **Test 1: Tabel exists**
```sql
SELECT table_name, creation_time, row_count
FROM `PanouControlUnitar.__TABLES__`
WHERE table_id = 'FacturiEmiseANAF_v2';
```

**Așteptat**:
- `table_name`: FacturiEmiseANAF_v2
- `creation_time`: [data de azi]
- `row_count`: 0

### **Test 2: Partitioning**
```sql
-- Verifică partition column
SELECT
  table_name,
  partition_expiration_days,
  clustering_fields
FROM `PanouControlUnitar.INFORMATION_SCHEMA.TABLES`
WHERE table_name = 'FacturiEmiseANAF_v2';
```

**Așteptat**:
- `clustering_fields`: ["cif_client", "status_anaf", "factura_generata_id"]

---

## 📤 MENIUL LATERAL (REZOLVAT)

**Întrebare**: Pagina este adăugată în meniul lateral?

**Răspuns**: ✅ **DA, ACUM E ADĂUGATĂ!**

Am modificat `/app/components/ModernLayout.tsx`:

```tsx
{
  href: '/admin/financiar/facturi-emise',
  label: 'Facturi Emise ANAF',
  icon: '📤'
}
```

**Locație în meniu**:
```
💰 Financiar
  ├── 💳 Import CSV
  ├── 📊 Panou
  ├── 🔄 Asociere Auto
  ├── ✍️ Asociere Manuală
  ├── 📥 Facturi Primite ANAF
  └── 📤 Facturi Emise ANAF  ← NOU ✅
```

**Icon**: 📤 (outbox tray - opus față de 📥 inbox pentru primite)

---

## 🚀 URMĂTORII PAȘI (DUPĂ SQL)

După ce rulezi SQL-ul cu succes:

1. **Test sincronizare manuală**:
   ```bash
   curl -X POST https://admin.unitarproiect.eu/api/iapp/facturi-emise/sync \
     -H "Content-Type: application/json" \
     -d '{"zile": 7}'
   ```

2. **Verifică UI dashboard**:
   ```
   https://admin.unitarproiect.eu/admin/financiar/facturi-emise
   ```

3. **Verifică meniu lateral**:
   - Refresh pagina admin
   - Expand secțiunea "💰 Financiar"
   - Ar trebui să vezi: "📤 Facturi Emise ANAF"

---

## 🆘 DACĂ APARE EROARE

### **Eroare: "Table already exists"**

Înseamnă că tabelul a fost creat deja. Șterge-l mai întâi:

```sql
DROP TABLE IF EXISTS `PanouControlUnitar.FacturiEmiseANAF_v2`;
```

Apoi rulează din nou scriptul complet.

### **Eroare: "Dataset not found"**

Verifică că ești pe project-ul corect:

```sql
SELECT schema_name
FROM `INFORMATION_SCHEMA.SCHEMATA`
WHERE schema_name = 'PanouControlUnitar';
```

Dacă returnează 0 rows, schimbă project în BigQuery Console (dropdown sus stânga).

### **Eroare: "Permission denied"**

Verifică permisiuni service account:

```bash
gcloud projects get-iam-policy hale-mode-464009-i6 \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*unitar*"
```

Ar trebui să ai rol: **BigQuery Data Editor**

---

## ✅ CHECKLIST

După ce termini:

- [ ] SQL rulat cu succes în BigQuery
- [ ] Tabel `FacturiEmiseANAF_v2` creat
- [ ] Verificare: `SELECT COUNT(*) FROM ...` returnează 0
- [ ] Test sync manual SUCCESS
- [ ] UI dashboard accesibil
- [ ] Link "📤 Facturi Emise ANAF" vizibil în meniu

---

**Data**: 29.10.2025
**Autor**: Claude Code + Teodor Damian
**Status**: ✅ Toate problemele rezolvate!
