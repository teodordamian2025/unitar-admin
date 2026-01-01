// =================================================================
// TYPES: Propuneri Plăți Automate
// TypeScript interfaces pentru sistemul de matching plăți
// Data: 2026-01-01
// =================================================================

/**
 * Configurare pentru generare propuneri plăți
 */
export interface ConfigurarePropuneriPlati {
  // Threshold-uri
  auto_approve_threshold: number;  // Default: 85
  min_score: number;               // Default: 50
  expirare_zile: number;           // Default: 30

  // Ponderi scoring (total = 100)
  cui_score: number;               // Default: 35
  valoare_score: number;           // Default: 35
  referinta_score: number;         // Default: 20
  data_score: number;              // Default: 10

  // TVA
  cota_tva: number;                // Default: 21 (din SetariFacturare)

  // Notificări
  notificare_enabled: boolean;     // Default: true
}

export const DEFAULT_CONFIG: ConfigurarePropuneriPlati = {
  auto_approve_threshold: 85,
  min_score: 50,
  expirare_zile: 30,
  cui_score: 35,
  valoare_score: 35,
  referinta_score: 20,
  data_score: 10,
  cota_tva: 21,
  notificare_enabled: true
};

/**
 * Tranzacție bancară candidat pentru matching (plată)
 */
export interface TranzactiePlataCandidat {
  id: string;
  suma: number;                    // Valoare negativă pentru plăți
  data_procesare: string | { value: string };
  nume_contrapartida: string | null;
  cui_contrapartida: string | null;
  detalii_tranzactie: string | null;
  referinta_bancii: string | null;
  directie: string;                // 'iesire'
  status: string | null;
  matching_tip: string | null;
}

/**
 * Factură primită candidat pentru matching
 */
export interface FacturaPrimitaCandidat {
  id: string;
  serie_numar: string | null;
  cif_emitent: string | null;
  nume_emitent: string | null;
  data_factura: string | { value: string };
  valoare_totala: number;          // Cu TVA
  valoare_ron: number;             // Cu TVA în RON
  moneda: string;
  status_procesare: string;
  cheltuiala_asociata_id: string | null;  // Dacă e deja asociată cu cheltuială
  // Date cheltuială asociată (dacă există)
  cheltuiala_proiect_id?: string;
  cheltuiala_proiect_denumire?: string;
  cheltuiala_subproiect_id?: string;
  cheltuiala_subproiect_denumire?: string;
  cheltuiala_descriere?: string;
}

/**
 * Cheltuială candidat pentru matching
 */
export interface CheltuialaCandidat {
  id: string;
  proiect_id: string;
  proiect_denumire: string;
  subproiect_id: string | null;
  subproiect_denumire: string | null;
  tip_cheltuiala: string;
  furnizor_cui: string | null;
  furnizor_nume: string | null;
  descriere: string | null;
  valoare: number;                 // Fără TVA
  moneda: string;
  valoare_ron: number;             // Fără TVA în RON
  status_achitare: string;         // 'Neincasat', 'Partial', 'Incasat'
  nr_factura_furnizor: string | null;
  data_factura_furnizor: string | { value: string } | null;
  data_creare: string | { value: string };
}

/**
 * Target unificat pentru matching (poate fi factură sau cheltuială)
 */
export interface TargetPlataUnificat {
  id: string;
  tip: 'factura_primita' | 'cheltuiala';

  // Date comune
  furnizor_cui: string | null;
  furnizor_nume: string | null;
  serie_numar: string | null;      // Pentru facturi sau nr_factura_furnizor
  data_factura: string | null;
  valoare_cu_tva: number;          // Valoarea cu TVA (pentru comparație cu plata)
  valoare_fara_tva: number;        // Valoarea fără TVA (originală pentru cheltuieli)

  // Date proiect (pentru cheltuieli sau din asociere)
  proiect_id: string | null;
  proiect_denumire: string | null;
  subproiect_id: string | null;
  subproiect_denumire: string | null;
  descriere: string | null;

  // Asociere cascadată (pentru facturi)
  cheltuiala_asociata_id: string | null;
}

/**
 * Scor de matching calculat
 */
export interface MatchScorePlati {
  total: number;                   // 0-100
  cui_score: number;               // 0-35 (default)
  valoare_score: number;           // 0-35 (default)
  referinta_score: number;         // 0-20 (default)
  data_score: number;              // 0-10 (default)

  details: {
    // CUI
    cui_match: boolean;
    cui_tranzactie: string;
    cui_target: string;

    // Name matching (pentru cazuri când CUI lipsește sau e incorect)
    name_match: boolean;
    name_similarity: number;       // 0-1 (0=nicio potrivire, 1=identice)
    nume_tranzactie: string;       // nume_contrapartida din tranzacție
    nume_target: string;           // furnizor_nume din target

    // Valoare
    suma_plata: number;            // Valoarea absolută a plății
    suma_target: number;           // Valoarea target (cu TVA)
    diferenta_ron: number;
    diferenta_procent: number;

    // Referință
    referinta_gasita: string | null;
    referinta_confidence: 'exact' | 'partial' | 'inferred' | null;

    // Data
    data_plata: string;
    data_factura: string | null;
    zile_diferenta: number;

    // Matching info
    matching_algorithm: string;
    matching_reasons: string[];
  };

  // Evaluare
  is_candidate: boolean;
  is_auto_approvable: boolean;
}

/**
 * Propunere de plată salvată în DB
 */
export interface PropunerePlata {
  id: string;
  tranzactie_id: string;

  // Target
  target_type: 'factura_primita' | 'cheltuiala';
  factura_primita_id: string | null;
  cheltuiala_id: string | null;
  cheltuiala_asociata_din_factura: string | null;  // Asociere cascadată

  // Scoring
  score: number;
  auto_approvable: boolean;

  // Valori
  suma_plata: number;
  suma_target: number;
  suma_target_cu_tva: number | null;
  diferenta_ron: number | null;
  diferenta_procent: number | null;

  // Matching
  matching_algorithm: string | null;
  referinta_gasita: string | null;
  matching_details: MatchScorePlati | string;  // JSON în DB

  // Status
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  motiv_respingere: string | null;

  // Date denormalizate pentru UI
  furnizor_cui: string | null;
  furnizor_nume: string | null;
  factura_serie_numar: string | null;
  proiect_id: string | null;
  proiect_denumire: string | null;
  subproiect_id: string | null;
  subproiect_denumire: string | null;
  cheltuiala_descriere: string | null;

  tranzactie_data: string | null;
  tranzactie_contrapartida: string | null;
  tranzactie_cui: string | null;
  tranzactie_detalii: string | null;

  // Audit
  data_creare: string;
  data_aprobare: string | null;
  data_respingere: string | null;
  aprobat_de: string | null;
  respins_de: string | null;
  creat_de: string | null;

  // Flag validitate (calculat din JOIN-uri)
  is_valid?: boolean;
}

/**
 * Statistici pentru UI
 */
export interface StatisticiPropuneriPlati {
  total: number;
  pending: number;
  auto_approvable: number;
  review_needed: number;
  approved: number;
  rejected: number;
  expired: number;
}

/**
 * Rezultat generare propuneri
 */
export interface GeneratePropuneriPlatiResult {
  success: boolean;
  propuneri_generate: number;
  propuneri_auto_approvable: number;
  propuneri_review: number;
  tranzactii_procesate: number;
  message?: string;
  propuneri?: PropunerePlata[];  // Doar în dry_run
}

/**
 * Request pentru aprobare/respingere
 */
export interface ActionPropunerePlataRequest {
  action: 'approve' | 'reject' | 'approve_all';
  propunere_id?: string;
  propunere_ids?: string[];
  motiv_respingere?: string;
  user_id: string;
  user_name: string;
}

/**
 * Referință factură extrasă din detalii tranzacție
 */
export interface ReferintaFacturaPlata {
  serie: string | null;
  numar: string;
  confidence: 'exact' | 'partial' | 'inferred';
  source_pattern: string;
}
