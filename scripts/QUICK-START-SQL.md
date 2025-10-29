# ⚡ QUICK START: Rulare SQL BigQuery

## 🎯 PROBLEMA REZOLVATĂ

**Eroare**: `Entries in the CLUSTER BY clause must be column names`

**Cauză**: BigQuery nu acceptă clustering pe coloane nullable în această configurație.

**Soluție**: ✅ **Am scos CLUSTER BY complet** - rămâne doar PARTITION BY (suficient pentru optimizare).

---

## 📋 PAȘI RAPIZI (2 minute)

### **1. Deschide BigQuery Console**

Link direct: https://console.cloud.google.com/bigquery?project=hale-mode-464009-i6

### **2. Click "COMPOSE NEW QUERY"**

Butonul albastru din dreapta sus (sau apasă tasta **N**).

### **3. Copiază SQL-ul**

**OPȚIUNEA A** - Versiune simplă (recomandat):
```bash
# Din terminal:
cat scripts/iapp-facturi-emise-create-table-simple.sql
```

**OPȚIUNEA B** - Versiune completă (cu comentarii):
```bash
# Din terminal:
cat scripts/iapp-facturi-emise-create-table.sql
```

Apoi **Ctrl+C** (copiază) → **Lipește în BigQuery Editor**.

### **4. Rulează SQL**

Click **"RUN"** (sau **Ctrl+Enter** / **Cmd+Enter**).

Așteptare: **~2-3 secunde**.

### **5. Verifică Succes**

**Output așteptat**:
```
✅ This statement created a new table named FacturiEmiseANAF_v2
```

**Verificare rapidă**:
```sql
SELECT COUNT(*) as total FROM `PanouControlUnitar.FacturiEmiseANAF_v2`;
```

Ar trebui să returneze: `total: 0` (tabel gol inițial).

---

## 🔍 SQL-ul FINAL (fără erori)

```sql
CREATE TABLE IF NOT EXISTS `PanouControlUnitar.FacturiEmiseANAF_v2` (
  id STRING NOT NULL,
  id_incarcare STRING,
  id_descarcare STRING,
  cif_client STRING,
  nume_client STRING,
  serie_numar STRING,
  data_factura DATE,
  valoare_totala FLOAT64,
  moneda STRING DEFAULT 'RON',
  curs_valutar FLOAT64,
  data_curs_valutar DATE,
  valoare_ron FLOAT64,
  status_anaf STRING,
  mesaj_anaf STRING,
  trimisa_de STRING,
  tip_document STRING DEFAULT 'FACTURA_EMISA',
  status_procesare STRING DEFAULT 'procesat',
  google_drive_file_id STRING,
  google_drive_folder_id STRING,
  zip_file_id STRING,
  xml_file_id STRING,
  pdf_file_id STRING,
  xml_content STRING,
  factura_generata_id STRING,
  asociere_automata BOOLEAN DEFAULT FALSE,
  asociere_confidence FLOAT64,
  asociere_manual_user_id STRING,
  data_preluare TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  data_procesare TIMESTAMP,
  data_asociere TIMESTAMP,
  data_incarcare_anaf TIMESTAMP,
  activ BOOLEAN DEFAULT TRUE,
  observatii STRING
)
PARTITION BY DATE(data_preluare);
```

**CE AM SCHIMBAT**:
- ❌ **Scos**: `CLUSTER BY (cif_client, status_anaf, factura_generata_id)`
- ✅ **Păstrat**: `PARTITION BY DATE(data_preluare)` (suficient pentru optimizare)

---

## ✅ CHECKLIST

- [ ] BigQuery Console deschis
- [ ] SQL copiat
- [ ] SQL lipat în editor
- [ ] Click "RUN"
- [ ] Mesaj succes: "created a new table"
- [ ] Verificare: `SELECT COUNT(*) FROM ...` = 0

---

## 🚀 DUPĂ SQL

Rulează test sincronizare:

```bash
curl -X POST https://admin.unitarproiect.eu/api/iapp/facturi-emise/sync \
  -H "Content-Type: application/json" \
  -d '{"zile": 90}'
```

Apoi verifică UI: https://admin.unitarproiect.eu/admin/financiar/facturi-emise

---

**Data**: 29.10.2025 | **Status**: ✅ FIXED | **Autor**: Claude Code
