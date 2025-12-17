// =================================================================
// TIPURI TYPESCRIPT: Sistem Încasări Propuneri
// Generat: 2025-12-17
// =================================================================

export interface FacturaReference {
  serie: string | null;
  numar: string;
  confidence: 'exact' | 'partial' | 'inferred';
  source_pattern: string; // Pattern-ul care a găsit referința
}

export interface MatchScore {
  total: number;
  referinta_score: number;
  cui_score: number;
  suma_score: number;
  timp_score: number;
  details: {
    referinta_gasita: string | null;
    referinta_confidence: string | null;
    cui_match: boolean;
    cui_tranzactie: string | null;
    cui_factura: string | null;
    suma_diferenta_procent: number;
    zile_diferenta: number;
  };
}

export interface PropunereIncasare {
  id: string;
  tranzactie_id: string;
  factura_id: string;
  etapa_factura_id?: string;

  // Scoring
  score: number;
  auto_approvable: boolean;

  // Sume
  suma_tranzactie: number;
  suma_factura: number;
  rest_de_plata: number;
  diferenta_ron: number;
  diferenta_procent: number;

  // Detalii matching
  matching_algorithm: string;
  referinta_gasita: string | null;
  matching_details: MatchScore;

  // Status
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  motiv_respingere?: string;

  // Date factură
  factura_serie: string | null;
  factura_numar: string;
  factura_client_nume: string;
  factura_client_cui: string | null;

  // Date tranzacție
  tranzactie_data: string;
  tranzactie_contrapartida: string | null;
  tranzactie_cui: string | null;
  tranzactie_detalii: string | null;

  // Audit
  data_creare: string;
  data_aprobare?: string;
  aprobat_de?: string;
}

export interface TranzactieCandidat {
  id: string;
  suma: number;
  data_procesare: string | { value: string };
  nume_contrapartida: string | null;
  cui_contrapartida: string | null;
  detalii_tranzactie: string | null;
  referinta_bancii: string | null;
  directie: string;
  status: string | null;
  matching_tip: string | null;
}

export interface FacturaCandidat {
  id: string;
  serie: string | null;
  numar: string;
  total: number;
  valoare_platita: number;
  rest_de_plata: number;
  client_cui: string | null;
  client_nume: string;
  data_factura: string | { value: string };
  status: string;
  proiect_id: string | null;
}

export interface PropuneriStats {
  total: number;
  pending: number;
  auto_approvable: number;
  review_needed: number;
  approved: number;
  rejected: number;
}

export interface GeneratePropuneriResult {
  success: boolean;
  propuneri_generate: number;
  propuneri_auto_approvable: number;
  propuneri_review: number;
  tranzactii_procesate: number;
  errors?: string[];
}

export interface ApprovePropunereResult {
  success: boolean;
  propunere_id: string;
  factura_updated: boolean;
  tranzactie_updated: boolean;
  error?: string;
}

export interface ConfigurarePropuneri {
  auto_approve_threshold: number;
  min_score: number;
  expirare_zile: number;
  notificare_enabled: boolean;
  referinta_score: number;
  cui_score: number;
  suma_score: number;
}
