// ==================================================================
// CALEA: app/admin/rapoarte/oferte/components/OfertaEmailModal.tsx
// DATA: 08.04.2026
// DESCRIERE: Modal trimitere email oferta
// ACTUALIZAT: Adaugat atasare PDF, upload fisiere din calculator, fix DOCX
// ==================================================================

'use client';

import { useState, useEffect, useRef } from 'react';

interface ManualAttachment {
  name: string;
  size: number;
  type: string;
  content: string; // base64
}

interface OfertaEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  oferta: {
    id: string;
    numar_oferta: string;
    client_nume: string;
    client_email: string;
    proiect_denumire: string;
    valoare: number;
    moneda: string;
    path_fisier: string;
    status: string;
  };
  userId: string;
  userName: string;
}

const EMAIL_TYPES = [
  { value: 'oferta', label: 'Trimitere Oferta', icon: '&#128196;' },
  { value: 'followup', label: 'Amintire / Follow-up', icon: '&#128276;' },
  { value: 'multumire', label: 'Multumire', icon: '&#128588;' },
];

function showToast(message: string, type: 'success' | 'error' = 'info' as any) {
  const toast = document.createElement('div');
  const bgColors: Record<string, string> = { success: 'rgba(39, 174, 96, 0.95)', error: 'rgba(231, 76, 60, 0.95)', info: 'rgba(52, 152, 219, 0.95)' };
  toast.style.cssText = `position:fixed;top:20px;right:20px;padding:16px 24px;background:${bgColors[type]};color:white;border-radius:12px;font-size:14px;font-weight:500;z-index:70000;max-width:400px;`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 4000);
}

function getDefaultContent(tipEmail: string, oferta: OfertaEmailModalProps['oferta']): { subiect: string; continut: string } {
  const valoareStr = oferta.valoare ? `${oferta.valoare.toLocaleString('ro-RO')} ${oferta.moneda || 'EUR'}` : '';

  switch (tipEmail) {
    case 'oferta':
      return {
        subiect: `Oferta ${oferta.numar_oferta} - ${oferta.proiect_denumire} | UNITAR PROIECT`,
        continut: `Stimate ${oferta.client_nume},\n\nVa transmitem atasat oferta noastra ${oferta.numar_oferta} pentru ${oferta.proiect_denumire}${valoareStr ? `, in valoare de ${valoareStr} + TVA` : ''}.\n\nOferta este valabila 30 de zile de la data emiterii.\n\nRamanem la dispozitia dumneavoastra pentru orice informatii suplimentare.\n\nCu stima,\nUNITAR PROIECT TDA SRL\nTel: 0765 486 044\nEmail: contact@unitarproiect.eu`
      };
    case 'followup':
      return {
        subiect: `Re: Oferta ${oferta.numar_oferta} - Solicitare raspuns | UNITAR PROIECT`,
        continut: `Stimate ${oferta.client_nume},\n\nRevenim cu referire la oferta noastra ${oferta.numar_oferta} transmisa anterior pentru ${oferta.proiect_denumire}.\n\nDorim sa va intrebam daca ati avut ocazia sa analizati oferta si daca aveti intrebari suplimentare.\n\nSuntem disponibili pentru o intalnire sau un apel telefonic pentru a discuta detaliile.\n\nCu stima,\nUNITAR PROIECT TDA SRL\nTel: 0765 486 044`
      };
    case 'multumire':
      return {
        subiect: `Multumiri pentru colaborare - ${oferta.proiect_denumire} | UNITAR PROIECT`,
        continut: `Stimate ${oferta.client_nume},\n\nVa multumim pentru increderea acordata si pentru acceptarea ofertei ${oferta.numar_oferta}.\n\nNe face placere sa colaboram cu dumneavoastra si va asiguram de toata atentia noastra pentru realizarea proiectului ${oferta.proiect_denumire}.\n\nUn coleg din echipa noastra va va contacta in curand pentru urmatoarele etape.\n\nCu stima,\nUNITAR PROIECT TDA SRL`
      };
    default:
      return { subiect: '', continut: '' };
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function OfertaEmailModal({ isOpen, onClose, onSuccess, oferta, userId, userName }: OfertaEmailModalProps) {
  const [tipEmail, setTipEmail] = useState('oferta');
  const [subiect, setSubiect] = useState('');
  const [continut, setContinut] = useState('');
  const [destinatari, setDestinatari] = useState(oferta.client_email || '');
  const [attachDocx, setAttachDocx] = useState(false);
  const [attachPdf, setAttachPdf] = useState(true);
  const [fromAddress, setFromAddress] = useState('');
  const [sending, setSending] = useState(false);
  const [manualAttachments, setManualAttachments] = useState<ManualAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
  const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total

  useEffect(() => {
    const defaults = getDefaultContent(tipEmail, oferta);
    setSubiect(defaults.subiect);
    setContinut(defaults.continut);
  }, [tipEmail]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const currentTotalSize = manualAttachments.reduce((sum, att) => sum + att.size, 0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > MAX_FILE_SIZE) {
        showToast(`Fisierul "${file.name}" depaseste limita de 10MB`, 'error');
        continue;
      }

      if (currentTotalSize + file.size > MAX_TOTAL_SIZE) {
        showToast('Dimensiunea totala a atasamentelor depaseste 25MB', 'error');
        break;
      }

      if (manualAttachments.some(att => att.name === file.name)) {
        showToast(`Fisierul "${file.name}" exista deja`, 'error');
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        setManualAttachments(prev => [...prev, {
          name: file.name,
          size: file.size,
          type: file.type,
          content: base64
        }]);
      } catch {
        showToast(`Eroare la incarcarea fisierului "${file.name}"`, 'error');
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setManualAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!fromAddress) { showToast('Selecteaza adresa expeditor', 'error'); return; }
    const emailList = destinatari.split(/[,;\s]+/).filter(e => e.includes('@'));
    if (emailList.length === 0) { showToast('Adauga cel putin un email valid', 'error'); return; }
    if (!subiect.trim()) { showToast('Subiectul este obligatoriu', 'error'); return; }
    if (!continut.trim()) { showToast('Continutul este obligatoriu', 'error'); return; }

    setSending(true);
    try {
      const res = await fetch('/api/rapoarte/oferte/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oferta_id: oferta.id,
          tip_email: tipEmail,
          subiect: subiect.trim(),
          continut: continut.trim(),
          destinatari: emailList,
          attach_docx: attachDocx && tipEmail === 'oferta',
          attach_pdf: attachPdf && tipEmail === 'oferta',
          manual_attachments: manualAttachments.length > 0 ? manualAttachments : undefined,
          trimis_de: userId,
          trimis_de_nume: userName,
          from_address: fromAddress
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Email trimis cu succes', 'success');
        onSuccess();
      } else {
        showToast(data.error || 'Eroare la trimitere', 'error');
      }
    } catch { showToast('Eroare de retea', 'error'); }
    setSending(false);
  };

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = { padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid #dee2e6', fontSize: '14px', outline: 'none', width: '100%', background: 'white' };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto' as const }}>
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #eee', background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: '700' }}>Trimite Email - {oferta.numar_oferta}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
        </div>

        <div style={{ padding: '2rem' }}>
          {/* Tip email */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {EMAIL_TYPES.map(type => (
              <button
                key={type.value}
                onClick={() => setTipEmail(type.value)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: tipEmail === type.value ? '2px solid #3498db' : '1px solid #dee2e6',
                  background: tipEmail === type.value ? '#e3f2fd' : 'white',
                  color: tipEmail === type.value ? '#1565c0' : '#495057',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textAlign: 'center' as const,
                  transition: 'all 0.2s'
                }}
              >
                <span dangerouslySetInnerHTML={{ __html: type.icon }} /> {type.label}
              </button>
            ))}
          </div>

          {/* Expeditor */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '6px', display: 'block' }}>Trimite de pe adresa *</label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {[
                { value: 'office@unitarproiect.eu', label: 'office@unitarproiect.eu' },
                { value: 'contact@unitarproiect.eu', label: 'contact@unitarproiect.eu' }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFromAddress(opt.value)}
                  style={{
                    flex: 1,
                    padding: '0.6rem 1rem',
                    borderRadius: '10px',
                    border: fromAddress === opt.value ? '2px solid #3498db' : '1px solid #dee2e6',
                    background: fromAddress === opt.value ? '#e3f2fd' : 'white',
                    color: fromAddress === opt.value ? '#1565c0' : '#495057',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {!fromAddress && <span style={{ fontSize: '11px', color: '#e74c3c', marginTop: '4px', display: 'block' }}>Selecteaza adresa expeditor</span>}
          </div>

          {/* Destinatari */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '4px', display: 'block' }}>Destinatari (separat prin virgula)</label>
            <input type="text" value={destinatari} onChange={e => setDestinatari(e.target.value)} style={inputStyle} placeholder="email1@client.ro, email2@client.ro" />
          </div>

          {/* Subiect */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '4px', display: 'block' }}>Subiect</label>
            <input type="text" value={subiect} onChange={e => setSubiect(e.target.value)} style={inputStyle} />
          </div>

          {/* Continut */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '4px', display: 'block' }}>Continut email</label>
            <textarea value={continut} onChange={e => setContinut(e.target.value)} style={{ ...inputStyle, minHeight: '200px', resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: '1.6' }} />
          </div>

          {/* Atasamente documente oferta */}
          {tipEmail === 'oferta' && (
            <div style={{ padding: '0.75rem 1rem', background: '#f8f9fa', borderRadius: '8px', marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '8px', display: 'block' }}>Atasamente document oferta</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={attachPdf} onChange={e => setAttachPdf(e.target.checked)} id="attach-pdf" />
                  <label htmlFor="attach-pdf" style={{ fontSize: '13px', color: '#495057', cursor: 'pointer' }}>
                    Ataseaza oferta PDF (se genereaza automat)
                  </label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={attachDocx} onChange={e => setAttachDocx(e.target.checked)} id="attach-docx" />
                  <label htmlFor="attach-docx" style={{ fontSize: '13px', color: '#495057', cursor: 'pointer' }}>
                    Ataseaza oferta DOCX (se genereaza automat)
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Upload fisiere din calculator */}
          <div style={{ padding: '0.75rem 1rem', background: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d' }}>Alte atasamente</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '4px 12px', borderRadius: '6px', border: '1px solid #3498db',
                  background: '#e3f2fd', color: '#1565c0', fontSize: '12px', fontWeight: '600',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                + Adauga fisier
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv,.zip"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
            {manualAttachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {manualAttachments.map((att, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', background: 'white', borderRadius: '6px', border: '1px solid #e0e0e0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px' }}>
                        {att.type.includes('pdf') ? '\uD83D\uDCC4' : att.type.includes('image') ? '\uD83D\uDDBC' : '\uD83D\uDCC1'}
                      </span>
                      <span style={{ fontSize: '12px', color: '#2c3e50' }}>{att.name}</span>
                      <span style={{ fontSize: '11px', color: '#95a5a6' }}>({formatFileSize(att.size)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      style={{
                        padding: '2px 6px', background: 'none', border: 'none',
                        color: '#e74c3c', fontSize: '14px', cursor: 'pointer'
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            {manualAttachments.length === 0 && (
              <div style={{ fontSize: '12px', color: '#95a5a6', fontStyle: 'italic' }}>
                Niciun fisier atasat manual. Accepta: PDF, DOC, DOCX, XLS, XLSX, imagini, TXT, CSV, ZIP (max 10MB/fisier)
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button onClick={onClose} style={{ padding: '0.7rem 1.5rem', borderRadius: '10px', border: '1px solid #dee2e6', background: 'white', color: '#495057', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Anuleaza
          </button>
          <button onClick={handleSend} disabled={sending} style={{
            padding: '0.7rem 2rem', borderRadius: '10px', border: 'none',
            background: sending ? '#ccc' : 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
            color: 'white', fontSize: '14px', fontWeight: '600', cursor: sending ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(52, 152, 219, 0.3)'
          }}>
            {sending ? 'Se trimite...' : 'Trimite Email'}
          </button>
        </div>
      </div>
    </div>
  );
}
