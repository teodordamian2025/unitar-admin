# 📜 GHID EXPORT CERTIFICAT DIGITAL (Windows)

**Scop:** Export certificat digital de pe USB token în format .p12 pentru instalare pe VPS

---

## 🔍 IDENTIFICARE TIP CERTIFICAT

Certificatul tău poate fi în 3 locații:

### **Opțiunea A: USB Token/Smart Card cu software proprietar**
- Ex: SafeNet eToken, Gemalto, SecuGen, CertSign
- **Indiciu:** Ai instalat software special pentru certificat (ex: "SafeNet Authentication Client")

### **Opțiunea B: Certificat importat în Windows Certificate Store**
- Certificatul a fost importat manual în Windows
- **Indiciu:** Îl vezi în `certmgr.msc`

### **Opțiunea C: Certificat în browser (Chrome/Edge)**
- Certificatul e stocat direct în browser
- **Indiciu:** chrome://settings/certificates arată certificatul

---

## 📦 OPȚIUNEA A: Export din USB Token cu Software Proprietar

### **Pentru SafeNet eToken (cel mai comun):**

#### Pas 1: Instalează SafeNet Authentication Client
```
1. Inserează USB token
2. Descarcă: https://support.globalsign.com/ssl/ssl-certificates-installation/safenet-drivers
3. Instalează SafeNet Authentication Client
4. Restart Windows
```

#### Pas 2: Export certificat cu SafeNet Tools
```
1. Deschide "SafeNet Authentication Client Tools"
   (Start Menu → SafeNet Authentication Client Tools)

2. Click pe tab "Advanced View"

3. În stânga: Click pe token-ul tău (ar trebui să apară după ce inserezi USB)

4. Right-click pe certificatul firmei → Export → Certificate with private key

5. Alege:
   - Format: PKCS #12 (.p12)
   - Include private key: ✅ DA
   - Parolă export: (alegi ceva SIGUR, ex: "Unitar2025!Export")
   - Confirmă parolă
   - Salvează ca: unitar-anaf-cert.p12

6. VA CERE PIN-ul token-ului USB → introdu PIN-ul

7. Certificatul se exportă în unitar-anaf-cert.p12
```

### **Pentru CertSign Token:**

```
1. Instalează "CertSign cryptoCARD" software
   (de pe site-ul CertSign sau CD-ul primit)

2. Inserează token USB

3. Deschide "CertSign cryptoCARD Manager"

4. Click "Certificate Management" → "Export Certificate"

5. Alege:
   - Certificate: (certificatul firmei cu CUI 35639210)
   - Format: PKCS#12 (.p12)
   - Include Private Key: ✅ YES
   - Export Password: (parolă sigură)

6. Introdu PIN token → Salvează fișierul
```

---

## 📦 OPȚIUNEA B: Export din Windows Certificate Store

### Pas 1: Deschide Certificate Manager

```
1. Win + R → tastează: certmgr.msc
2. Enter
```

### Pas 2: Găsește certificatul

```
1. În stânga: Personal → Certificates
2. Găsește certificatul firmei (ar trebui să conțină "UNITAR PROIECT" sau CUI "35639210")
3. Verifică:
   - Issued To: UNITAR PROIECT SRL (sau similar)
   - Issued By: CertSign (sau alt CA românesc)
   - Expiration Date: (nu e expirat)
```

### Pas 3: Export certificat

```
1. Right-click pe certificat → All Tasks → Export

2. Certificate Export Wizard:
   - Click "Next"

3. Export Private Key:
   - Alege: ✅ "Yes, export the private key"
   - Click "Next"

   ⚠️ IMPORTANT: Dacă opțiunea "export private key" e GRIS (disabled):
      → Certificatul nu poate fi exportat din Windows
      → Revino la OPȚIUNEA A (export din USB token direct)

4. Export File Format:
   - Alege: ✅ "Personal Information Exchange - PKCS #12 (.PFX)"
   - Bifează: ✅ "Include all certificates in the certification path if possible"
   - Bifează: ✅ "Export all extended properties"
   - ❌ NU bifa "Delete the private key if export is successful"
   - Click "Next"

5. Security:
   - Bifează: ✅ "Password"
   - Introdu parolă SIGURĂ (ex: "Unitar2025!Cert")
   - Confirmă parola
   - Encryption: alege "AES256-SHA256"
   - Click "Next"

6. File to Export:
   - Nume fișier: C:\Users\TauNume\Desktop\unitar-anaf-cert.p12
   - Click "Next"

7. Click "Finish"

8. VA APĂREA: "The export was successful"
```

---

## 📦 OPȚIUNEA C: Export din Browser (Chrome/Edge)

### În Chrome/Edge (folosesc același certificate store):

```
1. Deschide Chrome/Edge

2. Accesează: chrome://settings/certificates
   (SAU edge://settings/privacy/manageCertificates)

3. Tab "Your certificates" (Certificatele tale)

4. Găsește certificatul UNITAR PROIECT

5. Click "..." (three dots) → Export

6. Alege:
   - Format: "Personal Information Exchange (.p12)"
   - Include private key: ✅ YES

7. Salvează ca: unitar-anaf-cert.p12

8. Setează parolă export (notează-o!)
```

---

## ✅ VERIFICARE CERTIFICAT EXPORTAT

### Pe Windows, verifică fișierul .p12:

```powershell
# Deschide PowerShell
# Verifică că fișierul există și are mărime >1KB
Get-Item C:\Users\TauNume\Desktop\unitar-anaf-cert.p12 | Select-Object Name, Length

# Output ar trebui:
# Name                        Length
# ----                        ------
# unitar-anaf-cert.p12       4523  (sau alt număr >1000)
```

### Test import certificat (verificare validitate):

```
1. Dublu-click pe unitar-anaf-cert.p12

2. Certificate Import Wizard:
   - Store Location: "Current User"
   - Click "Next"
   - File: (deja completat)
   - Click "Next"
   - Password: (introdu parola setată la export)
   - ✅ Bifează: "Mark this key as exportable"
   - Click "Next"
   - Certificate Store: "Automatically select"
   - Click "Next"
   - Click "Finish"

3. Ar trebui: "The import was successful"

4. ⚠️ IMPORTANTE: Acum ȘTERGE certificatul din Windows
   (pentru că l-ai importat doar pentru test)
   - certmgr.msc → Personal → Certificates
   - Găsește duplicatul (ar trebui să ai 2 acum)
   - Delete duplicatul (cel fără iconița USB token)
```

---

## 📤 UPLOAD CERTIFICAT PE VPS (după ce ai fișierul .p12)

### Metoda 1: SCP (Secure Copy - RECOMANDAT)

```bash
# Pe Zorin OS, în terminal:
cd ~/Desktop  # (sau unde ai salvat certificatul)

# Upload la VPS (înlocuiește IP_SERVER_TAU)
scp unitar-anaf-cert.p12 root@IP_SERVER_TAU:/opt/anaf-upload-service/

# Va cere parola SSH (sau va folosi cheia SSH dacă ai setat)
```

### Metoda 2: Base64 + Copy-Paste (dacă SCP nu funcționează)

**Pe Windows (PowerShell):**
```powershell
# Convertește certificatul în Base64
$bytes = [System.IO.File]::ReadAllBytes("C:\Users\TauNume\Desktop\unitar-anaf-cert.p12")
$base64 = [Convert]::ToBase64String($bytes)
$base64 | Out-File C:\Users\TauNume\Desktop\cert-base64.txt

# Deschide cert-base64.txt și COPIAZĂ tot conținutul
```

**Pe VPS (conectat SSH):**
```bash
# Creează fișier temporar
nano /opt/anaf-upload-service/cert-base64.txt
# Paste conținutul Base64
# Salvează: Ctrl+O, Enter, Ctrl+X

# Decodifică Base64 înapoi în .p12
base64 -d /opt/anaf-upload-service/cert-base64.txt > /opt/anaf-upload-service/unitar-anaf-cert.p12

# Șterge fișierul Base64
rm /opt/anaf-upload-service/cert-base64.txt

# Verifică certificatul
ls -lh /opt/anaf-upload-service/unitar-anaf-cert.p12
```

---

## 🔐 INSTALARE CERTIFICAT PE VPS

```bash
# Conectat SSH ca root pe VPS
cd /opt/anaf-upload-service

# Setează permisiuni sigure (doar root poate citi)
chmod 600 unitar-anaf-cert.p12
chown anaf-service:anaf-service unitar-anaf-cert.p12

# Extrage certificatul și cheia privată din .p12
# (Vom face asta în scriptul microservice-ului Node.js)

# Salvează parola certificatului în .env
echo "CERT_PASSWORD=parola_ta_export" >> .env
chmod 600 .env
```

---

## ⚠️ TROUBLESHOOTING

### Problema: "Export private key" este gri (disabled)

**Cauză:** Certificatul e marcat ca "non-exportable" când a fost importat.

**Soluție:**
1. Revino la sursa originală (USB token)
2. Folosește software-ul token-ului pentru export (Opțiunea A)
3. SAU: Contactează CertSign/emitentul certificatului pentru un duplicat exportabil

### Problema: "The password is incorrect" la import

**Cauză:** Parola setată la export e greșită.

**Soluție:**
1. Reîncearcă export-ul cu o parolă simplă pentru test (ex: "test123")
2. Notează parola într-un fișier separat

### Problema: Certificatul nu apare în certmgr.msc

**Cauză:** Certificatul e doar pe token USB, nu e importat în Windows.

**Soluție:**
1. Folosește software-ul token-ului (SafeNet, CertSign)
2. Export direct din acel software

---

## 📝 CHECKLIST FINAL

- [x] Am identificat tipul certificatului meu (A/B/C)
- [x] Am exportat certificatul în format .p12
- [x] Am setat parolă SIGURĂ pentru .p12
- [x] Am notat parola .p12 (ex: în manager parole)
- [x] Am verificat că fișierul .p12 are >1KB
- [x] Am testat import-ul certificatului (opțional)
- [x] Am uploadat .p12 pe VPS securizat
- [x] Am șters copiile locale ale .p12 (securitate)

---

**GATA! Certificatul este pregătit pentru instalare pe VPS.** ✅

**URMĂTORUL PAS:** Deploy microservice Node.js care va folosi acest certificat.
