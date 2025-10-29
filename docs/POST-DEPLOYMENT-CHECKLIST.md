# ✅ POST-DEPLOYMENT CHECKLIST - Facturi EMISE ANAF

**Data deployment**: 29.10.2025
**Commit**: `6e59122c` - ✨ Feature: Sistem complet Facturi EMISE ANAF prin iapp.ro

---

## 🎉 CE S-A FĂCUT DEJA

### ✅ **1. Tabel BigQuery creat**
- Tabel: `FacturiEmiseANAF_v2`
- Partitioning: `DATE(data_preluare)`
- Status: ✅ **CREAT ȘI GATA**

### ✅ **2. Cod implementat și push-uit la GitHub**
- 📦 13 fișiere noi/modificate
- 🚀 2743 linii de cod adăugate
- 🔧 Zero erori TypeScript
- ✅ **Push la GitHub: SUCCESS**

**Fișiere incluse în commit**:
```
✅ .github/workflows/iapp-facturi-emise-sync.yml  - Cron job
✅ app/admin/financiar/facturi-emise/page.tsx     - UI Dashboard
✅ app/api/iapp/facturi-emise/sync/route.ts       - API Sync
✅ app/api/iapp/facturi-emise/list/route.ts       - API List
✅ app/api/iapp/facturi-emise/cron/route.ts       - API Cron
✅ lib/iapp-facturi-emise.ts                      - Library
✅ app/components/ModernLayout.tsx                - Meniu lateral (modificat)
✅ schema tabele bigquery.csv                     - Schema BD (actualizat)
✅ docs/FACTURI-EMISE-SETUP.md                    - Documentație
✅ scripts/iapp-facturi-emise-create-table.sql    - SQL complet
✅ scripts/iapp-facturi-emise-create-table-simple.sql - SQL simplu
✅ scripts/QUICK-START-SQL.md                     - Ghid SQL
✅ scripts/RULARE-SQL-FACTURI-EMISE.md            - Instrucțiuni SQL
```

### ✅ **3. Link meniu lateral adăugat**
- Locație: `💰 Financiar → 📤 Facturi Emise ANAF`
- Icon: 📤 (outbox - opus la 📥 inbox pentru primite)
- Status: ✅ **ACTIV** (după deployment Vercel)

---

## 🤖 CE SE VA ÎNTÂMPLA AUTOMAT

### **1. GitHub Actions Cron Job** ⏰

**Când?**
- 🕐 **Zilnic la 02:00 GMT** (04:00-05:00 AM România)
- 📅 **Primul run**: Mâine dimineață (30.10.2025, ~04:00 AM)

**Ce face?**
1. Trigger automat `/api/iapp/facturi-emise/sync`
2. Sincronizează ultimele **7 zile** facturi emise
3. Download ZIP-uri în Google Drive
4. Log-uri în GitHub Actions (vezi mai jos)

**Verificare cron activ**:
```
GitHub → Repository → Actions → "iApp Facturi Emise - Sync Zilnic"
```

Ar trebui să vezi:
- ✅ Workflow existent
- 🟢 Status: Enabled
- 📅 Next run: 30.10.2025, 02:00 GMT

**Workflow activare**:
- ✅ **Automat** după push la GitHub (deja făcut)
- ❌ **NU** trebuie să activezi manual nimic

---

## 🔧 CE MAI TREBUIE SĂ FACI (OPȚIONAL)

### **Opțiunea 1: Test Manual Sincronizare** (Recomandat - 3 minute)

Pentru a vedea imediat rezultatele (fără să aștepți până mâine dimineață):

```bash
# Trigger manual sincronizare
curl -X POST https://admin.unitarproiect.eu/api/iapp/facturi-emise/sync \
  -H "Content-Type: application/json" \
  -d '{"zile": 90}'
```

**Output așteptat**:
```json
{
  "success": true,
  "stats": {
    "total_iapp": 36,
    "facturi_noi": 36,
    "facturi_confirmate": 30,
    "facturi_erori_anaf": 1,
    "zips_descarcate": 36
  }
}
```

**Apoi verifică**:
1. **BigQuery**:
   ```sql
   SELECT COUNT(*) FROM `PanouControlUnitar.FacturiEmiseANAF_v2`;
   ```
   → Ar trebui să vezi: ~36 facturi

2. **Google Drive**:
   ```
   Facturi Primite ANAF/Facturi Emise/2025/10/
   ```
   → Ar trebui să vezi: ZIP-uri cu facturi

3. **UI Dashboard**:
   ```
   https://admin.unitarproiect.eu/admin/financiar/facturi-emise
   ```
   → Ar trebui să vezi: Tabel cu facturi + stats

---

### **Opțiunea 2: Trigger Manual Cron GitHub Actions** (Opțional)

Dacă vrei să testezi cron-ul înainte de prima rulare automată:

1. **Mergi la**: https://github.com/teodordamian2025/unitar-admin/actions

2. **Selectează**: "iApp Facturi Emise - Sync Zilnic"

3. **Click**: "Run workflow" (buton dreapta)

4. **Branch**: `main`

5. **Click**: "Run workflow" (verde)

6. **Așteaptă**: ~30 secunde

7. **Verifică logs**: Click pe run-ul nou → Vezi output

---

## 📊 MONITORING & VERIFICARE

### **1. GitHub Actions Logs**

**Locație**: https://github.com/teodordamian2025/unitar-admin/actions/workflows/iapp-facturi-emise-sync.yml

**Ce să cauți**:
```
✅ iApp facturi EMISE sync completed successfully

📈 Stats:
   Facturi noi: X
   Confirmate ANAF: Y
   Erori ANAF: Z
   ZIPs descărcate: W
```

**Dacă sunt erori ANAF**:
```
⚠️  WARNING: 1 facturi cu erori ANAF găsite!
   Verifică în dashboard: https://admin.unitarproiect.eu/admin/financiar/facturi-emise
```

---

### **2. UI Dashboard Stats**

**URL**: https://admin.unitarproiect.eu/admin/financiar/facturi-emise

**Stats cards așteptate**:
- 📊 **Total Facturi**: ~36 facturi (din ultimele luni)
- 💰 **Valoare Totală**: ~XXX,XXX RON
- ✅ **Statusuri ANAF**:
  - 🟢 CONFIRMAT: ~30-35 facturi
  - 🔵 DESCARCAT: ~30-35 facturi
  - 🔴 EROARE: 0-2 facturi (de corectat)
- 🕐 **Ultima Sincronizare**: Astăzi (după test manual) sau mâine (după cron)

---

### **3. BigQuery Verificare**

**Query rapid**:
```sql
-- Vezi ultimele 10 facturi emise
SELECT
  serie_numar,
  nume_client,
  data_factura,
  valoare_totala,
  status_anaf,
  trimisa_de
FROM `PanouControlUnitar.FacturiEmiseANAF_v2`
WHERE activ = TRUE
ORDER BY data_factura DESC
LIMIT 10;
```

---

### **4. Google Drive Verificare**

**Path**: `Facturi Primite ANAF/Facturi Emise/`

**Structură așteptată**:
```
Facturi Emise/
├── 2025/
│   ├── 10/
│   │   ├── UPA001_2025-10-25.zip
│   │   ├── UPA002_2025-10-23.zip
│   │   └── ... (total ~36 ZIP-uri din ultima lună)
│   └── 09/
│       └── ... (facturi din septembrie)
```

**Diferențiere automată**:
- ✅ **Facturi EMISE**: `UPA001_2025-10-25.zip` (serie UPA)
- ✅ **Facturi PRIMITE**: `FURNIZOR_SERIE_DATA.pdf` (nume furnizor)

---

## ⚠️ ALERTE & ACȚIUNI

### **Alertă 1: Facturi cu erori ANAF** 🔴

**Când apare**: După sincronizare, dacă `facturi_erori_anaf > 0`

**Ce să faci**:
1. Verifică în UI: Filtru "Status ANAF" = "⚠ Eroare ANAF"
2. Click icon ℹ️ pentru mesaj detaliat eroare
3. **Exemplu eroare comună**:
   ```
   [BR-CO-10]-Sum of Invoice line net amount (BT-106) = Σ Invoice line net amount (BT-131).
   ```
   → Suma liniilor ≠ Total factură

**Soluție**:
- Corectează factura în soft-ul de facturare
- Re-emite în ANAF
- Factura corectată va apărea ca **nouă** la următoarea sincronizare

---

### **Alertă 2: Cron job failed** ❌

**Când apare**: În GitHub Actions logs, status roșu

**Ce să verifici**:
1. **iapp.ro config activ**:
   ```sql
   SELECT activ FROM `PanouControlUnitar.IappConfig_v2` WHERE activ = TRUE;
   ```

2. **Google Drive token valid**:
   ```sql
   SELECT expires_at FROM `PanouControlUnitar.GoogleDriveTokens`
   WHERE user_email = 'unitarproiect@gmail.com' AND activ = TRUE;
   ```

3. **Vercel/Server online**:
   ```bash
   curl https://admin.unitarproiect.eu/api/iapp/facturi-emise/sync
   ```

---

## 🎯 CHECKLIST FINAL

După deployment + test manual:

- [x] ✅ Tabel BigQuery creat: `FacturiEmiseANAF_v2`
- [x] ✅ Cod push-uit la GitHub: commit `6e59122c`
- [x] ✅ Cron GitHub Actions activ: `.github/workflows/iapp-facturi-emise-sync.yml`
- [ ] ⏳ Test manual sincronizare (opțional, recomandat)
- [ ] ⏳ Verificat facturi în BigQuery
- [ ] ⏳ Verificat ZIP-uri în Google Drive
- [ ] ⏳ Verificat UI dashboard funcțional
- [ ] ⏳ Verificat link meniu lateral vizibil
- [ ] ⏳ Așteptare primul run automat (mâine dimineață 02:00 GMT)

---

## 📞 REFERINȚE UTILE

| Resource | Link/Command |
|----------|--------------|
| **UI Dashboard** | https://admin.unitarproiect.eu/admin/financiar/facturi-emise |
| **GitHub Actions** | https://github.com/teodordamian2025/unitar-admin/actions |
| **Test Sync Manual** | `curl -X POST .../api/iapp/facturi-emise/sync -d '{"zile":90}'` |
| **BigQuery Console** | https://console.cloud.google.com/bigquery?project=hale-mode-464009-i6 |
| **Google Drive** | https://drive.google.com → "Facturi Primite ANAF/Facturi Emise/" |
| **Documentație Setup** | `/docs/FACTURI-EMISE-SETUP.md` |
| **Ghid SQL** | `/scripts/QUICK-START-SQL.md` |

---

## 🎉 NEXT STEPS (Sugestii)

După ce sistemul rulează OK 2-3 zile:

1. **Monitor erori ANAF** săptămânal
2. **Verifică Google Drive space** (36 facturi/lună × 12 luni = ~10 MB/an)
3. **Reconciliere cu FacturiGenerate** (viitor feature opțional):
   - Match by serie + dată
   - Detect facturi generate local dar NU trimise în ANAF

---

**Data document**: 29.10.2025
**Autor**: Claude Code + Teodor Damian
**Status**: 🚀 **PRODUCTION READY - Cron activ după push**

🎊 **Totul e gata! Cron-ul va rula automat zilnic la 02:00 GMT!**
