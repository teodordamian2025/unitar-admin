# 🚀 GHID RAPID - Rulare Scripturi BigQuery

## 📝 IMPORTANT: Cum să rulezi scripturile

### ⚠️ Scripturile conțin query-uri COMENTATE cu `/* */`

Pentru a rula un query din script, trebuie să **SCOȚI comentariile** `/*` și `*/`:

#### ❌ GREȘIT (va da eroare):
```sql
/*
SELECT * FROM tabel
WHERE conditie = true;
*/
```

#### ✅ CORECT (funcționează):
```sql
SELECT * FROM tabel
WHERE conditie = true;
```

---

## 📋 SCRIPT 1: fix-smartfintech-status.sql

### PASUL 1: Verificare (SELECT - decomentează)
1. Deschide scriptul `fix-smartfintech-status.sql`
2. Găsește secțiunea **PASUL 1** (linia ~15)
3. **Query-ul este deja NECODENTAT** - copiază direct în BigQuery Console
4. Rulează și verifică câte tranzacții vor fi modificate (~122 expected)

### PASUL 2: Execuție (UPDATE - decomentează)
1. Găsește secțiunea **PASUL 2** (linia ~37)
2. **SCOATE** comentariile `/*` (linia 37) și `*/` (linia 48)
3. Copiază UPDATE-ul decomentated în BigQuery Console
4. Rulează - ar trebui să modifice ~122 rows

### PASUL 3: Verificare (SELECT - decomentează)
1. Găsește secțiunea **PASUL 3** (linia ~55)
2. **SCOATE** comentariile `/*` (linia 55) și `*/` (linia 68)
3. Copiază SELECT-ul decomentated în BigQuery Console
4. Verifică rezultatele - ar trebui să vezi status = 'smartfintech'

---

## 📋 SCRIPT 2: migrate-facturi-simple-to-etape.sql

### PASUL 1: Identificare (SELECT - decomentează)
1. Deschide scriptul `migrate-facturi-simple-to-etape.sql`
2. Găsește secțiunea **PASUL 1** (linia ~15)
3. **Query-ul este deja NECODENTAT** - copiază direct în BigQuery Console
4. Rulează și verifică ce facturi vor fi migrate

### PASUL 2: Execuție (INSERT - decomentează)
1. Găsește secțiunea **PASUL 2** (linia ~39)
2. **SCOATE** comentariile `/*` (linia 39) și `*/` (linia 90)
3. Copiază INSERT-ul decomentated în BigQuery Console
4. Rulează - ar trebui să insereze X rows (număr facturi simple)

### PASUL 3: Verificare (SELECT - decomentează)
1. Găsește secțiunea **PASUL 3** (linia ~98)
2. **SCOATE** comentariile `/*` (linia 98) și `*/` (linia 110)
3. Copiază SELECT-ul decomentated în BigQuery Console
4. Verifică statistici - ar trebui să vezi tip_etapa = 'factura_directa'

---

## 💡 TIPS

### Cum să decomentezi rapid în BigQuery Console:

1. **Copiază tot blocul** (inclusiv `/*` și `*/`)
2. **Lipește în BigQuery Console**
3. **Șterge manual** linia cu `/*` de la început
4. **Șterge manual** linia cu `*/` de la sfârșit
5. **Rulează query-ul**

### Alternativ - Editează în VSCode:

1. Deschide scriptul în VSCode
2. Găsește query-ul dorit
3. Șterge `/*` și `*/`
4. Copiază query-ul decomentated
5. Lipește direct în BigQuery Console

---

## ✅ CHECKLIST RAPID

### Pentru Script 1:
- [ ] PASUL 1: Rulat SELECT verificare → văzut ~122 rows
- [ ] PASUL 2: Decomentated + rulat UPDATE → modified 122 rows
- [ ] PASUL 3: Decomentated + rulat SELECT → văzut status = 'smartfintech'

### Pentru Script 2:
- [ ] PASUL 1: Rulat SELECT identificare → văzut lista facturi simple
- [ ] PASUL 2: Decomentated + rulat INSERT → inserted X rows
- [ ] PASUL 3: Decomentated + rulat SELECT → văzut statistici tip_etapa = 'factura_directa'

---

## 🆘 TROUBLESHOOTING

### Eroare: "Syntax error: Unexpected end of statement"
**Cauză**: Nu ai scos comentariile `/*` și `*/`
**Soluție**: Șterge `/*` de la început și `*/` de la sfârșit

### Eroare: "Table not found"
**Cauză**: Project ID sau dataset name greșit
**Soluție**: Verifică că ești pe proiectul `hale-mode-464009-i6`

### Warning: "Modified 0 rows"
**Cauză**: Query-ul a rulat deja sau condiția WHERE nu găsește date
**Soluție**: Rulează PASUL 1 (verificare) pentru a vedea dacă mai sunt date de modificat

---

**ULTIMA ACTUALIZARE**: 09.11.2025 - Scripturi actualizate cu comentarii clare ✅
