// ==================================================================
// CALEA: app/admin/rapoarte/oferte/components/OfertaModal.tsx
// DATA: 04.04.2026
// DESCRIERE: Modal creare/editare oferta
// ==================================================================

'use client';

import { useState, useEffect } from 'react';

interface Oferta {
  id: string;
  numar_oferta: string;
  tip_oferta: string;
  client_id: string;
  client_nume: string;
  client_email: string;
  client_telefon: string;
  client_cui: string;
  client_adresa: string;
  proiect_denumire: string;
  proiect_descriere: string;
  proiect_adresa: string;
  valoare: number;
  moneda: string;
  curs_valutar: number;
  valoare_ron: number;
  data_expirare: any;
  observatii: string;
  note_interne: string;
  termen_executie: string;
}

interface OfertaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  oferta?: Oferta;
  userId: string;
  userName: string;
}

const TIP_OPTIONS = [
  { value: '', label: 'Selecteaza tipul ofertei' },
  { value: 'consolidari', label: 'Consolidari' },
  { value: 'constructii_noi', label: 'Constructii Noi' },
  { value: 'expertiza_monument', label: 'Expertiza Monument' },
  { value: 'expertiza_tehnica', label: 'Expertiza Tehnica' },
  { value: 'statie_electrica', label: 'Statie Electrica' },
];

const MONEDA_OPTIONS = ['EUR', 'RON', 'USD'];

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const toast = document.createElement('div');
  const bgColors = { success: 'rgba(39, 174, 96, 0.95)', error: 'rgba(231, 76, 60, 0.95)', info: 'rgba(52, 152, 219, 0.95)' };
  toast.style.cssText = `position:fixed;top:20px;right:20px;padding:16px 24px;background:${bgColors[type]};color:white;border-radius:12px;font-size:14px;font-weight:500;z-index:70000;backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,0.2);max-width:400px;`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 4000);
}

function formatDateInput(dateVal: any): string {
  if (!dateVal) return '';
  const val = dateVal?.value || dateVal;
  if (typeof val === 'string') {
    if (val.match(/^\d{4}-\d{2}-\d{2}/)) return val.substring(0, 10);
    return val;
  }
  return '';
}

export default function OfertaModal({ isOpen, onClose, onSuccess, oferta, userId, userName }: OfertaModalProps) {
  const isEdit = !!oferta;

  const [form, setForm] = useState({
    tip_oferta: oferta?.tip_oferta || '',
    client_id: oferta?.client_id || '',
    client_nume: oferta?.client_nume || '',
    client_email: oferta?.client_email || '',
    client_telefon: oferta?.client_telefon || '',
    client_cui: oferta?.client_cui || '',
    client_adresa: oferta?.client_adresa || '',
    proiect_denumire: oferta?.proiect_denumire || '',
    proiect_descriere: oferta?.proiect_descriere || '',
    proiect_adresa: oferta?.proiect_adresa || '',
    valoare: oferta?.valoare || 0,
    moneda: oferta?.moneda || 'EUR',
    curs_valutar: oferta?.curs_valutar || 0,
    valoare_ron: oferta?.valoare_ron || 0,
    data_expirare: formatDateInput(oferta?.data_expirare) || '',
    observatii: oferta?.observatii || '',
    note_interne: oferta?.note_interne || '',
    termen_executie: oferta?.termen_executie || '',
  });

  const [saving, setSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Client autocomplete
  useEffect(() => {
    if (clientSearch.length < 2) { setClientSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/rapoarte/clienti?search=${encodeURIComponent(clientSearch)}`);
        const data = await res.json();
        setClientSuggestions(data.data || data || []);
        setShowSuggestions(true);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const selectClient = (client: any) => {
    setForm(prev => ({
      ...prev,
      client_id: client.id,
      client_nume: client.nume || '',
      client_email: client.email || '',
      client_telefon: client.telefon || '',
      client_cui: client.cui || '',
      client_adresa: client.adresa || '',
    }));
    setClientSearch('');
    setShowSuggestions(false);
  };

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.client_nume.trim()) { showToast('Numele clientului este obligatoriu', 'error'); return; }
    if (!form.proiect_denumire.trim()) { showToast('Denumirea proiectului este obligatorie', 'error'); return; }
    if (!form.valoare || form.valoare <= 0) { showToast('Valoarea ofertei este obligatorie', 'error'); return; }

    setSaving(true);
    try {
      const url = '/api/rapoarte/oferte';
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? { id: oferta!.id, ...form } : { ...form, creat_de: userId, creat_de_nume: userName };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.success) {
        showToast(isEdit ? 'Oferta actualizata cu succes' : `Oferta ${data.data?.numar_oferta || ''} creata cu succes`, 'success');
        onSuccess();
      } else {
        showToast(data.error || 'Eroare la salvare', 'error');
      }
    } catch { showToast('Eroare de retea', 'error'); }
    setSaving(false);
  };

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = {
    padding: '0.6rem 1rem',
    borderRadius: '10px',
    border: '1px solid #dee2e6',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    background: 'white',
    transition: 'border-color 0.2s'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: '600',
    color: '#7f8c8d',
    marginBottom: '4px',
    display: 'block'
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 50000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto' as const
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem 2rem',
          borderBottom: '1px solid #eee',
          background: 'linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%)',
          borderRadius: '20px 20px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: '700' }}>
            {isEdit ? `Editeaza Oferta ${oferta?.numar_oferta}` : 'Oferta Noua'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: '4px 8px' }}>&times;</button>
        </div>

        {/* Content */}
        <div style={{ padding: '2rem' }}>
          {/* Tip oferta */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>Tip Oferta (sablon)</label>
            <select value={form.tip_oferta} onChange={e => handleChange('tip_oferta', e.target.value)} style={inputStyle}>
              {TIP_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          {/* Client section */}
          <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>Date Client</h3>

            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={labelStyle}>Cauta client existent</label>
              <input
                type="text"
                placeholder="Cauta dupa nume, CUI, email..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                onFocus={() => clientSuggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                style={inputStyle}
              />
              {showSuggestions && clientSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, background: 'white',
                  border: '1px solid #dee2e6', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', zIndex: 51000, boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  {clientSuggestions.slice(0, 10).map((c: any) => (
                    <div key={c.id}
                      onClick={() => selectClient(c)}
                      style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: '14px' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                    >
                      <div style={{ fontWeight: '500' }}>{c.nume}</div>
                      <div style={{ fontSize: '12px', color: '#95a5a6' }}>{c.cui} | {c.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Nume client *</label>
                <input type="text" value={form.client_nume} onChange={e => handleChange('client_nume', e.target.value)} style={inputStyle} placeholder="Numele clientului" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={form.client_email} onChange={e => handleChange('client_email', e.target.value)} style={inputStyle} placeholder="email@client.ro" />
              </div>
              <div>
                <label style={labelStyle}>Telefon</label>
                <input type="text" value={form.client_telefon} onChange={e => handleChange('client_telefon', e.target.value)} style={inputStyle} placeholder="07xx xxx xxx" />
              </div>
              <div>
                <label style={labelStyle}>CUI</label>
                <input type="text" value={form.client_cui} onChange={e => handleChange('client_cui', e.target.value)} style={inputStyle} placeholder="RO12345678" />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Adresa</label>
                <input type="text" value={form.client_adresa} onChange={e => handleChange('client_adresa', e.target.value)} style={inputStyle} placeholder="Adresa clientului" />
              </div>
            </div>
          </div>

          {/* Proiect section */}
          <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>Detalii Proiect / Oferta</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Denumire proiect / oferta *</label>
                <input type="text" value={form.proiect_denumire} onChange={e => handleChange('proiect_denumire', e.target.value)} style={inputStyle} placeholder="Ex: Expertiza tehnica cladire str. Victoriei nr. 10" />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Descriere</label>
                <textarea value={form.proiect_descriere} onChange={e => handleChange('proiect_descriere', e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' as const }} placeholder="Descriere detaliata a lucrarilor..." />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Adresa proiect</label>
                <input type="text" value={form.proiect_adresa} onChange={e => handleChange('proiect_adresa', e.target.value)} style={inputStyle} placeholder="Adresa locatiei" />
              </div>
            </div>
          </div>

          {/* Financiar section */}
          <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>Date Financiare</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Valoare *</label>
                <input type="number" value={form.valoare || ''} onChange={e => handleChange('valoare', parseFloat(e.target.value) || 0)} style={inputStyle} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div>
                <label style={labelStyle}>Moneda</label>
                <select value={form.moneda} onChange={e => handleChange('moneda', e.target.value)} style={inputStyle}>
                  {MONEDA_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Termen executie</label>
                <input type="text" value={form.termen_executie} onChange={e => handleChange('termen_executie', e.target.value)} style={inputStyle} placeholder="Ex: 30 zile lucratoare" />
              </div>
              <div>
                <label style={labelStyle}>Data expirare oferta</label>
                <input type="date" value={form.data_expirare} onChange={e => handleChange('data_expirare', e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Observatii */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={labelStyle}>Observatii (vizibile client)</label>
              <textarea value={form.observatii} onChange={e => handleChange('observatii', e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' as const }} placeholder="Observatii pentru oferta..." />
            </div>
            <div>
              <label style={labelStyle}>Note interne</label>
              <textarea value={form.note_interne} onChange={e => handleChange('note_interne', e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' as const }} placeholder="Note interne (nu apar in oferta)..." />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.5rem 2rem',
          borderTop: '1px solid #eee',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '1rem'
        }}>
          <button onClick={onClose} style={{
            padding: '0.7rem 1.5rem', borderRadius: '10px', border: '1px solid #dee2e6',
            background: 'white', color: '#495057', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
          }}>
            Anuleaza
          </button>
          <button onClick={handleSubmit} disabled={saving} style={{
            padding: '0.7rem 2rem', borderRadius: '10px', border: 'none',
            background: saving ? '#ccc' : 'linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%)',
            color: 'white', fontSize: '14px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(142, 68, 173, 0.3)'
          }}>
            {saving ? 'Se salveaza...' : (isEdit ? 'Salveaza Modificarile' : 'Creeaza Oferta')}
          </button>
        </div>
      </div>
    </div>
  );
}
