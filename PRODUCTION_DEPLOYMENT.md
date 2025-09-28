# PRODUCTION DEPLOYMENT - Firebase Authentication Fix

## Problema Identificată

În production, API-urile planificator returnau erori 401 "Missing authorization token" pentru că Firebase Admin SDK era configurat greșit:

- **Client Firebase Project**: `unitar-admin` (production)
- **Server Firebase Project**: `unitarproiect` (development) ❌

## Soluția Implementată

### 1. Detecție Automată Environment

În `lib/firebase-admin.ts` am implementat detecție automată:

```typescript
const projectId = process.env.NODE_ENV === 'production'
  ? 'unitar-admin'
  : (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'unitarproiect');

const finalProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID || projectId;
```

### 2. Environment Variables pentru Production

Pentru deployment în production, setați:

```bash
# OBLIGATORIU pentru production
NODE_ENV=production
FIREBASE_ADMIN_PROJECT_ID=unitar-admin

# Aceleași ca în development
GOOGLE_CLOUD_PROJECT_ID=hale-mode-464009-i6
GOOGLE_CLOUD_CLIENT_EMAIL=serviceaccount1@hale-mode-464009-i6.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_CLOUD_CLIENT_ID=102403512459610527970
```

### 3. Securitate Production

- În development: fallback la `demo_user_id` pentru testing
- În production: reject complet pentru token-uri invalide (nu fallback)

## APIs Fixate

✅ `/api/planificator/items/[id]/pin/route.ts`
✅ `/api/planificator/hierarchy/subproiect/[subproiect_id]/route.ts`
✅ `/api/analytics/live-pins/route.ts`
✅ `/api/planificator/items/[id]/comentariu/route.ts`
✅ `/api/planificator/items/[id]/realizat/route.ts`
✅ `/api/planificator/route.ts`
✅ `/api/planificator/timer/start/route.ts`
✅ `/api/planificator/reorder/route.ts`
✅ `/api/planificator/notifications/route.ts`

## Problema Subproiect Tasks

BONUS: Fixat și problema cu task-urile de subproiect care nu apăreau:

**ÎNAINTE**: `WHERE s.subproiect_id = @subproiect_id` ❌
**DUPĂ**: `WHERE s.proiect_id = @subproiect_id` ✅

Taskurile din subproiecte folosesc `proiect_id` pentru a referenția subproiectul.

## Verificare Deployment

După deployment, verificați în console logs:
```
🔧 Firebase Admin SDK initializing with project ID: unitar-admin
🔧 Environment: production, Auto-detected: unitar-admin, Final: unitar-admin
✅ Firebase Admin SDK initialized successfully
```

## Testing Production

1. **Live-pins API**: https://admin.unitarproiect.eu/admin/analytics/live
2. **Planificator**: https://admin.unitarproiect.eu/planificator
3. **Subproiect tasks**: Verifică că task "Acoperiș" apare în subproiect SP002

Data implementării: 28.09.2025 19:40 (ora României)