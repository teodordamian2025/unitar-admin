'use client';

import { useState, useRef, useEffect } from 'react';

export interface ActionItem {
  key: string;
  label: string;
  icon?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
  divider?: boolean;
}

interface ActionDropdownProps {
  actions: ActionItem[];
  onAction: (actionKey: string, data: any) => void;
  data: any;
  disabled?: boolean;
}

export default function ActionDropdown({ 
  actions, 
  onAction, 
  data, 
  disabled = false 
}: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getActionColor = (color?: string) => {
    switch (color) {
      case 'primary': return '#007bff';
      case 'secondary': return '#6c757d';
      case 'success': return '#28a745';
      case 'warning': return '#ffc107';
      case 'danger': return '#dc3545';
      default: return '#495057';
    }
  };

  const handleActionClick = (actionKey: string) => {
    setIsOpen(false);
    onAction(actionKey, data);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          padding: '0.5rem',
          background: 'transparent',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: '#495057',
          fontSize: '14px',
          opacity: disabled ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}
      >
        ⚙️
        <span style={{ fontSize: '12px' }}>▼</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          zIndex: 1000,
          background: 'white',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          minWidth: '200px',
          marginTop: '0.25rem'
        }}>
          {actions.map((action, index) => (
            <div key={action.key}>
              {action.divider && index > 0 && (
                <hr style={{ 
                  margin: '0.5rem 0', 
                  border: 'none', 
                  borderTop: '1px solid #dee2e6' 
                }} />
              )}
              
              <button
                onClick={() => handleActionClick(action.key)}
                disabled={action.disabled}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: action.disabled ? 'not-allowed' : 'pointer',
                  color: action.disabled ? '#6c757d' : getActionColor(action.color),
                  fontSize: '14px',
                  opacity: action.disabled ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!action.disabled) {
                    e.currentTarget.style.background = '#f8f9fa';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {action.icon && <span>{action.icon}</span>}
                {action.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

