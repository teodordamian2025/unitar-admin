// ==================================================================
// CALEA: app/admin/rapoarte/oferte/components/OfertaStatusModal.tsx
// DATA: 04.04.2026
// DESCRIERE: Modal schimbare status oferta
// ==================================================================

'use client';

import { useState } from 'react';

interface OfertaStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  oferta: { id: string; numar_oferta: string; status: string };
  userId: string;
  userName: string;
}

const STATUS_OPTIONS = [
  { value: 'Draft', label: 'Draft', color: '#666' },
  { value: 'Trimisa', label: 'Trimisa', color: '#1565c0' },
  { value: 'Acceptata', label: 'Acceptata', color: '#2e7d32' },
  { value: 'Refuzata', label: 'Refuzata', color: '#c62828' },
  { value: 'Expirata', label: 'Expirata', color: '#e65100' },
  { value: 'Negociere', label: 'Negociere', color: '#7b1fa2' },
  { value: 'Anulata', label: 'Anulata', color: '#880e4f' },
];

function showToast(message: string, type: 'success' | 'error' = 'info' as any) {
  const toast = document.createElement('div');
  const bgColors: Record<string, string> = { success: 'rgba(39, 174, 96, 0.95)', error: 'rgba(231, 76, 60, 0.95)', info: 'rgba(52, 152, 219, 0.95)' };
  toast.style.cssText = `position:fixed;top:20px;right:20px;padding:16px 24px;background:${bgColors[type]};color:white;border-radius:12px;font-size:14px;font-weight:500;z-index:70000;max-width:400px;`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 4000);
}

export default function OfertaStatusModal({ isOpen, onClose, onSuccess, oferta, userId, userName }: OfertaStatusModalProps) {
  const [statusNou, setStatusNou] = useState(oferta.status);
  const [observatii, setObservatii] = useState('');
  const [motivRefuz, setMotivRefuz] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (statusNou === oferta.status) { showToast('Selecteaza un status diferit', 'error'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/rapoarte/oferte/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oferta_id: oferta.id,
          status_nou: statusNou,
          observatii,
          motiv_refuz: statusNou === 'Refuzata' ? motivRefuz : undefined,
          schimbat_de: userId,
          schimbat_de_nume: userName
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Status schimbat la ${statusNou}`, 'success');
        onSuccess();
      } else {
        showToast(data.error || 'Eroare', 'error');
      }
    } catch { showToast('Eroare de retea', 'error'); }
    setSaving(false);
  };

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = { padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid #dee2e6', fontSize: '14px', outline: 'none', width: '100%', background: 'white' };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxWidth: '500px', width: '100%' }}>
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #eee', background: 'linear-gradient(135deg, #e67e22 0%, #f39c12 100%)', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: '700' }}>Schimba Status - {oferta.numar_oferta}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
        </div>

        <div style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#f8f9fa', borderRadius: '8px', fontSize: '14px' }}>
            Status curent: <strong>{oferta.status}</strong>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '4px', display: 'block' }}>Status nou</label>
            <select value={statusNou} onChange={e => setStatusNou(e.target.value)} style={inputStyle}>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} disabled={opt.value === oferta.status}>
                  {opt.label} {opt.value === oferta.status ? '(curent)' : ''}
                </option>
              ))}
            </select>
          </div>

          {statusNou === 'Refuzata' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '4px', display: 'block' }}>Motiv refuz</label>
              <textarea value={motivRefuz} onChange={e => setMotivRefuz(e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' as const }} placeholder="De ce a fost refuzata oferta?" />
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '4px', display: 'block' }}>Observatii</label>
            <textarea value={observatii} onChange={e => setObservatii(e.target.value)} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' as const }} placeholder="Observatii optionale..." />
          </div>
        </div>

        <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button onClick={onClose} style={{ padding: '0.7rem 1.5rem', borderRadius: '10px', border: '1px solid #dee2e6', background: 'white', color: '#495057', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Anuleaza
          </button>
          <button onClick={handleSubmit} disabled={saving || statusNou === oferta.status} style={{
            padding: '0.7rem 2rem', borderRadius: '10px', border: 'none',
            background: (saving || statusNou === oferta.status) ? '#ccc' : 'linear-gradient(135deg, #e67e22 0%, #f39c12 100%)',
            color: 'white', fontSize: '14px', fontWeight: '600', cursor: (saving || statusNou === oferta.status) ? 'not-allowed' : 'pointer'
          }}>
            {saving ? 'Se salveaza...' : 'Schimba Status'}
          </button>
        </div>
      </div>
    </div>
  );
}
