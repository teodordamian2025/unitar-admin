# 🧪 TEST PLAN: Verificare Fix Polling InvisibleTimerAlert

## ✅ Test 1: ZERO Polling când cronometru oprit

**Pași:**
1. Deschide http://localhost:3000/admin (fără login)
2. Verifică Network tab în DevTools
3. Filtrează `/api/analytics/live-timer`
4. **AȘTEPTAT**: UN SINGUR request la mount
5. **AȘTEPTAT**: ZERO requests suplimentare în următoarele 2-3 minute

**Status console așteptat:**
```
🛑 InvisibleTimerAlert: NO active session → NO polling
```

---

## ✅ Test 2: Polling pornește când cronometru activ

**Pași:**
1. Login la aplicație
2. Pornește cronometru din /admin/analytics/live sau /time-tracking
3. Verifică Network tab
4. **AȘTEPTAT**: Polling la 60s pentru timerSync
5. **AȘTEPTAT**: Polling la 2min pentru InvisibleTimerAlert (DOAR când activ)

**Status console așteptat:**
```
✅ InvisibleTimerAlert: Active session detected → START polling (2min interval)
```

---

## ✅ Test 3: Polling se oprește când cronometru oprit

**Pași:**
1. Cu cronometru activ (din Test 2)
2. Oprește cronometrul
3. Verifică Network tab în următoarele 3 minute
4. **AȘTEPTAT**: ZERO requests la `/api/analytics/live-timer` după oprire

**Status console așteptat:**
```
🛑 InvisibleTimerAlert: Clearing polling interval
🛑 InvisibleTimerAlert: NO active session → NO polling
```

---

## ✅ Test 4: Buton manual verificare funcționează

**Pași:**
1. Fără cronometru activ
2. Dacă există alertă InvisibleTimerAlert vizibilă
3. Click pe butonul "🔄" (refresh manual)
4. **AȘTEPTAT**: UN SINGUR request manual
5. **AȘTEPTAT**: ZERO polling automat după click

---

## 📊 REZULTATE AȘTEPTATE:

### ÎNAINTE (cu bug):
- ❌ Polling continuu la 2 minute CHIAR ȘI când cronometru oprit
- ❌ ~30 requests/oră la `/api/analytics/live-timer` fără cronometru activ

### DUPĂ (cu fix):
- ✅ UN SINGUR request la mount
- ✅ ZERO polling când cronometru oprit
- ✅ Polling la 2min DOAR când cronometru activ
- ✅ Polling se oprește INSTANT la stop cronometru

---

## 🔧 COMENZI VERIFICARE:

### Verificare Network requests (Chrome DevTools):
1. F12 → Network tab
2. Filter: `live-timer`
3. Cronometru timp între requests

### Verificare console logs:
1. F12 → Console tab
2. Filter: `InvisibleTimerAlert`
3. Verifică mesajele de start/stop polling
