// ==================================================================
// CALEA: app/admin/rapoarte/clienti/components/ClientContacteSection.tsx
// DATA: 29.01.2026
// DESCRIERE: Secțiune pentru gestionarea contactelor clienți (email notificări)
// ==================================================================

'use client';

import { useState, useEffect } from 'react';

interface Contact {
  id?: string;
  prenume: string;
  nume: string;
  email: string;
  telefon: string;
  rol: string;
  comentariu: string;
  primeste_notificari: boolean;
}

interface ClientContacteSectionProps {
  clientId?: string; // Dacă există, încarcă contactele din DB
  contacte: Contact[];
  setContacte: (contacte: Contact[]) => void;
  disabled?: boolean;
}

const emptyContact: Contact = {
  prenume: '',
  nume: '',
  email: '',
  telefon: '',
  rol: '',
  comentariu: '',
  primeste_notificari: true
};

export default function ClientContacteSection({
  clientId,
  contacte,
  setContacte,
  disabled = false
}: ClientContacteSectionProps) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Încarcă contactele din DB dacă există clientId
  useEffect(() => {
    if (clientId) {
      loadContacte();
    }
  }, [clientId]);

  const loadContacte = async () => {
    if (!clientId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/rapoarte/clienti/contacte?client_id=${encodeURIComponent(clientId)}`);
      const result = await response.json();

      if (result.success && result.data) {
        setContacte(result.data.map((c: any) => ({
          id: c.id,
          prenume: c.prenume || '',
          nume: c.nume || '',
          email: c.email || '',
          telefon: c.telefon || '',
          rol: c.rol || '',
          comentariu: c.comentariu || '',
          primeste_notificari: c.primeste_notificari !== false
        })));
        if (result.data.length > 0) {
          setExpanded(true);
        }
      }
    } catch (error) {
      console.error('Eroare la încărcarea contactelor:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = () => {
    setContacte([...contacte, { ...emptyContact }]);
    setExpanded(true);
  };

  const handleRemoveContact = (index: number) => {
    const newContacte = [...contacte];
    newContacte.splice(index, 1);
    setContacte(newContacte);
  };

  const handleContactChange = (index: number, field: keyof Contact, value: string | boolean) => {
    const newContacte = [...contacte];
    newContacte[index] = {
      ...newContacte[index],
      [field]: value
    };
    setContacte(newContacte);
  };

  return (
    <div style={{
      marginTop: '1.5rem',
      border: '1px solid #e0e0e0',
      borderRadius: '12px',
      overflow: 'hidden'
    }}>
      {/* Header cu toggle */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '1rem 1.5rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>📧</span>
          <div>
            <h4 style={{ margin: 0, color: 'white', fontSize: '1rem', fontWeight: '600' }}>
              Contacte pentru Notificări Email
            </h4>
            <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
              {contacte.length === 0
                ? 'Niciun contact adăugat'
                : `${contacte.length} contact${contacte.length === 1 ? '' : 'e'} pentru email-uri`}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAddContact();
              }}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              ➕ Adaugă Contact
            </button>
          )}
          <span style={{
            color: 'white',
            fontSize: '1.25rem',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease'
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Lista contacte (expandable) */}
      {expanded && (
        <div style={{ padding: '1.5rem', background: '#f8f9fa' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>
              ⏳ Se încarcă contactele...
            </div>
          ) : contacte.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#6c757d',
              background: 'white',
              borderRadius: '8px',
              border: '1px dashed #dee2e6'
            }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '14px' }}>
                Niciun contact adăugat. Adaugă persoane care vor primi notificări email despre facturi, proiecte, etc.
              </p>
              {!disabled && (
                <button
                  type="button"
                  onClick={handleAddContact}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}
                >
                  ➕ Adaugă Primul Contact
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {contacte.map((contact, index) => (
                <div
                  key={contact.id || index}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    border: '1px solid #e0e0e0',
                    padding: '1.25rem',
                    position: 'relative'
                  }}
                >
                  {/* Header contact cu buton ștergere */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}>
                        {index + 1}
                      </span>
                      <span style={{ fontWeight: '600', color: '#2c3e50', fontSize: '14px' }}>
                        Contact #{index + 1}
                        {contact.nume && ` - ${contact.prenume ? `${contact.prenume} ` : ''}${contact.nume}`}
                      </span>
                    </div>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(index)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          background: '#fee2e2',
                          color: '#dc2626',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        🗑️ Șterge
                      </button>
                    )}
                  </div>

                  {/* Câmpuri contact */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem'
                  }}>
                    {/* Prenume */}
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '0.35rem',
                        fontWeight: '500',
                        color: '#4b5563',
                        fontSize: '13px'
                      }}>
                        Prenume
                      </label>
                      <input
                        type="text"
                        value={contact.prenume}
                        onChange={(e) => handleContactChange(index, 'prenume', e.target.value)}
                        disabled={disabled}
                        placeholder="Ion"
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    {/* Nume */}
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '0.35rem',
                        fontWeight: '500',
                        color: '#4b5563',
                        fontSize: '13px'
                      }}>
                        Nume *
                      </label>
                      <input
                        type="text"
                        value={contact.nume}
                        onChange={(e) => handleContactChange(index, 'nume', e.target.value)}
                        disabled={disabled}
                        placeholder="Popescu"
                        required
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '0.35rem',
                        fontWeight: '500',
                        color: '#4b5563',
                        fontSize: '13px'
                      }}>
                        Email *
                      </label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => handleContactChange(index, 'email', e.target.value)}
                        disabled={disabled}
                        placeholder="ion.popescu@exemplu.ro"
                        required
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    {/* Telefon */}
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '0.35rem',
                        fontWeight: '500',
                        color: '#4b5563',
                        fontSize: '13px'
                      }}>
                        Telefon
                      </label>
                      <input
                        type="tel"
                        value={contact.telefon}
                        onChange={(e) => handleContactChange(index, 'telefon', e.target.value)}
                        disabled={disabled}
                        placeholder="0721 123 456"
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    {/* Rol */}
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '0.35rem',
                        fontWeight: '500',
                        color: '#4b5563',
                        fontSize: '13px'
                      }}>
                        Rol
                      </label>
                      <select
                        value={contact.rol}
                        onChange={(e) => handleContactChange(index, 'rol', e.target.value)}
                        disabled={disabled}
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          background: 'white'
                        }}
                      >
                        <option value="">-- Selectează --</option>
                        <option value="Director General">Director General</option>
                        <option value="Manager Proiect">Manager Proiect</option>
                        <option value="Contabil">Contabil</option>
                        <option value="Responsabil Tehnic">Responsabil Tehnic</option>
                        <option value="Administrator">Administrator</option>
                        <option value="Reprezentant Legal">Reprezentant Legal</option>
                        <option value="Contact Principal">Contact Principal</option>
                        <option value="Altul">Altul</option>
                      </select>
                    </div>

                    {/* Primește notificări */}
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: disabled ? 'default' : 'pointer',
                        fontSize: '13px',
                        color: '#4b5563',
                        padding: '0.6rem',
                        background: '#f3f4f6',
                        borderRadius: '6px',
                        width: '100%'
                      }}>
                        <input
                          type="checkbox"
                          checked={contact.primeste_notificari}
                          onChange={(e) => handleContactChange(index, 'primeste_notificari', e.target.checked)}
                          disabled={disabled}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <span>Primește email-uri</span>
                      </label>
                    </div>
                  </div>

                  {/* Comentariu */}
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.35rem',
                      fontWeight: '500',
                      color: '#4b5563',
                      fontSize: '13px'
                    }}>
                      Comentariu / Note
                    </label>
                    <textarea
                      value={contact.comentariu}
                      onChange={(e) => handleContactChange(index, 'comentariu', e.target.value)}
                      disabled={disabled}
                      placeholder="Note despre acest contact..."
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '0.6rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
