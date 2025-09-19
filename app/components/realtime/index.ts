// ==================================================================
// CALEA: app/components/realtime/index.ts
// DATA: 19.09.2025 23:20 (ora României)
// DESCRIERE: Export central pentru toate componentele real-time
// FUNCȚIONALITATE: Barrel exports pentru organizarea importurilor
// ==================================================================

export { RealtimeProvider, useRealtime } from './RealtimeProvider';
export { LiveNotifications } from './LiveNotifications';
export { LiveMetrics } from './LiveMetrics';

// Re-export types for external use
export type {
  RealtimeData,
  Notification,
  RealtimeContextType
} from './RealtimeProvider';