// ==================================================================
// CALEA: app/projects/components/UserProjectFilters.tsx
// DATA: 21.09.2025 17:05 (ora României)
// DESCRIERE: Filtre pentru proiecte utilizatori normali - FĂRĂ filtre financiare
// FUNCȚIONALITATE: Search, status, client, date (exclude valoare min/max)
// ==================================================================

'use client';

import { useState, useEffect } from 'react';

interface FilterValues {
  search: string;
  status: string;
  client: string;
  data_start_start: string;
  data_start_end: string;
}

interface UserProjectFiltersProps {
  filters: FilterValues;
  onFilterChange: (filters: Partial<FilterValues>) => void;
}

export default function UserProjectFilters({ filters, onFilterChange }: UserProjectFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleInputChange = (field: keyof FilterValues, value: string) => {
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
    onFilterChange({ [field]: value });
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      search: '',
      status: '',
      client: '',
      data_start_start: '',
      data_start_end: ''
    };
    setLocalFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const hasActiveFilters = Object.values(localFilters).some(value => value !== '');

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(12px)',
      borderRadius: '16px',
      padding: '1.5rem',
      marginBottom: '1.5rem',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
    }}>
      {/* Header cu toggle */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: isExpanded ? '1.5rem' : '0'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.2rem' }}>🔍</span>
          <h3 style={{
            fontSize: '1.1rem',
            fontWeight: '600',
            color: '#1f2937',
            margin: 0
          }}>
            Filtrare Proiecte
          </h3>
          {hasActiveFilters && (
            <span style={{
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#2563eb',
              fontSize: '0.75rem',
              fontWeight: '600',
              padding: '0.25rem 0.5rem',
              borderRadius: '6px'
            }}>
              {Object.values(localFilters).filter(v => v !== '').length} active
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#dc2626',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              }}
            >
              Resetează
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#2563eb',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '8px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
            }}
          >
            {isExpanded ? '⬆️' : '⬇️'}
            {isExpanded ? 'Ascunde' : 'Arată'}
          </button>
        </div>
      </div>

      {/* Filtrele expandabile */}
      {isExpanded && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem'
        }}>
          {/* Search general */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              🔍 Căutare generală
            </label>
            <input
              type="text"
              value={localFilters.search}
              onChange={(e) => handleInputChange('search', e.target.value)}
              placeholder="ID proiect, denumire, client..."
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(209, 213, 219, 0.5)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(209, 213, 219, 0.5)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Status proiect */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              📊 Status proiect
            </label>
            <select
              value={localFilters.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(209, 213, 219, 0.5)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(209, 213, 219, 0.5)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <option value="">Toate statusurile</option>
              <option value="Activ">🟢 Activ</option>
              <option value="Finalizat">✅ Finalizat</option>
              <option value="Suspendat">⏸️ Suspendat</option>
              <option value="Anulat">❌ Anulat</option>
            </select>
          </div>

          {/* Client */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              🏢 Client
            </label>
            <input
              type="text"
              value={localFilters.client}
              onChange={(e) => handleInputChange('client', e.target.value)}
              placeholder="Numele clientului..."
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(209, 213, 219, 0.5)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(209, 213, 219, 0.5)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Data start - de la */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              📅 Data început - de la
            </label>
            <input
              type="date"
              value={localFilters.data_start_start}
              onChange={(e) => handleInputChange('data_start_start', e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(209, 213, 219, 0.5)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(209, 213, 219, 0.5)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Data start - până la */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              📅 Data început - până la
            </label>
            <input
              type="date"
              value={localFilters.data_start_end}
              onChange={(e) => handleInputChange('data_start_end', e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(209, 213, 219, 0.5)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(209, 213, 219, 0.5)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Notă pentru utilizatori normali */}
          <div style={{
            gridColumn: '1 / -1',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem',
            fontSize: '0.875rem',
            color: '#065f46',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '1rem' }}>💰</span>
            <span>
              <strong>Filtrele financiare</strong> sunt dezactivate pentru utilizatorii normali.
              Proiectele sunt gestionate fără informații despre valori financiare.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}