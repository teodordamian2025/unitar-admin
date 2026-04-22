// ==================================================================
// CALEA: app/components/ClientAutocomplete.tsx
// DESCRIERE: Input cu autocomplete pentru clienți - folosit în filtre
//   (ProiectFilters admin + UserProjectFilters). Dacă nu există match
//   cu sugestiile, permite text liber care merge mai departe în backend
//   pentru căutare LIKE.
// ==================================================================

'use client';

import { useEffect, useRef, useState, CSSProperties } from 'react';

interface ClientItem {
  id: string;
  nume: string;
  cui?: string | null;
}

interface ClientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  onEnter?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  inputStyle?: CSSProperties;
  onFocusStyle?: CSSProperties;
  onBlurStyle?: CSSProperties;
  maxSuggestions?: number;
}

export default function ClientAutocomplete({
  value,
  onChange,
  onSelect,
  onEnter,
  placeholder = 'Caută client...',
  disabled = false,
  inputStyle,
  onFocusStyle,
  onBlurStyle,
  maxSuggestions = 8,
}: ClientAutocompleteProps) {
  const [clienti, setClienti] = useState<ClientItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadClienti = async () => {
      try {
        const response = await fetch('/api/rapoarte/clienti');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data?.data)) {
            setClienti(data.data as ClientItem[]);
          }
        }
      } catch (err) {
        console.error('ClientAutocomplete: eroare la încărcare clienți', err);
      } finally {
        setLoaded(true);
      }
    };
    loadClienti();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = value.trim().length === 0
    ? []
    : clienti
        .filter(c => c.nume?.toLowerCase().includes(value.toLowerCase()))
        .slice(0, maxSuggestions);

  const handleSelect = (client: ClientItem) => {
    onChange(client.nume);
    setShowSuggestions(false);
    onSelect?.(client.nume);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            setShowSuggestions(false);
            onEnter?.(value);
          }
        }}
        onFocus={(e) => {
          if (value.length > 0) setShowSuggestions(true);
          if (onFocusStyle) {
            Object.assign(e.currentTarget.style, onFocusStyle);
          }
        }}
        onBlur={(e) => {
          if (onBlurStyle) {
            Object.assign(e.currentTarget.style, onBlurStyle);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        style={inputStyle}
      />

      {showSuggestions && filtered.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #dee2e6',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            zIndex: 1000,
            maxHeight: '240px',
            overflowY: 'auto',
          }}
        >
          {filtered.map((client) => (
            <div
              key={client.id}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(client);
              }}
              style={{
                padding: '0.6rem 0.75rem',
                cursor: 'pointer',
                borderBottom: '1px solid #f1f2f6',
                fontSize: '13px',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#f8f9fa';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'white';
              }}
            >
              <div style={{ fontWeight: 600, color: '#2c3e50' }}>{client.nume}</div>
              {client.cui && (
                <div style={{ fontSize: '11px', color: '#7f8c8d', marginTop: '2px' }}>
                  CUI: {client.cui}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showSuggestions && loaded && value.trim().length > 0 && filtered.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #dee2e6',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            zIndex: 1000,
            padding: '0.6rem 0.75rem',
            fontSize: '12px',
            color: '#7f8c8d',
            fontStyle: 'italic',
          }}
        >
          Niciun client găsit — se va căuta după text
        </div>
      )}
    </div>
  );
}
