// ==================================================================
// CALEA: app/projects/components/UserProiectNouModal.tsx
// DATA: 21.09.2025 17:15 (ora României)
// DESCRIERE: Modal creare proiect pentru utilizatori normali cu restricții financiare
// FUNCȚIONALITATE: DOAR câmpuri non-financiare, valori financiare automat zero în backend
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';

interface UserProiectNouModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProiectCreated: () => void;
}

interface FormData {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Adresa: string;
  Descriere: string;
  Data_Start: string;
  Data_Final: string;
  Status: string;
  status_predare: string;
  status_contract: string;
  Responsabil: string;
  Observatii: string;
}

export default function UserProiectNouModal({ isOpen, onClose, onProiectCreated }: UserProiectNouModalProps) {
  const [formData, setFormData] = useState<FormData>({
    ID_Proiect: '',
    Denumire: '',
    Client: '',
    Adresa: '',
    Descriere: '',
    Data_Start: '',
    Data_Final: '',
    Status: 'Activ',
    status_predare: 'Nepredat',
    status_contract: 'Nu e cazul',
    Responsabil: '',
    Observatii: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Reset form când se deschide modal
      setFormData({
        ID_Proiect: '',
        Denumire: '',
        Client: '',
        Adresa: '',
        Descriere: '',
        Data_Start: '',
        Data_Final: '',
        Status: 'Activ',
        status_predare: 'Nepredat',
        status_contract: 'Nu e cazul',
        Responsabil: '',
        Observatii: ''
      });

      // Generare ID proiect automat
      generateProjectId();
    }
  }, [isOpen]);

  const generateProjectId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const time = now.getTime().toString().slice(-4);

    const projectId = `PRJ-${year}${month}${day}-${time}`;
    setFormData(prev => ({ ...prev, ID_Proiect: projectId }));
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    // Validări de bază
    if (!formData.ID_Proiect.trim()) {
      toast.error('ID Proiect este obligatoriu!');
      return;
    }
    if (!formData.Denumire.trim()) {
      toast.error('Denumirea proiectului este obligatorie!');
      return;
    }
    if (!formData.Client.trim()) {
      toast.error('Clientul este obligatoriu!');
      return;
    }

    try {
      setIsSubmitting(true);

      console.log('📤 Submitting user project:', formData);

      const response = await fetch('/api/user/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Eroare la crearea proiectului');
      }

      console.log('✅ User project created successfully');
      toast.success('Proiect creat cu succes!');
      onProiectCreated();

    } catch (error) {
      console.error('❌ Error creating user project:', error);
      toast.error(error instanceof Error ? error.message : 'Eroare la crearea proiectului!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: '1rem'
      }}
      onClick={handleBackdropClick}
    >
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '2rem',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid rgba(229, 231, 235, 0.3)'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 0.5rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              📋 Proiect Nou
            </h2>
            <p style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              margin: 0
            }}>
              Creează un proiect nou (fără informații financiare)
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#dc2626',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              padding: '0.5rem',
              cursor: 'pointer',
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Info note pentru utilizatori normali */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '2rem',
          fontSize: '0.875rem',
          color: '#065f46',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem'
        }}>
          <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>💰</span>
          <div>
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
              Restricții pentru utilizatori normali
            </div>
            <div>
              Câmpurile financiare (valoare, monedă, facturare, achitare) sunt gestionate automat de sistem.
              Proiectul va fi creat cu valoare 0 RON și status-uri financiare "Nu se aplică".
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {/* ID Proiect */}
            <div>
              <label style={labelStyle}>
                🆔 ID Proiect *
              </label>
              <input
                type="text"
                value={formData.ID_Proiect}
                onChange={(e) => handleInputChange('ID_Proiect', e.target.value)}
                style={inputStyle}
                placeholder="PRJ-20250921-1234"
                required
              />
            </div>

            {/* Denumire */}
            <div>
              <label style={labelStyle}>
                📝 Denumire Proiect *
              </label>
              <input
                type="text"
                value={formData.Denumire}
                onChange={(e) => handleInputChange('Denumire', e.target.value)}
                style={inputStyle}
                placeholder="Numele proiectului..."
                required
              />
            </div>

            {/* Client */}
            <div>
              <label style={labelStyle}>
                🏢 Client *
              </label>
              <input
                type="text"
                value={formData.Client}
                onChange={(e) => handleInputChange('Client', e.target.value)}
                style={inputStyle}
                placeholder="Numele clientului..."
                required
              />
            </div>

            {/* Adresa */}
            <div>
              <label style={labelStyle}>
                📍 Adresa
              </label>
              <input
                type="text"
                value={formData.Adresa}
                onChange={(e) => handleInputChange('Adresa', e.target.value)}
                style={inputStyle}
                placeholder="Adresa proiectului..."
              />
            </div>

            {/* Data Start */}
            <div>
              <label style={labelStyle}>
                📅 Data Început
              </label>
              <input
                type="date"
                value={formData.Data_Start}
                onChange={(e) => handleInputChange('Data_Start', e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Data Final */}
            <div>
              <label style={labelStyle}>
                🏁 Data Final
              </label>
              <input
                type="date"
                value={formData.Data_Final}
                onChange={(e) => handleInputChange('Data_Final', e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Status */}
            <div>
              <label style={labelStyle}>
                📊 Status Proiect
              </label>
              <select
                value={formData.Status}
                onChange={(e) => handleInputChange('Status', e.target.value)}
                style={inputStyle}
              >
                <option value="Activ">🟢 Activ</option>
                <option value="Suspendat">⏸️ Suspendat</option>
                <option value="Finalizat">✅ Finalizat</option>
                <option value="Anulat">❌ Anulat</option>
              </select>
            </div>

            {/* Status Predare */}
            <div>
              <label style={labelStyle}>
                📦 Status Predare
              </label>
              <select
                value={formData.status_predare}
                onChange={(e) => handleInputChange('status_predare', e.target.value)}
                style={inputStyle}
              >
                <option value="Nepredat">⏳ Nepredat</option>
                <option value="Predat">📦 Predat</option>
              </select>
            </div>

            {/* Responsabil */}
            <div>
              <label style={labelStyle}>
                👤 Responsabil
              </label>
              <input
                type="text"
                value={formData.Responsabil}
                onChange={(e) => handleInputChange('Responsabil', e.target.value)}
                style={inputStyle}
                placeholder="Numele responsabilului..."
              />
            </div>
          </div>

          {/* Descriere - full width */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={labelStyle}>
              📄 Descriere Proiect
            </label>
            <textarea
              value={formData.Descriere}
              onChange={(e) => handleInputChange('Descriere', e.target.value)}
              style={{
                ...inputStyle,
                minHeight: '100px',
                resize: 'vertical'
              }}
              placeholder="Descrierea detaliată a proiectului..."
            />
          </div>

          {/* Observatii - full width */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={labelStyle}>
              📝 Observații
            </label>
            <textarea
              value={formData.Observatii}
              onChange={(e) => handleInputChange('Observatii', e.target.value)}
              style={{
                ...inputStyle,
                minHeight: '80px',
                resize: 'vertical'
              }}
              placeholder="Observații suplimentare..."
            />
          </div>

          {/* Sectiune financiara blocked */}
          <div style={{
            background: 'rgba(229, 231, 235, 0.3)',
            border: '2px dashed rgba(156, 163, 175, 0.5)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem',
            textAlign: 'center',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#dc2626',
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              🔒 BLOCAT
            </div>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💰</div>
            <div style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#6b7280',
              marginBottom: '0.5rem'
            }}>
              Secțiune Financiară
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: '#9ca3af'
            }}>
              Valorile financiare sunt gestionate automat:<br/>
              • Valoare: 0 RON<br/>
              • Status facturare: "Nu se aplică"<br/>
              • Status achitare: "Nu se aplică"
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(229, 231, 235, 0.3)'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: 'rgba(107, 114, 128, 0.1)',
                color: '#374151',
                border: '1px solid rgba(107, 114, 128, 0.2)',
                borderRadius: '12px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: isSubmitting ? 0.5 : 1
              }}
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: isSubmitting
                  ? 'rgba(107, 114, 128, 0.3)'
                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: isSubmitting ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Se creează...
                </>
              ) : (
                <>
                  <span>💾</span>
                  Creează Proiect
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Stiluri constante
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: '600',
  color: '#374151',
  marginBottom: '0.5rem'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  border: '1px solid rgba(209, 213, 219, 0.5)',
  borderRadius: '8px',
  fontSize: '0.875rem',
  background: 'rgba(255, 255, 255, 0.8)',
  backdropFilter: 'blur(4px)',
  transition: 'all 0.2s ease'
};