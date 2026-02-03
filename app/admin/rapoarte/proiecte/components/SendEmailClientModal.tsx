// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/SendEmailClientModal.tsx
// DATA: 03.02.2026
// DESCRIERE: Modal complet pentru trimiterea email-urilor către clienți
// ACTUALIZAT: Adăugat suport pentru atașare automată documente proiect
// ==================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

interface Contact {
  id: string;
  prenume: string;
  nume: string;
  email: string;
  telefon: string;
  rol: string;
  primeste_notificari: boolean;
}

interface EmailLog {
  id: string;
  tip_email: string;
  subiect: string;
  destinatari: string[];
  trimis_de_nume: string;
  email_status: string;
  data_trimitere: { value: string } | string;
}

interface Proiect {
  id: string;
  Denumire: string;
  Client: string;
  client_id: string;
  client_email?: string;
  Status?: string;
  Data_Start?: { value: string } | string;
  Data_Finalizare?: { value: string } | string;
  Progres_General?: number;
}

interface Subproiect {
  id: string;
  Denumire: string;
  Status?: string;
  progres_procent?: number;
}

interface Sarcina {
  id: string;
  titlu: string;
  status: string;
}

interface Attachment {
  name: string;
  size: number;
  type: string;
  content: string; // base64
}

// Interfețe pentru documente proiect
interface DocumentProiect {
  id: string;
  type: 'factura' | 'contract' | 'pv';
  numar: string;
  data: string;
  client: string;
  valoare?: number;
  status?: string;
  label: string;
  filename: string;
}

interface SendEmailClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  proiect: Proiect | null;
  subproiecte?: Subproiect[];
  sarcini?: Sarcina[];
  currentUser?: {
    uid: string;
    displayName?: string;
    email?: string;
  };
}

// Template-uri predefinite
const EMAIL_TEMPLATES = [
  {
    id: 'stadiu_proiect',
    nume: 'Stadiu Proiect',
    descriere: 'Informare despre stadiul actual al proiectului',
    subiect: 'Stadiu proiect: {{denumire_proiect}}',
    continut: `Stimate client,

Vă transmitem un update privind stadiul proiectului "{{denumire_proiect}}".

{{stadiu_detaliat}}

Vă mulțumim pentru încrederea acordată și rămânem la dispoziția dumneavoastră pentru orice clarificări.`
  },
  {
    id: 'factura_emisa',
    nume: 'Factură Emisă',
    descriere: 'Notificare despre emiterea unei facturi noi',
    subiect: 'Factură nouă pentru proiectul {{denumire_proiect}}',
    continut: `Stimate client,

Vă informăm că a fost emisă o nouă factură pentru proiectul "{{denumire_proiect}}".

Detalii facturare și modalități de plată vor fi transmise separat.

Vă mulțumim pentru colaborare!`
  },
  {
    id: 'factura_restanta',
    nume: 'Factură Restantă',
    descriere: 'Reamintire pentru facturi scadente',
    subiect: 'Reamintire: Factură restantă - {{denumire_proiect}}',
    continut: `Stimate client,

Vă aducem aminte că aveți o factură restantă aferentă proiectului "{{denumire_proiect}}".

Vă rugăm să efectuați plata în cel mai scurt timp posibil.

Pentru orice nelămuriri, nu ezitați să ne contactați.`
  },
  {
    id: 'proiect_finalizat',
    nume: 'Proiect Finalizat',
    descriere: 'Notificare finalizare proiect',
    subiect: 'Proiect finalizat: {{denumire_proiect}}',
    continut: `Stimate client,

Avem plăcerea de a vă anunța că proiectul "{{denumire_proiect}}" a fost finalizat cu succes!

{{stadiu_detaliat}}

Vă mulțumim pentru colaborare și vă așteptăm cu drag la proiecte viitoare!`
  },
  {
    id: 'custom',
    nume: 'Email Personalizat',
    descriere: 'Compune un email personalizat',
    subiect: '',
    continut: ''
  }
];

export default function SendEmailClientModal({
  isOpen,
  onClose,
  proiect,
  subproiecte = [],
  sarcini = [],
  currentUser
}: SendEmailClientModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingContacte, setLoadingContacte] = useState(false);
  const [contacte, setContacte] = useState<Contact[]>([]);
  const [selectedContacte, setSelectedContacte] = useState<string[]>([]);
  const [emailuriManuale, setEmailuriManuale] = useState('');
  const [templateSelectat, setTemplateSelectat] = useState('stadiu_proiect');
  const [subiect, setSubiect] = useState('');
  const [continut, setContinut] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [emailHistory, setEmailHistory] = useState<EmailLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State pentru documente proiect
  const [documenteProiect, setDocumenteProiect] = useState<{
    facturi: DocumentProiect[];
    contracte: DocumentProiect[];
    pvuri: DocumentProiect[];
  }>({ facturi: [], contracte: [], pvuri: [] });
  const [loadingDocumente, setLoadingDocumente] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [showDocuments, setShowDocuments] = useState(false);

  // Constante pentru limita de atașamente
  const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB per fișier
  const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total

  // Încarcă contactele și documentele când se deschide modalul
  useEffect(() => {
    if (isOpen && proiect?.client_id) {
      loadContacte();
      loadEmailHistory();
      loadDocumenteProiect();
    }
  }, [isOpen, proiect?.client_id, proiect?.id]);

  // Aplică template-ul selectat
  useEffect(() => {
    if (templateSelectat && proiect) {
      const template = EMAIL_TEMPLATES.find(t => t.id === templateSelectat);
      if (template) {
        const renderedSubject = renderTemplate(template.subiect);
        const renderedContent = renderTemplate(template.continut);
        setSubiect(renderedSubject);
        setContinut(renderedContent);
      }
    }
  }, [templateSelectat, proiect]);

  const loadContacte = async () => {
    if (!proiect?.client_id) return;

    setLoadingContacte(true);
    try {
      const response = await fetch(`/api/rapoarte/clienti/contacte?client_id=${encodeURIComponent(proiect.client_id)}`);
      const result = await response.json();

      if (result.success && result.data) {
        setContacte(result.data);
        // Pre-selectează contactele care primesc notificări
        const defaultSelected = result.data
          .filter((c: Contact) => c.primeste_notificari)
          .map((c: Contact) => c.email);
        setSelectedContacte(defaultSelected);
      }
    } catch (error) {
      console.error('Eroare la încărcarea contactelor:', error);
    } finally {
      setLoadingContacte(false);
    }
  };

  const loadEmailHistory = async () => {
    if (!proiect?.id) return;

    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/client-email/log?proiect_id=${encodeURIComponent(proiect.id)}&limit=10`);
      const result = await response.json();

      if (result.success && result.data) {
        setEmailHistory(result.data);
      }
    } catch (error) {
      console.error('Eroare la încărcarea istoricului:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Încarcă documentele proiectului
  const loadDocumenteProiect = async () => {
    if (!proiect?.id) return;

    setLoadingDocumente(true);
    try {
      const response = await fetch(`/api/documents/list-for-project?proiect_id=${encodeURIComponent(proiect.id)}`);
      const result = await response.json();

      if (result.success && result.data) {
        setDocumenteProiect({
          facturi: result.data.facturi || [],
          contracte: result.data.contracte || [],
          pvuri: result.data.pvuri || []
        });
        // Deschide automat secțiunea dacă există documente
        const total = (result.data.facturi?.length || 0) +
                      (result.data.contracte?.length || 0) +
                      (result.data.pvuri?.length || 0);
        if (total > 0) {
          setShowDocuments(true);
        }
      }
    } catch (error) {
      console.error('Eroare la încărcarea documentelor:', error);
    } finally {
      setLoadingDocumente(false);
    }
  };

  // Renderizează template cu variabilele proiectului
  const renderTemplate = (template: string): string => {
    if (!proiect) return template;

    let rendered = template;

    // Variabile de bază
    rendered = rendered.replace(/\{\{denumire_proiect\}\}/g, proiect.Denumire || '');
    rendered = rendered.replace(/\{\{client\}\}/g, proiect.Client || '');
    rendered = rendered.replace(/\{\{status\}\}/g, proiect.Status || '');

    // Generează stadiul detaliat
    const stadiuDetaliat = generateStadiuDetaliat();
    rendered = rendered.replace(/\{\{stadiu_detaliat\}\}/g, stadiuDetaliat);

    return rendered;
  };

  // Generează text cu stadiul proiectului, subproiectelor și sarcinilor
  const generateStadiuDetaliat = (): string => {
    const lines: string[] = [];

    // Status proiect principal
    lines.push(`Stadiu proiect: ${proiect?.Status || 'În lucru'}`);
    if (proiect?.Progres_General !== undefined) {
      lines.push(`Progres general: ${proiect.Progres_General}%`);
    }

    // Subproiecte
    if (subproiecte.length > 0) {
      lines.push('\nSubproiecte:');
      subproiecte.forEach((sp, index) => {
        const progres = sp.progres_procent !== undefined ? ` (${sp.progres_procent}%)` : '';
        const status = sp.Status ? ` - ${sp.Status}` : '';
        lines.push(`  ${index + 1}. ${sp.Denumire}${status}${progres}`);
      });
    }

    // Sarcini (rezumat)
    if (sarcini.length > 0) {
      const sarciniFinalizate = sarcini.filter(s => s.status === 'finalizata' || s.status === 'completata').length;
      const sarciniInLucru = sarcini.filter(s => s.status === 'in_lucru' || s.status === 'in_progres').length;
      const sarciniPending = sarcini.length - sarciniFinalizate - sarciniInLucru;

      lines.push(`\nSarcini: ${sarciniFinalizate}/${sarcini.length} finalizate`);
      if (sarciniInLucru > 0) {
        lines.push(`  - ${sarciniInLucru} în lucru`);
      }
      if (sarciniPending > 0) {
        lines.push(`  - ${sarciniPending} în așteptare`);
      }
    }

    return lines.join('\n');
  };

  const toggleContact = (email: string) => {
    setSelectedContacte(prev => {
      if (prev.includes(email)) {
        return prev.filter(e => e !== email);
      } else {
        return [...prev, email];
      }
    });
  };

  // Toggle selectare document
  const toggleDocument = (docKey: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docKey)) {
        newSet.delete(docKey);
      } else {
        newSet.add(docKey);
      }
      return newSet;
    });
  };

  // Funcții pentru gestionarea atașamentelor
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const currentTotalSize = attachments.reduce((sum, att) => sum + att.size, 0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Verificare dimensiune fișier individual
      if (file.size > MAX_ATTACHMENT_SIZE) {
        toast.error(`Fișierul "${file.name}" depășește limita de 10MB`);
        continue;
      }

      // Verificare dimensiune totală
      if (currentTotalSize + file.size > MAX_TOTAL_SIZE) {
        toast.error('Dimensiunea totală a atașamentelor depășește 25MB');
        break;
      }

      // Verificare duplicat
      if (attachments.some(att => att.name === file.name)) {
        toast.warning(`Fișierul "${file.name}" există deja`);
        continue;
      }

      // Convertire la base64
      try {
        const base64 = await fileToBase64(file);
        setAttachments(prev => [...prev, {
          name: file.name,
          size: file.size,
          type: file.type,
          content: base64
        }]);
      } catch (error) {
        console.error('Eroare la citirea fișierului:', error);
        toast.error(`Eroare la încărcarea fișierului "${file.name}"`);
      }
    }

    // Reset input pentru a permite re-selectarea aceluiași fișier
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Extrage doar partea base64 (fără "data:...;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const removeAttachment = (fileName: string) => {
    setAttachments(prev => prev.filter(att => att.name !== fileName));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getTotalAttachmentSize = (): number => {
    return attachments.reduce((sum, att) => sum + att.size, 0);
  };

  const handleSubmit = async () => {
    // Validări
    if (!subiect.trim()) {
      toast.error('Subiectul email-ului este obligatoriu');
      return;
    }
    if (!continut.trim()) {
      toast.error('Conținutul email-ului este obligatoriu');
      return;
    }

    // Colectează toate email-urile
    const allEmails = [...selectedContacte];

    // Adaugă email-uri manuale
    if (emailuriManuale.trim()) {
      const manuale = emailuriManuale.split(/[,;\n]/).map(e => e.trim()).filter(e => e);
      allEmails.push(...manuale);
    }

    // Adaugă email-ul principal al clientului dacă există
    if (proiect?.client_email && !allEmails.includes(proiect.client_email)) {
      // Doar dacă nu există contacte
      if (contacte.length === 0) {
        allEmails.unshift(proiect.client_email);
      }
    }

    if (allEmails.length === 0) {
      toast.error('Selectează cel puțin un destinatar');
      return;
    }

    setLoading(true);

    try {
      // 1. Generează documentele selectate (dacă există)
      let generatedAttachments: Array<{ filename: string; content: string; contentType: string }> = [];

      if (selectedDocuments.size > 0) {
        toast.info('Se generează documentele atașate...', { autoClose: 2000 });

        // Construiește lista de documente de generat
        const documentsToGenerate: Array<{ type: 'factura' | 'contract' | 'pv'; id: string }> = [];

        selectedDocuments.forEach(key => {
          const [type, id] = key.split(':');
          if (type && id) {
            documentsToGenerate.push({ type: type as 'factura' | 'contract' | 'pv', id });
          }
        });

        if (documentsToGenerate.length > 0) {
          const genResponse = await fetch('/api/documents/generate-for-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documents: documentsToGenerate })
          });

          const genResult = await genResponse.json();

          if (genResult.success && genResult.attachments) {
            generatedAttachments = genResult.attachments;
            console.log(`[EMAIL] Generate ${generatedAttachments.length} documente pentru atașare`);
          } else if (genResult.errors?.length > 0) {
            toast.warning(`Atenție: ${genResult.errors.join(', ')}`);
          }
        }
      }

      // 2. Combină atașamentele generate cu cele manuale
      const allAttachments = [
        ...generatedAttachments,
        ...attachments.map(att => ({
          filename: att.name,
          content: att.content,
          contentType: att.type
        }))
      ];

      // 3. Trimite email-ul
      const response = await fetch('/api/client-email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proiect_id: proiect?.id,
          client_id: proiect?.client_id,
          client_nume: proiect?.Client,
          tip_email: templateSelectat,
          subiect: subiect.trim(),
          continut: continut.trim(),
          destinatari: Array.from(new Set(allEmails)), // Elimină duplicate
          template_folosit: templateSelectat,
          trimis_de: currentUser?.uid,
          trimis_de_nume: currentUser?.displayName || currentUser?.email,
          attachments: allAttachments.length > 0 ? allAttachments : undefined
        })
      });

      const result = await response.json();

      if (result.success) {
        const attachmentMsg = allAttachments.length > 0
          ? ` (${allAttachments.length} atașament${allAttachments.length > 1 ? 'e' : ''})`
          : '';
        toast.success(`Email trimis cu succes către ${result.deliveredTo?.length || 0} destinatar(i)${attachmentMsg}!`);
        // Reset stări și refresh istoric
        setAttachments([]);
        setSelectedDocuments(new Set());
        await loadEmailHistory();
        onClose();
      } else {
        toast.error(result.error || 'Eroare la trimiterea email-ului');
      }
    } catch (error) {
      console.error('Eroare la trimitere:', error);
      toast.error('Eroare la trimiterea email-ului');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: { value: string } | string | undefined): string => {
    if (!date) return '-';
    const dateStr = typeof date === 'object' && date.value ? date.value : date as string;
    try {
      return new Date(dateStr).toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Calculează numărul total de documente disponibile
  const totalDocuments = documenteProiect.facturi.length +
                         documenteProiect.contracte.length +
                         documenteProiect.pvuri.length;

  if (!isOpen || !proiect) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem'
      }}
      onClick={() => onClose()}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          width: '100%',
          maxWidth: '800px',
          maxHeight: 'calc(100vh - 2rem)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem 2rem',
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ margin: 0, color: 'white', fontSize: '1.25rem', fontWeight: '700' }}>
              Trimite Email Client
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem' }}>
              {proiect.Client} - {proiect.Denumire}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Buton istoric - vizibil și clar */}
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              style={{
                padding: '0.5rem 1rem',
                background: showHistory ? 'white' : 'rgba(255, 255, 255, 0.25)',
                color: showHistory ? '#1d4ed8' : 'white',
                border: '2px solid rgba(255, 255, 255, 0.5)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
              title="Vezi istoricul email-urilor trimise pentru acest proiect"
            >
              Istoric {emailHistory.length > 0 ? `(${emailHistory.length})` : ''}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                fontSize: '1.25rem',
                cursor: 'pointer',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem 2rem' }}>
          {showHistory ? (
            // Afișare istoric email-uri
            <div>
              <h3 style={{ margin: '0 0 1rem 0', color: '#374151', fontSize: '1rem' }}>
                Istoric email-uri trimise
              </h3>
              {loadingHistory ? (
                <p style={{ textAlign: 'center', color: '#6b7280' }}>Se încarcă...</p>
              ) : emailHistory.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
                  Niciun email trimis pentru acest proiect
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {emailHistory.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '1rem',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ color: '#1f2937' }}>{log.subiect}</strong>
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                            Către: {Array.isArray(log.destinatari) ? log.destinatari.join(', ') : log.destinatari}
                          </p>
                        </div>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          background: log.email_status === 'trimis' ? '#dcfce7' : '#fee2e2',
                          color: log.email_status === 'trimis' ? '#166534' : '#dc2626',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          {log.email_status === 'trimis' ? '✓ Trimis' : '✗ Eroare'}
                        </span>
                      </div>
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                        {formatDate(log.data_trimitere)} • {log.trimis_de_nume || 'Necunoscut'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                ← Înapoi la compunere
              </button>
            </div>
          ) : (
            // Formular compunere email
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Selectare contacte */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Destinatari
                </label>

                {loadingContacte ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Se încarcă contactele...</p>
                ) : contacte.length > 0 ? (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    padding: '1rem',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    marginBottom: '0.75rem'
                  }}>
                    {contacte.map((contact) => (
                      <label
                        key={contact.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 0.75rem',
                          background: selectedContacte.includes(contact.email) ? '#dbeafe' : 'white',
                          border: `1px solid ${selectedContacte.includes(contact.email) ? '#3b82f6' : '#d1d5db'}`,
                          borderRadius: '20px',
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedContacte.includes(contact.email)}
                          onChange={() => toggleContact(contact.email)}
                          style={{ display: 'none' }}
                        />
                        <span style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: selectedContacte.includes(contact.email) ? '#3b82f6' : '#e5e7eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '12px'
                        }}>
                          {selectedContacte.includes(contact.email) ? '✓' : ''}
                        </span>
                        <span>
                          {contact.prenume} {contact.nume}
                          {contact.rol && <span style={{ color: '#6b7280' }}> ({contact.rol})</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p style={{
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    padding: '1rem',
                    background: '#fef3c7',
                    borderRadius: '8px',
                    border: '1px solid #fcd34d',
                    marginBottom: '0.75rem'
                  }}>
                    Niciun contact salvat pentru acest client.
                    {proiect.client_email && ` Se va folosi email-ul: ${proiect.client_email}`}
                  </p>
                )}

                {/* Email-uri manuale */}
                <input
                  type="text"
                  value={emailuriManuale}
                  onChange={(e) => setEmailuriManuale(e.target.value)}
                  placeholder="Adaugă email-uri suplimentare (separate prin virgulă)"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              {/* Selectare template */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Șablon Email
                </label>
                <select
                  value={templateSelectat}
                  onChange={(e) => setTemplateSelectat(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    background: 'white'
                  }}
                >
                  {EMAIL_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.nume} - {template.descriere}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subiect */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Subiect *
                </label>
                <input
                  type="text"
                  value={subiect}
                  onChange={(e) => setSubiect(e.target.value)}
                  placeholder="Subiectul email-ului"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              {/* Conținut */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Conținut Email *
                </label>
                <textarea
                  value={continut}
                  onChange={(e) => setContinut(e.target.value)}
                  placeholder="Conținutul email-ului..."
                  rows={10}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: '1.5'
                  }}
                />
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                  Variabile disponibile: {'{{denumire_proiect}}'}, {'{{client}}'}, {'{{status}}'}, {'{{stadiu_detaliat}}'}
                </p>
              </div>

              {/* Documente Proiect - Secțiune nouă, discretă */}
              {totalDocuments > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowDocuments(!showDocuments)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: selectedDocuments.size > 0 ? '#eff6ff' : '#f9fafb',
                      border: `1px solid ${selectedDocuments.size > 0 ? '#bfdbfe' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: '#374151',
                      fontWeight: '500',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1rem' }}>📎</span>
                      Documente Proiect
                      {selectedDocuments.size > 0 && (
                        <span style={{
                          background: '#3b82f6',
                          color: 'white',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '10px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          {selectedDocuments.size} selectat{selectedDocuments.size > 1 ? 'e' : ''}
                        </span>
                      )}
                    </span>
                    <span style={{
                      transform: showDocuments ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}>
                      ▼
                    </span>
                  </button>

                  {showDocuments && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '1rem',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      {loadingDocumente ? (
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', textAlign: 'center' }}>
                          Se încarcă documentele...
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {/* Facturi */}
                          {documenteProiect.facturi.length > 0 && (
                            <div>
                              <p style={{
                                fontSize: '0.75rem',
                                color: '#6b7280',
                                marginBottom: '0.5rem',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>
                                Facturi ({documenteProiect.facturi.length})
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                                {documenteProiect.facturi.map((doc) => {
                                  const docKey = `factura:${doc.id}`;
                                  const isSelected = selectedDocuments.has(docKey);
                                  return (
                                    <button
                                      key={doc.id}
                                      type="button"
                                      onClick={() => toggleDocument(docKey)}
                                      style={{
                                        padding: '0.375rem 0.75rem',
                                        background: isSelected ? '#dbeafe' : 'white',
                                        border: `1px solid ${isSelected ? '#3b82f6' : '#d1d5db'}`,
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        color: isSelected ? '#1d4ed8' : '#374151',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        transition: 'all 0.15s ease'
                                      }}
                                      title={`${doc.label} - ${doc.data} - ${doc.valoare?.toFixed(2)} RON`}
                                    >
                                      {isSelected && <span style={{ fontSize: '0.7rem' }}>✓</span>}
                                      <span style={{ fontWeight: '500' }}>{doc.numar}</span>
                                      <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>.pdf</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Contracte */}
                          {documenteProiect.contracte.length > 0 && (
                            <div>
                              <p style={{
                                fontSize: '0.75rem',
                                color: '#6b7280',
                                marginBottom: '0.5rem',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>
                                Contracte ({documenteProiect.contracte.length})
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                                {documenteProiect.contracte.map((doc) => {
                                  const docKey = `contract:${doc.id}`;
                                  const isSelected = selectedDocuments.has(docKey);
                                  return (
                                    <button
                                      key={doc.id}
                                      type="button"
                                      onClick={() => toggleDocument(docKey)}
                                      style={{
                                        padding: '0.375rem 0.75rem',
                                        background: isSelected ? '#fef3c7' : 'white',
                                        border: `1px solid ${isSelected ? '#f59e0b' : '#d1d5db'}`,
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        color: isSelected ? '#b45309' : '#374151',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        transition: 'all 0.15s ease'
                                      }}
                                      title={`${doc.label} - ${doc.data}`}
                                    >
                                      {isSelected && <span style={{ fontSize: '0.7rem' }}>✓</span>}
                                      <span style={{ fontWeight: '500' }}>{doc.numar}</span>
                                      <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>.docx</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* PV-uri */}
                          {documenteProiect.pvuri.length > 0 && (
                            <div>
                              <p style={{
                                fontSize: '0.75rem',
                                color: '#6b7280',
                                marginBottom: '0.5rem',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>
                                Procese Verbale ({documenteProiect.pvuri.length})
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                                {documenteProiect.pvuri.map((doc) => {
                                  const docKey = `pv:${doc.id}`;
                                  const isSelected = selectedDocuments.has(docKey);
                                  return (
                                    <button
                                      key={doc.id}
                                      type="button"
                                      onClick={() => toggleDocument(docKey)}
                                      style={{
                                        padding: '0.375rem 0.75rem',
                                        background: isSelected ? '#dcfce7' : 'white',
                                        border: `1px solid ${isSelected ? '#22c55e' : '#d1d5db'}`,
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        color: isSelected ? '#15803d' : '#374151',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        transition: 'all 0.15s ease'
                                      }}
                                      title={`${doc.label} - ${doc.data}`}
                                    >
                                      {isSelected && <span style={{ fontSize: '0.7rem' }}>✓</span>}
                                      <span style={{ fontWeight: '500' }}>{doc.numar}</span>
                                      <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>.docx</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {totalDocuments === 0 && (
                            <p style={{ color: '#6b7280', fontSize: '0.875rem', textAlign: 'center' }}>
                              Niciun document disponibil pentru acest proiect
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Atașamente fișiere */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Atașamente Suplimentare
                </label>

                {/* Input fișiere ascuns */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv,.zip"
                />

                {/* Buton adăugare atașament */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    background: '#f9fafb',
                    border: '1px dashed #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    color: '#6b7280',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  + Adaugă fișier de pe calculator
                </button>

                {/* Lista atașamentelor */}
                {attachments.length > 0 && (
                  <div style={{
                    marginTop: '0.5rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.375rem'
                  }}>
                    {attachments.map((att) => (
                      <div
                        key={att.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          padding: '0.375rem 0.5rem',
                          background: '#f0f9ff',
                          border: '1px solid #bae6fd',
                          borderRadius: '6px',
                          fontSize: '0.8rem'
                        }}
                      >
                        <span style={{ color: '#0369a1', fontWeight: '500' }}>{att.name}</span>
                        <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                          ({formatFileSize(att.size)})
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.name)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0 0.25rem',
                            color: '#ef4444',
                            fontSize: '0.9rem',
                            lineHeight: 1
                          }}
                          title="Șterge"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(attachments.length > 0 || selectedDocuments.size > 0) && (
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.7rem', color: '#9ca3af' }}>
                    Total atașamente: {attachments.length + selectedDocuments.size}
                    {attachments.length > 0 && ` (${formatFileSize(getTotalAttachmentSize())} încărcat)`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showHistory && (
          <div style={{
            padding: '1rem 2rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f9fafb'
          }}>
            {/* Link discret către istoric */}
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              style={{
                padding: '0.5rem 0.75rem',
                background: 'transparent',
                color: '#6b7280',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
              title="Vezi istoricul email-urilor trimise"
            >
              <span style={{ textDecoration: 'underline' }}>Vezi istoric ({emailHistory.length})</span>
            </button>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: loading ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  boxShadow: loading ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {loading ? 'Se trimite...' : 'Trimite Email'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
