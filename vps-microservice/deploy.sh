#!/bin/bash
# ==================================================================
# SCRIPT DEPLOY MICROSERVICE PE VPS
# ==================================================================

set -e  # Exit on error

echo "🚀 Deploying ANAF Upload Microservice to VPS..."
echo "=================================================="

# Configurare (MODIFICĂ ACESTEA)
VPS_IP="188.34.180.94"
VPS_USER="root"
VPS_PATH="/opt/anaf-upload-service"

# Verificare existență variabile
if [ "$VPS_IP" == "YOUR_VPS_IP_HERE" ]; then
  echo "❌ ERROR: Modifică VPS_IP în script înainte de deploy!"
  exit 1
fi

echo "📦 Step 1/5: Creating deployment package..."
# Creează arhivă cu fișierele necesare
tar -czf anaf-microservice.tar.gz \
  --exclude=node_modules \
  --exclude=logs \
  package.json \
  server.js \
  ecosystem.config.js \
  .env.example

echo "📤 Step 2/5: Uploading to VPS..."
scp anaf-microservice.tar.gz $VPS_USER@$VPS_IP:$VPS_PATH/

echo "🔧 Step 3/5: Installing dependencies on VPS..."
ssh $VPS_USER@$VPS_IP << 'ENDSSH'
cd /opt/anaf-upload-service

# Extract arhivă
tar -xzf anaf-microservice.tar.gz
rm anaf-microservice.tar.gz

# Instalare dependencies
npm install --production

# Creare director logs
mkdir -p logs

# Setare permisiuni
chown -R anaf-service:anaf-service .
ENDSSH

echo "🔄 Step 4/5: Restarting PM2 service..."
ssh $VPS_USER@$VPS_IP << 'ENDSSH'
cd /opt/anaf-upload-service

# Stop old version (dacă există)
pm2 stop anaf-upload || true
pm2 delete anaf-upload || true

# Start new version
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup (va porni automat la reboot)
pm2 startup systemd -u anaf-service --hp /home/anaf-service
ENDSSH

echo "✅ Step 5/5: Verifying deployment..."
sleep 3
ssh $VPS_USER@$VPS_IP << 'ENDSSH'
pm2 status
pm2 logs anaf-upload --lines 20
ENDSSH

# Cleanup local
rm anaf-microservice.tar.gz

echo ""
echo "✅ Deployment completed successfully!"
echo "=================================================="
echo "📊 Service status: pm2 status"
echo "📝 View logs: pm2 logs anaf-upload"
echo "🔄 Restart service: pm2 restart anaf-upload"
echo ""
echo "🧪 Test health endpoint:"
echo "curl http://$VPS_IP:3001/health"
echo ""
