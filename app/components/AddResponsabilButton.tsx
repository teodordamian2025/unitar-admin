// ==================================================================
// CALEA: app/components/AddResponsabilButton.tsx
// DATA: 08.01.2026 (ora Romaniei)
// DESCRIERE: Buton compact pentru adaugare rapida responsabil la proiecte/subproiecte/sarcini
// UTILIZARE: Fara a deschide modal-ul complet de editare
// ==================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';

interface AddResponsabilButtonProps {
  entityType: 'proiect' | 'subproiect' | 'sarcina';
  entityId: string;
  onResponsabilAdded?: () => void;
  existingResponsabili?: Array<{ uid: string; nume_complet: string }>;
  buttonSize?: 'small' | 'medium';
  showLabel?: boolean;
}

interface Utilizator {
  uid: string;
  email: string;
  nume: string;
  prenume: string;
  nume_complet: string;
  rol: string;
  activ: boolean;
}

interface ResponsabilSelectat {
  uid: string;
  nume_complet: string;
  email: string;
  rol: string;
}

export default function AddResponsabilButton({
  entityType,
  entityId,
  onResponsabilAdded,
  existingResponsabili = [],
  buttonSize = 'small',
  showLabel = false
}: AddResponsabilButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [utilizatori, setUtilizatori] = useState<Utilizator[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('Normal');
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadUtilizatori();
      updateDropdownPosition();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: Math.min(rect.left + window.scrollX, window.innerWidth - 320)
      });
    }
  };

  const loadUtilizatori = async (search?: string) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search && search.trim().length > 0) {
        queryParams.append('search', search.trim());
      }
      queryParams.append('limit', '15');

      const response = await fetch(`/api/rapoarte/utilizatori?${queryParams.toString()}`);
      const data = await response.json();

      if (data.success) {
        // Filtreaza utilizatorii deja adaugati
        const existingUids = existingResponsabili.map(r => r.uid);
        const filtered = (data.data || []).filter(
          (u: Utilizator) => !existingUids.includes(u.uid)
        );
        setUtilizatori(filtered);
      }
    } catch (error) {
      console.error('Eroare la incarcarea utilizatorilor:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (value.trim().length >= 2 || value.trim().length === 0) {
      loadUtilizatori(value);
    }
  };

  const handleSelectUser = async (user: Utilizator) => {
    setSaving(true);
    try {
      // Determina API endpoint-ul bazat pe tipul entitatii
      let apiEndpoint = '';
      let payload: any = {};

      const responsabilId = `${entityType.charAt(0).toUpperCase()}R-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      switch (entityType) {
        case 'proiect':
          apiEndpoint = '/api/rapoarte/proiecte-responsabili';
          payload = {
            id: responsabilId,
            proiect_id: entityId,
            responsabil_uid: user.uid,
            responsabil_nume: user.nume_complet,
            rol_in_proiect: selectedRole
          };
          break;
        case 'subproiect':
          apiEndpoint = '/api/rapoarte/subproiecte-responsabili';
          payload = {
            id: responsabilId,
            subproiect_id: entityId,
            responsabil_uid: user.uid,
            responsabil_nume: user.nume_complet,
            rol_in_subproiect: selectedRole
          };
          break;
        case 'sarcina':
          apiEndpoint = '/api/rapoarte/sarcini-responsabili';
          payload = {
            id: responsabilId,
            sarcina_id: entityId,
            responsabil_uid: user.uid,
            responsabil_nume: user.nume_complet,
            rol_in_sarcina: selectedRole
          };
          break;
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`${user.nume_complet} adaugat ca responsabil`);
        setIsOpen(false);
        setSearchTerm('');
        if (onResponsabilAdded) {
          onResponsabilAdded();
        }
      } else {
        toast.error(result.error || 'Eroare la adaugarea responsabilului');
      }
    } catch (error) {
      console.error('Eroare la adaugarea responsabilului:', error);
      toast.error('Eroare la adaugarea responsabilului');
    } finally {
      setSaving(false);
    }
  };

  const getRolIcon = (rol: string) => {
    switch (rol) {
      case 'admin': return '';
      case 'manager': return '';
      case 'normal': return '';
      default: return '';
    }
  };

  const getButtonSize = () => {
    return buttonSize === 'small'
      ? { width: '24px', height: '24px', fontSize: '14px' }
      : { width: '32px', height: '32px', fontSize: '18px' };
  };

  const dropdownContent = isOpen && mounted && (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: '300px',
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(12px)',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        zIndex: 99999,
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid rgba(229, 231, 235, 0.5)',
        background: 'rgba(249, 250, 251, 0.8)'
      }}>
        <div style={{
          fontSize: '13px',
          fontWeight: '600',
          color: '#374151',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          + Adauga Responsabil
        </div>

        {/* Search input */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Cauta utilizator..."
          autoFocus
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid rgba(209, 213, 219, 0.5)',
            borderRadius: '6px',
            fontSize: '13px',
            background: 'white'
          }}
        />

        {/* Role selector */}
        <div style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>Rol:</span>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            style={{
              flex: 1,
              padding: '4px 6px',
              fontSize: '11px',
              border: '1px solid rgba(209, 213, 219, 0.5)',
              borderRadius: '4px',
              background: 'white'
            }}
          >
            <option value="Principal">Principal</option>
            <option value="Normal">Normal</option>
            <option value="Observator">Observator</option>
          </select>
        </div>
      </div>

      {/* User list */}
      <div style={{
        maxHeight: '200px',
        overflowY: 'auto'
      }}>
        {loading ? (
          <div style={{
            padding: '16px',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '13px'
          }}>
            Se incarca...
          </div>
        ) : utilizatori.length > 0 ? (
          utilizatori.map(user => (
            <div
              key={user.uid}
              onClick={() => !saving && handleSelectUser(user)}
              style={{
                padding: '10px 12px',
                cursor: saving ? 'not-allowed' : 'pointer',
                borderBottom: '1px solid rgba(229, 231, 235, 0.3)',
                transition: 'background 0.15s ease',
                opacity: saving ? 0.5 : 1
              }}
              onMouseOver={(e) => {
                if (!saving) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{
                fontWeight: '500',
                fontSize: '13px',
                color: '#1f2937',
                marginBottom: '2px'
              }}>
                {getRolIcon(user.rol)} {user.nume_complet}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#6b7280'
              }}>
                {user.email}
              </div>
            </div>
          ))
        ) : (
          <div style={{
            padding: '16px',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '13px'
          }}>
            {searchTerm.length >= 2 ? 'Niciun utilizator gasit' : 'Scrie min. 2 caractere'}
          </div>
        )}
      </div>

      {/* Footer - Close button */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid rgba(229, 231, 235, 0.5)',
        background: 'rgba(249, 250, 251, 0.5)',
        textAlign: 'right'
      }}>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            color: '#6b7280',
            background: 'transparent',
            border: '1px solid rgba(209, 213, 219, 0.5)',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Inchide
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="Adauga responsabil"
        style={{
          ...getButtonSize(),
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: showLabel ? '4px' : '0',
          background: 'rgba(59, 130, 246, 0.1)',
          color: '#3b82f6',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          flexShrink: 0,
          padding: showLabel ? '4px 8px' : '0',
          width: showLabel ? 'auto' : getButtonSize().width
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <span style={{ fontWeight: '600' }}>+</span>
        {showLabel && <span style={{ fontSize: '11px', fontWeight: '500' }}>Responsabil</span>}
      </button>

      {mounted && createPortal(dropdownContent, document.body)}
    </>
  );
}
