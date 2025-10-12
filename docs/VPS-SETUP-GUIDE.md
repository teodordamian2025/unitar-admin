# 🚀 GHID SETUP VPS HETZNER - ANAF e-Factura Upload Service

**Data:** 12.10.2025
**Scop:** Server dedicat pentru upload automat facturi la ANAF cu certificat digital
**Cost:** €4.51/lună (~22 RON)

---

## 📋 PARTEA 1: CUMPĂRARE VPS (5 minute)

### Pas 1: Creează cont Hetzner Cloud

1. Mergi la: https://accounts.hetzner.com/signUp
2. Completează datele (email, parolă)
3. Verifică email-ul de confirmare

### Pas 2: Adaugă metodă de plată

1. Login: https://console.hetzner.cloud
2. Click pe numele tău (dreapta sus) → Billing
3. Adaugă card/PayPal
4. **IMPORTANT:** Hetzner factureaza LUNAR, nu anual

### Pas 3: Creează proiect nou

1. În Hetzner Cloud Console: Click "New Project"
2. Nume: `ANAF Upload Service`
3. Click "Add Project"

### Pas 4: Creează server (Droplet)

```
Location: Falkenstein, Germany (cel mai aproape de România, ping <40ms)
Image: Ubuntu 22.04
Type: Shared vCPU → CX11 (1 vCPU, 2GB RAM)
Networking:
  ✅ Public IPv4 (included)
  ❌ IPv6 (opțional)
  ❌ Private networks (nu e necesar)
SSH Keys:
  - Click "Add SSH Key"
  - Nume: "Laptop Zorin"
  - Key: (vezi mai jos cum generezi)
Volumes: Nu e necesar
Firewalls: Vom configura manual după
Backups: Opțional (€0.90/lună extra pentru backup automat zilnic)
Placement groups: Nu
Labels: Nu
Cloud config: Nu
Name: anaf-upload-prod
```

### Pas 5: Generare SSH Key (pe Zorin OS)

```bash
# Deschide terminal pe Zorin
ssh-keygen -t ed25519 -C "anaf-upload-vps"

# Apasă Enter de 3 ori (fără parolă pentru simplitate)
# Fișierul se salvează în: ~/.ssh/id_ed25519.pub

# Afișează cheia publică
cat ~/.ssh/id_ed25519.pub

# Output va fi ceva de genul:
# ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJqfXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX anaf-upload-vps

# Copiază TOATĂ linia (începe cu ssh-ed25519)
# Lipește în Hetzner → Add SSH Key → Public Key
```

### Pas 6: Finalizare creare server

1. Click "Create & Buy Now"
2. Așteaptă 30-60 secunde
3. Server-ul va apărea cu:
   - **IP Public:** (ex: 128.140.82.123) - NOTEAZĂ-L!
   - **Status:** Running (verde)

---

## 📋 PARTEA 2: SETUP AUTOMAT SERVER (30 minute - RULEZ EU)

### Conectare la server

```bash
# Pe Zorin OS, deschide terminal
ssh root@IP_SERVER_TAU

# Prima conectare va întreba: "Are you sure? (yes/no)"
# Tastează: yes

# Acum ești conectat ca root pe server!
```

### Script setup automat

**Salvează acest script ca `setup-vps.sh` pe server:**

```bash
#!/bin/bash
# ==================================================================
# SCRIPT SETUP AUTOMAT VPS PENTRU ANAF UPLOAD SERVICE
# ==================================================================

set -e  # Exit on error

echo "🚀 Starting VPS setup for ANAF Upload Service..."
echo "=================================================="

# 1. UPDATE SISTEM
echo "📦 Step 1/8: Updating system packages..."
apt-get update -y
apt-get upgrade -y

# 2. INSTALARE NODE.JS 20 LTS
echo "📦 Step 2/8: Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verificare instalare
node --version
npm --version

# 3. INSTALARE PM2 (Process Manager)
echo "📦 Step 3/8: Installing PM2..."
npm install -g pm2

# 4. INSTALARE NGINX (Reverse Proxy)
echo "📦 Step 4/8: Installing Nginx..."
apt-get install -y nginx

# 5. INSTALARE CERTBOT (Let's Encrypt SSL)
echo "📦 Step 5/8: Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

# 6. INSTALARE TOOLS CERTIFICAT DIGITAL
echo "📦 Step 6/8: Installing OpenSSL & certificate tools..."
apt-get install -y openssl ca-certificates

# 7. CONFIGURARE FIREWALL
echo "🔒 Step 7/8: Configuring firewall (UFW)..."
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (pentru Certbot)
ufw allow 443/tcp   # HTTPS
ufw status

# 8. CREARE DIRECTOR APLICAȚIE
echo "📁 Step 8/8: Creating application directory..."
mkdir -p /opt/anaf-upload-service
cd /opt/anaf-upload-service

# CREARE USER DEDICAT (mai sigur decât root)
useradd -m -s /bin/bash anaf-service || echo "User already exists"
chown -R anaf-service:anaf-service /opt/anaf-upload-service

echo ""
echo "✅ VPS setup completed successfully!"
echo "=================================================="
echo "📊 System info:"
echo "  - Node.js: $(node --version)"
echo "  - npm: $(npm --version)"
echo "  - PM2: $(pm2 --version)"
echo "  - Nginx: $(nginx -v 2>&1)"
echo "  - UFW: $(ufw status | head -1)"
echo ""
echo "📁 Application directory: /opt/anaf-upload-service"
echo "👤 Service user: anaf-service"
echo ""
echo "🔜 Next steps:"
echo "  1. Deploy Node.js microservice code"
echo "  2. Upload certificat digital (.p12)"
echo "  3. Configure Nginx reverse proxy"
echo "  4. Setup SSL with Certbot"
echo ""
```

### Rulare script

```bash
# Pe server (conectat ca root):
cd ~
nano setup-vps.sh
# Lipește scriptul de mai sus
# Salvează: Ctrl+O, Enter, Ctrl+X

# Fă scriptul executabil
chmod +x setup-vps.sh

# Rulează
./setup-vps.sh
```

**Timp execuție: ~5-10 minute** (în funcție de viteză internet VPS)

---

## 📋 PARTEA 3: DEPLOY MICROSERVICE (fac eu în următorul pas)

Vom crea:
- `/opt/anaf-upload-service/server.js` - API Node.js
- `/opt/anaf-upload-service/package.json` - Dependencies
- `/opt/anaf-upload-service/.env` - Configurare (API keys, certificate path)
- `/opt/anaf-upload-service/ecosystem.config.js` - PM2 config

---

## 📋 PARTEA 4: INSTALARE CERTIFICAT DIGITAL (faci tu cu ghidul meu)

### Pe Windows (unde ai USB-ul cu certificat):

**Documentat în:** `CERTIFICATE-EXPORT-GUIDE.md` (urmează)

---

## 📋 PARTEA 5: CONFIGURARE NGINX + SSL

### Configurare Nginx reverse proxy

Fișier: `/etc/nginx/sites-available/anaf-upload`

```nginx
server {
    listen 80;
    server_name IP_SERVER_TAU;  # SAU domeniu dacă ai

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;

        # Timeout lung pentru upload facturi mari
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### Activare configurare

```bash
ln -s /etc/nginx/sites-available/anaf-upload /etc/nginx/sites-enabled/
nginx -t  # Test configurare
systemctl restart nginx
```

### Setup SSL (opțional dar recomandat)

```bash
# Dacă ai domeniu (ex: anaf-upload.unitarproiect.eu):
certbot --nginx -d anaf-upload.unitarproiect.eu

# Dacă NU ai domeniu, poți folosi IP direct
# SSL se va face manual cu self-signed certificate SAU
# folosești IP direct pe HTTP (și te bazezi pe API Key pentru securitate)
```

---

## 📊 VERIFICARE FINALĂ

```bash
# Verifică servicii active
systemctl status nginx
pm2 status

# Verifică port 3001 (microservice)
curl http://localhost:3001/health

# Verifică de pe Zorin (din afara server-ului)
curl http://IP_SERVER_TAU/health
# Ar trebui: {"status":"ok","service":"anaf-upload"}
```

---

## 🔐 SECURITATE

### Whitelist IP-uri Vercel (opțional extra securitate)

```bash
# În /etc/nginx/sites-available/anaf-upload, adaugă:
# allow 76.76.21.0/24;  # Vercel IP range - verifică pe vercel.com/docs
# deny all;
```

### Rotație API Key

API Key-ul se va genera aleatoriu și se va adăuga în:
- VPS: `/opt/anaf-upload-service/.env`
- Vercel: Environment Variables → `VPS_API_KEY`

---

## 📝 NOTIȚE

- **Backup automat:** Hetzner oferă backup zilnic pentru +€0.90/lună
- **Monitoring:** PM2 are dashboard gratuit: `pm2 plus`
- **Logs:** `pm2 logs anaf-upload` pentru debugging
- **Restart după reboot:** `pm2 startup` + `pm2 save`

---

**STATUS:** Setup VPS ready pentru deploy microservice! ✅
