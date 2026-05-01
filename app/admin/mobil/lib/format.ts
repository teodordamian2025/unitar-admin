// ==================================================================
// CALEA: app/admin/mobil/lib/format.ts
// DATA: 01.05.2026 (Faza 2)
// DESCRIERE: Helpers comuni pentru formatarea datelor BigQuery + valori în UI mobil.
// ==================================================================

/**
 * Extrage string ISO dintr-un câmp BigQuery DATE/TIMESTAMP care poate veni
 * fie ca string ('2025-08-16'), fie ca obiect ({value: '2025-08-16'}).
 */
export function bqDateString(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input === 'string') return input || null;
  if (typeof input === 'object' && input !== null && 'value' in input) {
    const v = (input as { value: unknown }).value;
    return typeof v === 'string' && v.length > 0 ? v : null;
  }
  return null;
}

/** Formatează 'YYYY-MM-DD' în 'DD.MM.YYYY'. Returnează '—' dacă nu e valid. */
export function formatDateRO(input: unknown): string {
  const iso = bqDateString(input);
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  if (!y || !m || !d) return '—';
  return `${d}.${m}.${y}`;
}

/** Date difference în zile (negativ = trecut). Returnează null dacă lipsește. */
export function daysUntil(input: unknown): number | null {
  const iso = bqDateString(input);
  if (!iso) return null;
  const date = new Date(iso.split('T')[0] + 'T00:00:00');
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = date.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/** Formatează un număr ca RON cu separatoare RO. */
export function formatMoney(value: unknown, currency: string = 'RON'): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(n)) return '—';
  return `${n.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} ${currency}`;
}
