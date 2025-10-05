// CALEA: /lib/notifications/batch-processor.ts
// DATA: 05.10.2025 (ora României)
// DESCRIERE: Smart grouping și batch processing pentru notificări (evită spam)

import type {
  TipNotificare,
  NotificareContext,
  BatchNotification,
  GroupedNotification,
} from './types';

// =====================================================
// BATCH QUEUE MANAGEMENT
// =====================================================

interface QueuedNotification {
  user_id: string;
  tip_notificare: TipNotificare;
  context: NotificareContext;
  timestamp: number;
}

// In-memory queue pentru debouncing (în producție usar Redis/Database)
const notificationQueue: Map<string, QueuedNotification[]> = new Map();
const processingTimers: Map<string, NodeJS.Timeout> = new Map();

const DEBOUNCE_MS = 5000; // 5 secunde wait pentru grouping

// =====================================================
// SMART GROUPING LOGIC
// =====================================================

/**
 * Adaugă notificare în queue cu debouncing pentru smart grouping
 */
export function queueNotification(
  user_id: string,
  tip_notificare: TipNotificare,
  context: NotificareContext,
  processCallback: (grouped: GroupedNotification[]) => Promise<void>
): void {
  const queueKey = `${user_id}:${tip_notificare}`;

  // Adaugă în queue
  if (!notificationQueue.has(queueKey)) {
    notificationQueue.set(queueKey, []);
  }

  notificationQueue.get(queueKey)!.push({
    user_id,
    tip_notificare,
    context,
    timestamp: Date.now(),
  });

  // Clear existing timer
  if (processingTimers.has(queueKey)) {
    clearTimeout(processingTimers.get(queueKey)!);
  }

  // Set new timer pentru processing
  const timer = setTimeout(async () => {
    const queued = notificationQueue.get(queueKey) || [];
    notificationQueue.delete(queueKey);
    processingTimers.delete(queueKey);

    if (queued.length > 0) {
      const grouped = groupNotifications(queued);
      await processCallback(grouped);
    }
  }, DEBOUNCE_MS);

  processingTimers.set(queueKey, timer);
}

/**
 * Grupează notificări similare pentru același user
 */
export function groupNotifications(
  notifications: QueuedNotification[]
): GroupedNotification[] {
  if (notifications.length === 0) return [];

  const grouped = new Map<string, QueuedNotification[]>();

  // Group by user_id + tip_notificare
  notifications.forEach(notif => {
    const key = `${notif.user_id}:${notif.tip_notificare}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(notif);
  });

  // Convert to GroupedNotification
  const result: GroupedNotification[] = [];

  grouped.forEach((notifs, key) => {
    const [user_id, tip_notificare] = key.split(':');

    if (notifs.length === 1) {
      // Single notification - nu e nevoie de grouping
      result.push({
        user_id,
        tip_notificare: tip_notificare as TipNotificare,
        contexts: [notifs[0].context],
        merged_context: notifs[0].context,
      });
    } else {
      // Multiple notifications - merge contexts
      const merged = mergeContexts(notifs.map(n => n.context), tip_notificare as TipNotificare);
      result.push({
        user_id,
        tip_notificare: tip_notificare as TipNotificare,
        contexts: notifs.map(n => n.context),
        merged_context: merged,
      });
    }
  });

  return result;
}

// =====================================================
// CONTEXT MERGING STRATEGIES
// =====================================================

/**
 * Merge multiple contexts într-un singur context inteligent
 */
export function mergeContexts(
  contexts: NotificareContext[],
  tip_notificare: TipNotificare
): NotificareContext {
  if (contexts.length === 1) return contexts[0];

  const baseContext = { ...contexts[0] };

  switch (tip_notificare) {
    case 'proiect_atribuit':
    case 'subproiect_atribuit':
      return mergeProiectContexts(contexts, baseContext);

    case 'sarcina_atribuita':
      return mergeSarcinaContexts(contexts, baseContext);

    default:
      // Default: ia primul context și adaugă count
      return {
        ...baseContext,
        notificari_count: contexts.length,
      };
  }
}

/**
 * Merge context-uri pentru proiecte/subproiecte
 */
function mergeProiectContexts(
  contexts: NotificareContext[],
  base: NotificareContext
): NotificareContext {
  const subproiecte_ids = new Set<string>();
  const subproiecte_denumiri: string[] = [];

  contexts.forEach(ctx => {
    if (ctx.subproiect_id) {
      subproiecte_ids.add(ctx.subproiect_id);
      if (ctx.subproiect_denumire) {
        subproiecte_denumiri.push(ctx.subproiect_denumire);
      }
    }
    if (ctx.subproiecte_ids) {
      ctx.subproiecte_ids.forEach(id => subproiecte_ids.add(id));
    }
  });

  return {
    ...base,
    subproiecte_count: subproiecte_ids.size,
    subproiecte_ids: Array.from(subproiecte_ids),
    subproiecte_denumiri,
    mesaj_extra: `Ai fost atribuit la ${subproiecte_ids.size} subproiecte din acest proiect.`,
  };
}

/**
 * Merge context-uri pentru sarcini
 */
function mergeSarcinaContexts(
  contexts: NotificareContext[],
  base: NotificareContext
): NotificareContext {
  const sarcini_ids = contexts.map(ctx => ctx.sarcina_id).filter(Boolean) as string[];
  const sarcini_titluri = contexts.map(ctx => ctx.sarcina_titlu).filter(Boolean) as string[];
  const total_ore_estimate = contexts.reduce((sum, ctx) => sum + (ctx.ore_estimate || 0), 0);

  return {
    ...base,
    sarcini_count: sarcini_ids.length,
    sarcini_ids,
    sarcini_titluri,
    ore_estimate: total_ore_estimate,
    mesaj_extra: `Ai fost atribuit la ${sarcini_ids.length} sarcini noi.`,
  };
}

// =====================================================
// PROIECT CREATION SMART GROUPING
// =====================================================

/**
 * Smart grouping special pentru crearea proiectelor cu subproiecte
 * Evită spam: User responsabil la proiect + 5 subproiecte = 1 notificare, nu 6
 */
export function groupProiectCreationNotifications(
  proiect_id: string,
  proiect_denumire: string,
  proiect_responsabil: string,
  subproiecte: Array<{
    id: string;
    denumire: string;
    responsabil: string;
  }>,
  creator_id: string
): BatchNotification[] {
  const notifications: BatchNotification[] = [];
  const userMap = new Map<string, {
    is_proiect_responsabil: boolean;
    subproiecte: typeof subproiecte;
  }>();

  // Skip creator
  if (proiect_responsabil !== creator_id) {
    userMap.set(proiect_responsabil, {
      is_proiect_responsabil: true,
      subproiecte: [],
    });
  }

  // Group subproiecte by responsabil
  subproiecte.forEach(subp => {
    if (subp.responsabil === creator_id) return; // skip creator

    if (!userMap.has(subp.responsabil)) {
      userMap.set(subp.responsabil, {
        is_proiect_responsabil: false,
        subproiecte: [],
      });
    }

    userMap.get(subp.responsabil)!.subproiecte.push(subp);
  });

  // Create smart notifications
  userMap.forEach((data, user_id) => {
    const notifs: Array<{
      tip_notificare: TipNotificare;
      context: NotificareContext;
    }> = [];

    if (data.is_proiect_responsabil) {
      // User e responsabil proiect + posibil subproiecte
      const context: NotificareContext = {
        proiect_id,
        proiect_denumire,
        subproiecte_count: data.subproiecte.length,
        subproiecte_ids: data.subproiecte.map(s => s.id),
        data_atribuire: new Date().toISOString(),
      };

      notifs.push({
        tip_notificare: 'proiect_atribuit' as TipNotificare,
        context,
      });
    } else if (data.subproiecte.length > 0) {
      // User e doar pe subproiecte, nu pe proiect
      if (data.subproiecte.length === 1) {
        // 1 singur subproiect - notificare individuală
        const subp = data.subproiecte[0];
        notifs.push({
          tip_notificare: 'subproiect_atribuit' as TipNotificare,
          context: {
            proiect_id,
            proiect_denumire,
            subproiect_id: subp.id,
            subproiect_denumire: subp.denumire,
            data_atribuire: new Date().toISOString(),
          },
        });
      } else {
        // Multiple subproiecte - grouped notification
        notifs.push({
          tip_notificare: 'subproiect_atribuit' as TipNotificare,
          context: {
            proiect_id,
            proiect_denumire,
            subproiecte_count: data.subproiecte.length,
            subproiecte_ids: data.subproiecte.map(s => s.id),
            subproiecte_denumiri: data.subproiecte.map(s => s.denumire),
            data_atribuire: new Date().toISOString(),
            mesaj_extra: `Ai fost atribuit la ${data.subproiecte.length} subproiecte din proiectul ${proiect_denumire}.`,
          },
        });
      }
    }

    if (notifs.length > 0) {
      notifications.push({
        user_id,
        notifications: notifs,
      });
    }
  });

  return notifications;
}

// =====================================================
// BATCH PROCESSING UTILITIES
// =====================================================

/**
 * Split array în batch-uri
 */
export function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Process items în batch-uri cu delay între ele
 */
export async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>,
  options?: {
    delayMs?: number;
    onProgress?: (processed: number, total: number) => void;
  }
): Promise<R[]> {
  const batches = splitIntoBatches(items, batchSize);
  const results: R[] = [];
  let processed = 0;

  for (const batch of batches) {
    const batchResults = await processor(batch);
    results.push(...batchResults);
    processed += batch.length;

    options?.onProgress?.(processed, items.length);

    // Delay între batch-uri
    if (processed < items.length && options?.delayMs) {
      await new Promise(resolve => setTimeout(resolve, options.delayMs));
    }
  }

  return results;
}

// =====================================================
// CLEANUP & MAINTENANCE
// =====================================================

/**
 * Curăță queue-ul de notificări vechi (> 1 oră)
 */
export function cleanupOldQueuedNotifications(): void {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  notificationQueue.forEach((notifs, key) => {
    const filtered = notifs.filter(n => n.timestamp > oneHourAgo);

    if (filtered.length === 0) {
      notificationQueue.delete(key);
      if (processingTimers.has(key)) {
        clearTimeout(processingTimers.get(key)!);
        processingTimers.delete(key);
      }
    } else {
      notificationQueue.set(key, filtered);
    }
  });
}

/**
 * Force process toate notificările din queue
 */
export async function flushQueue(
  processCallback: (grouped: GroupedNotification[]) => Promise<void>
): Promise<void> {
  const allQueued: QueuedNotification[] = [];

  notificationQueue.forEach(notifs => {
    allQueued.push(...notifs);
  });

  // Clear all
  notificationQueue.clear();
  processingTimers.forEach(timer => clearTimeout(timer));
  processingTimers.clear();

  if (allQueued.length > 0) {
    const grouped = groupNotifications(allQueued);
    await processCallback(grouped);
  }
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  queueNotification,
  groupNotifications,
  mergeContexts,
  groupProiectCreationNotifications,
  splitIntoBatches,
  processBatches,
  cleanupOldQueuedNotifications,
  flushQueue,
};
