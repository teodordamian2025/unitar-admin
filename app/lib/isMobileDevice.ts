// ==================================================================
// CALEA: app/lib/isMobileDevice.ts
// DATA: 01.05.2026
// DESCRIERE: Helper pur (client-side) pentru detectarea device-urilor mobile.
// FUNCȚIONALITATE: User-Agent + viewport width. Folosit pentru redirect /admin → /admin/mobil.
// ==================================================================

const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile Safari/i;
const TABLET_UA_REGEX = /iPad|Android(?!.*Mobile)|Tablet/i;
const MOBILE_BREAKPOINT_PX = 768;

/**
 * Returnează true dacă device-ul curent este mobil (telefon).
 *
 * Logică:
 * - SSR (typeof window === 'undefined') → false (default desktop, evită hydration mismatch).
 * - Client: UA mobile-phone OR (UA tablet AND width < 768) OR (touch AND width < 768).
 *
 * NU returnează true pentru tablete în landscape (iPad ≥ 768px) — acelea folosesc desktop UI.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = window.navigator.userAgent || '';
  const width = window.innerWidth;

  if (MOBILE_UA_REGEX.test(ua)) return true;

  if (TABLET_UA_REGEX.test(ua) && width < MOBILE_BREAKPOINT_PX) return true;

  // Fallback: device touch + viewport îngust (DevTools mobile emulation)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (hasTouch && width < MOBILE_BREAKPOINT_PX) return true;

  return false;
}
