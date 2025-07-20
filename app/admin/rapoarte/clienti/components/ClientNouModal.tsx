// Componentă pentru modal adăugare client nou
// Să fie adăugată în pagina clienți

'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';

interface ClientNouModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientAdded: () => void;
}

export default function ClientNouModal({ isOpen, onClose, onClientAdded }: ClientNouModalProps) {
  const [loading, setLoading] = useState(false);
  const [anafLoading, setAnafLoading] = useState(false);

  const handleVerifyANAF = async () => {
    if (!formData.cui.trim()) {
      toast.error('Introduceți mai întâi CUI-ul');
      return;
    }

    try {
      setAnafLoading(true);
      toast.info('Verificare date ANAF...');

      // API simplu pentru verificare ANAF (poți folosi openapi.ro sau alt serviciu)
      const response = await fetch(`/api/verify-anaf?cui=${formData.cui}`);
      const result = await response.json();

      if (result.success && result.data) {
        // Populează form-ul cu datele de la ANAF
        setFormData(prev => ({
          ...prev,
          nume: result.data.nume || prev.nume,
          adresa: result.data.adresa || prev.adresa,
          // Alte câmpuri returnate de ANAF
        }));
        toast.success('Date ANAF încărcate cu succes!');
      } else {
        toast.warning('Nu s-au găsit date pentru acest CUI la ANAF');
      }
    } catch (error) {
      console.error('Eroare verificare ANAF:', error);
      toast.error('Eroare la verificarea ANAF');
    } finally {
      setAnafLoading(false);
    }
  };
  const [formData, setFormData] = useState({
    nume: '',
    tip_client: 'persoana_juridica',
    cui: '',
    nr_reg_com: '',
    adresa: '',
    judet: '',
    oras: '',
    cod_postal: '',
    telefon: '',
    email: '',
    banca: '',
    iban: '',
    // Pentru persoane fizice
    cnp: '',
    ci_serie: '',
    ci_numar: '',
    ci_eliberata_de: '',
    ci_eliberata_la: '',
    observatii: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validări
      if (!formData.nume.trim()) {
        toast.error('Numele clientului este obligatoriu');
        setLoading(false);
        return;
      }

      if (formData.tip_client === 'persoana_juridica' && !formData.cui.trim()) {
        toast.error('CUI-ul este obligatoriu pentru persoane juridice');
        setLoading(false);
        return;
      }

      if (formData.tip_client === 'persoana_fizica' && !formData.cnp.trim()) {
        toast.error('CNP-ul este obligatoriu pentru persoane fizice');
        setLoading(false);
        return;
      }

      console.log('Trimitere date client:', formData); // Debug
      toast.info('Se adaugă clientul...');

      // Încearcă doar BigQuery dacă factureaza.me nu e configurat
      const apiEndpoint = process.env.FACTUREAZA_API_KEY 
        ? '/api/actions/clients/sync-factureaza' 
        : '/api/rapoarte/clienti';

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      console.log('Response status:', response.status); // Debug
      const result = await response.json();
      console.log('Response data:', result); // Debug

      if (result.success || response.ok) {
        if (apiEndpoint.includes('sync-factureaza')) {
          toast.success('Client adăugat cu succes în BigQuery și factureaza.me!');
        } else {
          toast.success('Client adăugat cu succes în BigQuery!');
        }
        onClientAdded();
        onClose();
        // Reset form
        setFormData({
          nume: '',
          tip_client: 'persoana_juridica',
          cui: '',
          nr_reg_com: '',
          adresa: '',
          judet: '',
          oras: '',
          cod_postal: '',
          telefon: '',
          email: '',
          banca: '',
          iban: '',
          cnp: '',
          ci_serie: '',
          ci_numar: '',
          ci_eliberata_de: '',
          ci_eliberata_la: '',
          observatii: ''
        });
      } else {
        console.error('Eroare API:', result); // Debug
        toast.error(`Eroare: ${result.error || 'Eroare necunoscută'}`);
      }
    } catch (error) {
      console.error('Eroare la adăugarea clientului:', error); // Debug
      toast.error('Eroare la adăugarea clientului');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: '#f8f9fa',
          borderRadius: '8px 8px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>
              👤 Adaugă Client Nou
            </h2>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#6c757d'
              }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: '0.5rem 0 0 0', color: '#7f8c8d', fontSize: '14px' }}>
            Clientul va fi adăugat automat în BigQuery și sincronizat cu factureaza.me
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {/* Tip client */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Tip client *
            </label>
            <select
              value={formData.tip_client}
              onChange={(e) => handleInputChange('tip_client', e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="persoana_juridica">Persoană Juridică</option>
              <option value="persoana_fizica">Persoană Fizică</option>
            </select>
          </div>

          {/* Grid pentru câmpuri */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            {/* Nume */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Nume *
              </label>
              <input
                type="text"
                value={formData.nume}
                onChange={(e) => handleInputChange('nume', e.target.value)}
                disabled={loading}
                placeholder="Numele clientului"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* CUI/CNP */}
            {formData.tip_client === 'persoana_juridica' ? (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  CUI *
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={formData.cui}
                    onChange={(e) => handleInputChange('cui', e.target.value)}
                    disabled={loading}
                    placeholder="RO12345678"
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyANAF}
                    disabled={loading || anafLoading || !formData.cui.trim()}
                    style={{
                      padding: '0.75rem 1rem',
                      background: anafLoading ? '#bdc3c7' : '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: (loading || anafLoading || !formData.cui.trim()) ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {anafLoading ? '⏳' : '🏛️ ANAF'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  CNP *
                </label>
                <input
                  type="text"
                  value={formData.cnp}
                  onChange={(e) => handleInputChange('cnp', e.target.value)}
                  disabled={loading}
                  placeholder="1234567890123"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
            )}
          </div>

          {/* Nr. Reg. Com pentru persoane juridice */}
          {formData.tip_client === 'persoana_juridica' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Nr. Reg. Com.
              </label>
              <input
                type="text"
                value={formData.nr_reg_com}
                onChange={(e) => handleInputChange('nr_reg_com', e.target.value)}
                disabled={loading}
                placeholder="J40/1234/2020"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          )}

          {/* Adresă */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Adresă
            </label>
            <input
              type="text"
              value={formData.adresa}
              onChange={(e) => handleInputChange('adresa', e.target.value)}
              disabled={loading}
              placeholder="Strada, numărul, sectorul/comuna"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Grid pentru localitate */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Județ
              </label>
              <input
                type="text"
                value={formData.judet}
                onChange={(e) => handleInputChange('judet', e.target.value)}
                disabled={loading}
                placeholder="București"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Oraș
              </label>
              <input
                type="text"
                value={formData.oras}
                onChange={(e) => handleInputChange('oras', e.target.value)}
                disabled={loading}
                placeholder="București"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Cod Poștal
              </label>
              <input
                type="text"
                value={formData.cod_postal}
                onChange={(e) => handleInputChange('cod_postal', e.target.value)}
                disabled={loading}
                placeholder="010123"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* Contact */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Telefon
              </label>
              <input
                type="tel"
                value={formData.telefon}
                onChange={(e) => handleInputChange('telefon', e.target.value)}
                disabled={loading}
                placeholder="0123456789"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={loading}
                placeholder="contact@client.ro"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* Date bancare */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Bancă
              </label>
              <input
                type="text"
                value={formData.banca}
                onChange={(e) => handleInputChange('banca', e.target.value)}
                disabled={loading}
                placeholder="Banca Transilvania"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                IBAN
              </label>
              <input
                type="text"
                value={formData.iban}
                onChange={(e) => handleInputChange('iban', e.target.value)}
                disabled={loading}
                placeholder="RO49AAAA1B31007593840000"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* Observații */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Observații
            </label>
            <textarea
              value={formData.observatii}
              onChange={(e) => handleInputChange('observatii', e.target.value)}
              disabled={loading}
              placeholder="Observații despre client..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Butoane */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #dee2e6'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Anulează
            </button>
            
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading ? '#bdc3c7' : '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {loading ? '⏳ Se adaugă...' : '💾 Adaugă Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
