// CALEA: /lib/notifications/types.ts
// DATA: 05.10.2025 (ora României)
// DESCRIERE: TypeScript types pentru sistemul de notificări

// =====================================================
// ENUMS
// =====================================================

export enum TipNotificare {
  // Utilizatori normali
  PROIECT_ATRIBUIT = 'proiect_atribuit',
  SUBPROIECT_ATRIBUIT = 'subproiect_atribuit',
  SARCINA_ATRIBUITA = 'sarcina_atribuita',
  COMENTARIU_NOU = 'comentariu_nou',
  TERMEN_PROIECT_APROAPE = 'termen_proiect_aproape',
  TERMEN_SUBPROIECT_APROAPE = 'termen_subproiect_aproape',
  TERMEN_SARCINA_APROAPE = 'termen_sarcina_aproape',
  TERMEN_PROIECT_DEPASIT = 'termen_proiect_depasit',
  TERMEN_SARCINA_DEPASITA = 'termen_sarcina_depasita',
  ORE_ESTIMATE_DEPASIRE = 'ore_estimate_depasire',

  // Admini (extra)
  FACTURA_SCADENTA_APROAPE = 'factura_scadenta_aproape',
  FACTURA_SCADENTA_DEPASITA = 'factura_scadenta_depasita',
  PROIECT_FARA_CONTRACT = 'proiect_fara_contract',
  PV_GENERAT_FARA_FACTURA = 'pv_generat_fara_factura',
  FACTURA_ACHITATA = 'factura_achitata',
  ANAF_EROARE = 'anaf_eroare',
  FACTURA_NETRIMISA_ANAF = 'factura_netrimisa_anaf',

  // Clienți (viitor)
  CONTRACT_NOU_CLIENT = 'contract_nou_client',
  FACTURA_NOUA_CLIENT = 'factura_noua_client',
  FACTURA_SCADENTA_CLIENT = 'factura_scadenta_client',
  FACTURA_INTARZIERE_CLIENT = 'factura_intarziere_client',
}

export enum CanalNotificare {
  EMAIL = 'email',
  CLOPOTEL = 'clopotel',
  PUSH = 'push',
}

export enum PrioritateNotificare {
  CRITICAL = 'critical',
  IMPORTANT = 'important',
  NORMAL = 'normal',
  INFO = 'info',
}

export enum StatusNotificare {
  CITITA = 'citita',
  NECITITA = 'necitita',
}

export enum CategorieNotificare {
  PROIECTE = 'proiecte',
  SARCINI = 'sarcini',
  FACTURI = 'facturi',
  CONTRACTE = 'contracte',
  SISTEM = 'sistem',
}

export type RolDestinatar = 'admin' | 'normal' | 'client';

// =====================================================
// INTERFACES - TABELE BIGQUERY
// =====================================================

export interface Notificare {
  id: string;
  tip_notificare: TipNotificare;
  user_id: string;

  // Referințe entități (opționale)
  proiect_id?: string;
  subproiect_id?: string;
  sarcina_id?: string;
  factura_id?: string;
  contract_id?: string;

  // Conținut
  continut_json: NotificareContext;
  titlu: string;
  mesaj: string;
  link_actiune?: string;

  // Status
  citita: boolean;
  trimis_email: boolean;
  email_deliverat?: boolean;
  email_eroare?: string;

  // Metadata
  data_creare: { value: string } | string; // BigQuery DATE format
  data_citire?: string; // TIMESTAMP
  data_trimitere_email?: string; // TIMESTAMP
  prioritate: PrioritateNotificare;

  // Tracking
  creator_id?: string;
  ip_address?: string;
}

export interface NotificareSetting {
  id: string;
  tip_notificare: TipNotificare;

  // Informații
  nume_setare: string;
  descriere?: string;
  categorie: CategorieNotificare;

  // Status
  activ: boolean;
  canal_email: boolean;
  canal_clopotel: boolean;
  canal_push: boolean;

  // Templates
  template_subiect: string;
  template_continut: string;
  template_html: string;

  // Destinatari
  destinatari_rol: RolDestinatar[];
  exclude_creator: boolean;

  // Condiții
  conditii_json: NotificareConditii;
  frecventa_trigger: 'instant' | 'zilnic' | 'saptamanal';

  // Email settings
  email_cc?: string[];
  email_bcc?: string[];
  email_reply_to?: string;

  // Metadata
  data_creare: { value: string } | string;
  data_modificare?: string;
  modificat_de?: string;
  versiune: number;
}

export interface NotificarePreferinte {
  id: string;
  user_id: string;

  // Preferințe canale
  email_enabled: boolean;
  clopotel_enabled: boolean;
  push_enabled: boolean;
  sound_enabled: boolean;

  // Frecvență
  frecventa_email: 'instant' | 'zilnic' | 'saptamanal' | 'niciodata';
  frecventa_digest: 'zilnic' | 'saptamanal';

  // Dezactivate
  tipuri_dezactivate: TipNotificare[];

  // Schedule
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_days?: string[];

  // Metadata
  data_creare: { value: string } | string;
  data_modificare?: string;
}

// =====================================================
// INTERFACES - CONTEXT & PAYLOAD
// =====================================================

export interface NotificareContext {
  // User info
  user_name?: string;
  user_email?: string;

  // Proiect
  proiect_id?: string;
  proiect_denumire?: string;
  proiect_status?: string;
  progres_procent?: number;

  // Subproiect
  subproiect_id?: string;
  subproiect_denumire?: string;
  subproiecte_count?: number;
  subproiecte_ids?: string[];

  // Sarcină
  sarcina_id?: string;
  sarcina_titlu?: string;
  sarcina_descriere?: string;
  status_sarcina?: string;
  ore_estimate?: number;
  ore_lucrate?: number;
  ore_depasire?: number;
  procent_depasire?: number;

  // Factura
  factura_id?: string;
  serie_factura?: string;
  numar_factura?: string;
  suma_totala?: number;
  suma_achitata?: number;
  procent_achitat?: number;
  moneda?: string;
  status_plata?: string;
  data_scadenta?: string;

  // Contract
  contract_id?: string;
  numar_contract?: string;
  valoare_contract?: number;
  durata_contract?: string;

  // Client
  client_id?: string;
  client_denumire?: string;
  client_name?: string;

  // Termene & Date
  data_atribuire?: string;
  data_creare?: string;
  data_pv?: string;
  data_plata?: string;
  termen_realizare?: string;
  zile_ramase?: number;
  zile_intarziere?: number;

  // Comentarii
  comentator_name?: string;
  comentariu_text?: string;

  // ANAF
  tip_eroare?: string;
  mesaj_eroare?: string;
  data_eroare?: string;

  // Creator
  creator_id?: string;
  creator_name?: string;

  // Link-uri
  link_detalii?: string;

  // Extra custom data
  [key: string]: any;
}

export interface NotificareConditii {
  // Termene
  zile_inainte?: number[];
  zile_dupa?: number[];

  // Praguri
  prag_procent?: number;
  prag_ore?: number;
  prag_suma?: number;

  // Condiții multiple
  [key: string]: any;
}

// =====================================================
// INTERFACES - API REQUESTS
// =====================================================

export interface SendNotificationRequest {
  tip_notificare: TipNotificare;
  user_id: string | string[]; // suportă multiple destinatari
  context: NotificareContext;
  prioritate?: PrioritateNotificare;
  force_email?: boolean; // override setări pentru urgent
}

export interface SendNotificationResponse {
  success: boolean;
  notification_ids: string[];
  email_sent: boolean;
  errors?: string[];
}

export interface ListNotificationsRequest {
  user_id: string;
  limit?: number;
  offset?: number;
  citita?: boolean;
  tip_notificare?: TipNotificare;
  data_start?: string;
  data_end?: string;
}

export interface ListNotificationsResponse {
  notifications: Notificare[];
  total_count: number;
  unread_count: number;
  has_more: boolean;
}

export interface MarkReadRequest {
  notification_ids: string[];
  user_id: string;
}

export interface MarkReadResponse {
  success: boolean;
  marked_count: number;
}

export interface UpdateSettingsRequest {
  setting_id: string;
  updates: Partial<NotificareSetting>;
  user_id: string; // admin user
}

export interface UpdateSettingsResponse {
  success: boolean;
  updated_setting: NotificareSetting;
}

// =====================================================
// INTERFACES - EMAIL
// =====================================================

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export interface EmailPayload {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer | string;
  contentType?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveredTo?: string[];
}

// =====================================================
// INTERFACES - BATCH & GROUPING
// =====================================================

export interface BatchNotification {
  user_id: string;
  notifications: {
    tip_notificare: TipNotificare;
    context: NotificareContext;
  }[];
}

export interface GroupedNotification {
  user_id: string;
  tip_notificare: TipNotificare;
  contexts: NotificareContext[];
  merged_context: NotificareContext;
}

// =====================================================
// TYPE GUARDS
// =====================================================

export function isDateObject(value: any): value is { value: string } {
  return typeof value === 'object' && value !== null && 'value' in value;
}

export function extractDateValue(date: { value: string } | string | undefined): string | undefined {
  if (!date) return undefined;
  return isDateObject(date) ? date.value : date;
}

// =====================================================
// CONSTANTS
// =====================================================

export const NOTIFICATION_PRIORITIES = {
  [PrioritateNotificare.CRITICAL]: {
    label: 'Critică',
    color: '#EF4444',
    icon: '🔴',
  },
  [PrioritateNotificare.IMPORTANT]: {
    label: 'Importantă',
    color: '#F59E0B',
    icon: '🟡',
  },
  [PrioritateNotificare.NORMAL]: {
    label: 'Normală',
    color: '#3B82F6',
    icon: '🔵',
  },
  [PrioritateNotificare.INFO]: {
    label: 'Informare',
    color: '#10B981',
    icon: '🟢',
  },
};

export const NOTIFICATION_CATEGORIES = {
  [CategorieNotificare.PROIECTE]: {
    label: 'Proiecte',
    icon: '📊',
  },
  [CategorieNotificare.SARCINI]: {
    label: 'Sarcini',
    icon: '✅',
  },
  [CategorieNotificare.FACTURI]: {
    label: 'Facturi',
    icon: '💰',
  },
  [CategorieNotificare.CONTRACTE]: {
    label: 'Contracte',
    icon: '📄',
  },
  [CategorieNotificare.SISTEM]: {
    label: 'Sistem',
    icon: '⚙️',
  },
};

export const DEFAULT_NOTIFICATION_LIMIT = 50;
export const MAX_NOTIFICATION_LIMIT = 200;
export const NOTIFICATION_BATCH_SIZE = 100;
export const NOTIFICATION_DEBOUNCE_MS = 5000; // 5 secunde pentru grouping
