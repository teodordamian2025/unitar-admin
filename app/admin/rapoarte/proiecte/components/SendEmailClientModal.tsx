// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/SendEmailClientModal.tsx
// DATA: 29.01.2026
// DESCRIERE: Modal complet pentru trimiterea email-urilor către clienți
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
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

  // Încarcă contactele când se deschide modalul
  useEffect(() => {
    if (isOpen && proiect?.client_id) {
      loadContacte();
      loadEmailHistory();
    }
  }, [isOpen, proiect?.client_id]);

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
          trimis_de_nume: currentUser?.displayName || currentUser?.email
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Email trimis cu succes către ${result.deliveredTo?.length || 0} destinatar(i)!`);
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
              📧 Trimite Email Client
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
              📋 Istoric {emailHistory.length > 0 ? `(${emailHistory.length})` : ''}
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
                    ⚠️ Niciun contact salvat pentru acest client.
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
                  rows={12}
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
            </div>
          )}
        </div>

        {/* Footer */}
        {!showHistory && (
          <div style={{
            padding: '1.25rem 2rem',
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
              📋 <span style={{ textDecoration: 'underline' }}>Vezi istoric trimis ({emailHistory.length})</span>
            </button>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
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
                  padding: '0.75rem 1.5rem',
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
                {loading ? '⏳ Se trimite...' : '📧 Trimite Email'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
