'use client';

import { useState, useEffect } from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'dateRange';
  options?: FilterOption[];
  placeholder?: string;
}

export interface FilterValues {
  [key: string]: any;
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onReset: () => void;
  loading?: boolean;
}

export default function FilterBar({ 
  filters, 
  values, 
  onChange, 
  onReset, 
  loading = false 
}: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key: string, value: any) => {
    onChange({
      ...values,
      [key]: value
    });
  };

  const hasActiveFilters = Object.values(values).some(value => 
    value !== '' && value !== null && value !== undefined
  );

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      padding: '1.5rem',
      marginBottom: '1.5rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid #dee2e6'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: isExpanded ? '1.5rem' : '0'
      }}>
        <h3 style={{ 
          margin: 0, 
          color: '#2c3e50',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🔍 Filtre și Căutare
          {hasActiveFilters && (
            <span style={{
              background: '#007bff',
              color: 'white',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '12px',
              fontWeight: 'normal'
            }}>
              {Object.values(values).filter(v => v !== '' && v !== null && v !== undefined).length}
            </span>
          )}
        </h3>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {hasActiveFilters && (
            <button
              onClick={onReset}
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: loading ? 0.6 : 1
              }}
            >
              🔄 Reset
            </button>
          )}
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              padding: '0.5rem 1rem',
              background: 'transparent',
              color: '#007bff',
              border: '1px solid #007bff',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {isExpanded ? 'Ascunde ↑' : 'Extinde ↓'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
          alignItems: 'end'
        }}>
          {filters.map((filter) => (
            <div key={filter.key}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#495057',
                fontSize: '14px',
                fontWeight: 500
              }}>
                {filter.label}
              </label>
              
              {filter.type === 'text' && (
                <input
                  type="text"
                  value={values[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  placeholder={filter.placeholder}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: loading ? 0.6 : 1
                  }}
                />
              )}

              {filter.type === 'select' && (
                <select
                  value={values[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    background: 'white',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  <option value="">{filter.placeholder || 'Selectează...'}</option>
                  {filter.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}

              {filter.type === 'date' && (
                <input
                  type="date"
                  value={values[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: loading ? 0.6 : 1
                  }}
                />
              )}

              {filter.type === 'dateRange' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="date"
                    value={values[`${filter.key}_start`] || ''}
                    onChange={(e) => handleFilterChange(`${filter.key}_start`, e.target.value)}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: '1px solid #ced4da',
                      borderRadius: '6px',
                      fontSize: '14px',
                      opacity: loading ? 0.6 : 1
                    }}
                  />
                  <span style={{ alignSelf: 'center', color: '#6c757d' }}>→</span>
                  <input
                    type="date"
                    value={values[`${filter.key}_end`] || ''}
                    onChange={(e) => handleFilterChange(`${filter.key}_end`, e.target.value)}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: '1px solid #ced4da',
                      borderRadius: '6px',
                      fontSize: '14px',
                      opacity: loading ? 0.6 : 1
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

