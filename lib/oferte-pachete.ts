// ==================================================================
// CALEA: lib/oferte-pachete.ts
// DESCRIERE: Pachetele de expertiza (Esential / Complet / Premium) pentru oferte.
//            Modul "pur" (fara fs), importabil atat din UI cat si din API.
// STOCARE: detalii_tehnice.pachet = 'esential' | 'complet' | 'premium' (JSON)
// ==================================================================

export type PachetOferta = 'esential' | 'complet' | 'premium';

export const PACHET_LABELS: Record<PachetOferta, string> = {
  esential: 'Esențial',
  complet: 'Complet',
  premium: 'Premium',
};

// Pachetele sunt cumulative: Premium include tot ce include Complet, iar Complet tot ce include Esential.
export const PACHET_RANK: Record<PachetOferta, number> = {
  esential: 1,
  complet: 2,
  premium: 3,
};

// Tipurile de oferta la care se aplica alegerea pachetului
export const TIPURI_OFERTA_CU_PACHET: ReadonlySet<string> = new Set([
  'expertiza_tehnica',
  'expertiza_monument',
]);

export function isPachetOferta(value: unknown): value is PachetOferta {
  return typeof value === 'string' && value in PACHET_LABELS;
}
