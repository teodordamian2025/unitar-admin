// =====================================================
// TYPES: Facturi Primite ANAF
// TypeScript types pentru sistemul de facturi primite
// Data: 08.10.2025
// =====================================================

/**
 * Row din tabelul FacturiPrimiteANAF_v2
 */
export interface FacturaPrimita {
  id: string;
  id_mesaj_anaf?: string;
  id_descarcare?: string;

  // Date furnizor
  cif_emitent?: string;
  nume_emitent?: string;

  // Date factură
  serie_numar?: string;
  data_factura?: { value: string } | string; // BigQuery DATE format
  valoare_totala?: number;
  moneda?: string;

  // Conversie valutară
  curs_valutar?: number;
  data_curs_valutar?: { value: string } | string;
  valoare_ron?: number;

  // TVA breakdown (pentru matching cu cheltuieli fără TVA)
  valoare_fara_tva?: number;
  valoare_tva?: number;
  cota_tva?: number;

  // Link cu tranzacție bancară
  tranzactie_asociata_id?: string;

  // Metadata
  tip_document?: string;
  status_procesare?: 'nou' | 'descarcat' | 'procesat' | 'asociat' | 'eroare';

  // Google Drive
  google_drive_file_id?: string;
  google_drive_folder_id?: string;
  zip_file_id?: string;
  xml_file_id?: string;
  pdf_file_id?: string;

  // Conținut
  xml_content?: string;

  // Asociere
  cheltuiala_asociata_id?: string;
  asociere_automata?: boolean;
  asociere_confidence?: number;
  asociere_manual_user_id?: string;

  // Timestamps
  data_preluare?: string | { value: string };
  data_procesare?: string;
  data_asociere?: string;

  // Flags
  activ?: boolean;
  observatii?: string;
}

/**
 * Răspuns ANAF API listaMesajeFactura
 */
export interface AnafMesajFactura {
  id: string; // ID mesaj
  data_creare: string; // Format: "202510080930"
  cif: string; // CUI emitent
  id_solicitare?: string;
  detalii: string; // Ex: "Factura seria X nr 123"
  tip: string; // Ex: "FACTURA PRIMITA"
  id_descarcare: string; // Hash pentru download
}

export interface AnafListaMesajeResponse {
  mesaje: AnafMesajFactura[];
  titlu?: string;
  serial?: string;
  cui?: string;
  lista_mesaje?: AnafMesajFactura[]; // Alternate field name
}

/**
 * Date parsate din XML UBL 2.1
 */
export interface FacturaXMLData {
  // Header info
  serie_numar: string;
  data_factura: string; // ISO format YYYY-MM-DD
  tip_document: string;
  moneda: string;

  // Furnizor (supplier)
  furnizor_cui: string;
  furnizor_nume: string;
  furnizor_adresa?: string;
  furnizor_oras?: string;
  furnizor_tara?: string;
  furnizor_reg_com?: string;

  // Client (customer) - ar trebui să fie CUI-ul nostru
  client_cui?: string;
  client_nume?: string;

  // Totals
  valoare_fara_tva: number;
  valoare_tva: number;
  valoare_totala: number;

  // Line items (opțional pentru matching detaliat)
  linii?: Array<{
    descriere: string;
    cantitate: number;
    pret_unitar: number;
    valoare: number;
  }>;

  // Exchange rate (dacă e în valută)
  curs_valutar?: number;
  data_curs_valutar?: string;
}

/**
 * Rezultat match scoring pentru cheltuieli
 */
export interface MatchResult {
  cheltuiala_id: string;
  proiect_id: string;
  proiect_denumire?: string;
  subproiect_id?: string;
  subproiect_denumire?: string;

  // Breakdown score
  score_total: number; // 0-1
  score_cui: number; // 0-0.40
  score_valoare: number; // 0-0.30
  score_data: number; // 0-0.20
  score_numar: number; // 0-0.10

  // Match details
  cui_match: boolean;
  valoare_diff_percent: number;
  data_diff_days: number;
  numar_match: boolean;

  // Cheltuială data (pentru display)
  cheltuiala: {
    furnizor_nume: string;
    furnizor_cui: string;
    valoare: number;
    valoare_ron: number;
    moneda: string;
    data_factura_furnizor?: string;
    nr_factura_furnizor?: string;
    descriere?: string;
    status_achitare?: string;
  };
}

/**
 * Request body pentru asociere manuală
 */
export interface AssociateInvoiceRequest {
  factura_id: string;
  cheltuiala_id: string;
  user_id: string;
  manual: boolean;
  observatii?: string;
}

/**
 * Filtru pentru lista facturi
 */
export interface FacturiPrimiteFilter {
  data_start?: string;
  data_end?: string;
  cif_emitent?: string;
  status_procesare?: string;
  asociat?: boolean; // true = doar asociate, false = doar neasociate
  search?: string; // Caută în serie_numar, nume_emitent, observatii
  limit?: number;
  offset?: number;
}

/**
 * Response paginată lista facturi
 */
export interface FacturiPrimiteListResponse {
  facturi: FacturaPrimita[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/**
 * Stats pentru dashboard
 */
export interface FacturiPrimiteStats {
  total: number;
  neasociate: number;
  asociate_automat: number;
  asociate_manual: number;
  in_eroare: number;
  valoare_totala_ron: number;
  valoare_neasociata_ron: number;
  ultima_sincronizare?: string;
}
