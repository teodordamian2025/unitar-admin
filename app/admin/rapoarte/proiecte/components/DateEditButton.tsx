// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/DateEditButton.tsx
// DATA: 12.01.2026 (ora României)
// DESCRIERE: Component pentru editare inline a datelor de start și final
// FUNCȚIONALITATE: Buton mic care deschide un date picker pentru editare rapidă
// ==================================================================

'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';

interface DateEditButtonProps {
  entityId: string;
  entityType: 'proiect' | 'subproiect';
  dateField: 'Data_Start' | 'Data_Final';
  currentDate: any;
  onUpdate?: (newDate: string) => void;
  disabled?: boolean;
}

export default function DateEditButton({
  entityId,
  entityType,
  dateField,
  currentDate,
  onUpdate,
  disabled = false
}: DateEditButtonProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (showPopup && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopupPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX
      });
    }
  }, [showPopup]);

  // Formatare dată pentru input type="date"
  const formatDateForInput = (dateValue: any): string => {
    if (!dateValue) return '';

    const dateStr = typeof dateValue === 'object' && dateValue.value
      ? dateValue.value
      : dateValue.toString();

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const handleOpenEdit = () => {
    if (disabled) return;
    setNewDate(formatDateForInput(currentDate));
    setShowPopup(true);
  };

  const handleSave = async () => {
    if (!newDate) {
      toast.error('Selectați o dată validă');
      return;
    }

    setSaving(true);
    try {
      const endpoint = entityType === 'proiect'
        ? `/api/rapoarte/proiecte/${entityId}`
        : `/api/rapoarte/subproiecte/${entityId}`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [dateField]: newDate })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`${dateField === 'Data_Start' ? 'Data de start' : 'Data de final'} actualizată!`);
        setShowPopup(false);
        onUpdate?.(newDate);
      } else {
        throw new Error(data.error || 'Eroare la actualizare');
      }
    } catch (error) {
      console.error('Eroare la actualizarea datei:', error);
      toast.error(error instanceof Error ? error.message : 'Eroare la actualizarea datei');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowPopup(false);
    setNewDate('');
  };

  // Close popup on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showPopup && !target.closest('.date-edit-popup') && !target.closest('.date-edit-button')) {
        setShowPopup(false);
      }
    };

    if (showPopup) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopup]);

  // Popup Component
  const EditPopup = () => {
    if (!mounted) return null;

    return createPortal(
      <div
        className="date-edit-popup"
        style={{
          position: 'absolute',
          top: popupPosition.top,
          left: popupPosition.left,
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          border: '1px solid #e5e7eb',
          padding: '1rem',
          zIndex: 60000,
          minWidth: '240px'
        }}
      >
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            {dateField === 'Data_Start' ? '📅 Data de Start' : '🏁 Data de Final'}
          </label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem'
            }}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '0.4rem 0.75rem',
              background: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: '500'
            }}
          >
            Anulează
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !newDate}
            style={{
              padding: '0.4rem 0.75rem',
              background: saving || !newDate ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: saving || !newDate ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              fontWeight: '500'
            }}
          >
            {saving ? '...' : 'Salvează'}
          </button>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      <button
        ref={buttonRef}
        className="date-edit-button"
        onClick={handleOpenEdit}
        disabled={disabled}
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '4px',
          background: disabled ? '#e5e7eb' : 'rgba(59, 130, 246, 0.1)',
          color: disabled ? '#9ca3af' : '#3b82f6',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '0.7rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: '0.5rem',
          transition: 'all 0.2s',
          verticalAlign: 'middle'
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
          }
        }}
        title={`Editează ${dateField === 'Data_Start' ? 'data de start' : 'data de final'}`}
      >
        ✏️
      </button>

      {showPopup && <EditPopup />}
    </>
  );
}
