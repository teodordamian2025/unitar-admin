// ==================================================================
// CALEA: app/admin/rapoarte/oferte/components/OfertaEmailModal.tsx
// DATA: 04.04.2026
// DESCRIERE: Modal trimitere email oferta
// ==================================================================

'use client';

import { useState, useEffect } from 'react';

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

export default function OfertaEmailModal({ isOpen, onClose, onSuccess, oferta, userId, userName }: OfertaEmailModalProps) {
  const [tipEmail, setTipEmail] = useState('oferta');
  const [subiect, setSubiect] = useState('');
  const [continut, setContinut] = useState('');
  const [destinatari, setDestinatari] = useState(oferta.client_email || '');
  const [attachDocx, setAttachDocx] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const defaults = getDefaultContent(tipEmail, oferta);
    setSubiect(defaults.subiect);
    setContinut(defaults.continut);
  }, [tipEmail]);

  const handleSend = async () => {
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
          trimis_de: userId,
          trimis_de_nume: userName
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

          {/* Atasament */}
          {tipEmail === 'oferta' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#f8f9fa', borderRadius: '8px' }}>
              <input type="checkbox" checked={attachDocx} onChange={e => setAttachDocx(e.target.checked)} id="attach-docx" />
              <label htmlFor="attach-docx" style={{ fontSize: '13px', color: '#495057', cursor: 'pointer' }}>
                Ataseaza documentul DOCX {oferta.path_fisier ? '(generat)' : '(nu exista inca - genereaza mai intai)'}
              </label>
            </div>
          )}
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
