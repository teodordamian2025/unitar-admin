// ==================================================================
// CALEA: app/admin/analytics/components/DatePickerPopup.tsx
// DATA: 21.09.2025 16:15 (ora României)
// DESCRIERE: Component popup pentru editarea datelor în Gantt Chart
// FUNCȚIONALITATE: Date picker pentru modificarea start/end date cu un click
// ==================================================================

'use client';

import React, { useState, useEffect, useRef } from 'react';

interface DatePickerPopupProps {
  isOpen: boolean;
  position: { x: number; y: number };
  currentDate: string;
  dateType: 'start' | 'end';
  taskName: string;
  onSave: (newDate: string) => void;
  onCancel: () => void;
  minDate?: string;
  maxDate?: string;
}

export default function DatePickerPopup({
  isOpen,
  position,
  currentDate,
  dateType,
  taskName,
  onSave,
  onCancel,
  minDate,
  maxDate
}: DatePickerPopupProps) {
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [saving, setSaving] = useState(false);
  const [popupPosition, setPopupPosition] = useState(position);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedDate(currentDate);
  }, [currentDate, isOpen]);

  // Actualizează poziția când se schimbă position prop-ul
  useEffect(() => {
    if (isOpen) {
      calculateOptimalPosition();
    }
  }, [position, isOpen]);

  // Calculează poziția optimă pentru a evita ieșirea din ecran
  const calculateOptimalPosition = () => {
    const popupWidth = 320;
    const popupHeight = 300;
    const margin = 20;

    let x = position.x + 10;
    let y = position.y - 10;

    // Ajustare pentru marginea dreaptă
    if (x + popupWidth + margin > window.innerWidth) {
      x = window.innerWidth - popupWidth - margin;
    }

    // Ajustare pentru marginea stângă
    if (x < margin) {
      x = margin;
    }

    // Ajustare pentru marginea de jos
    if (y + popupHeight + margin > window.innerHeight) {
      y = window.innerHeight - popupHeight - margin;
    }

    // Ajustare pentru marginea de sus
    if (y < margin) {
      y = margin;
    }

    setPopupPosition({ x, y });
  };

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) { // Doar dacă se face click pe header
      setIsDragging(true);
      const rect = popupRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Limitare în cadrul ferestrei
      const popupWidth = 320;
      const popupHeight = 300;
      const margin = 10;

      const constrainedX = Math.max(margin, Math.min(newX, window.innerWidth - popupWidth - margin));
      const constrainedY = Math.max(margin, Math.min(newY, window.innerHeight - popupHeight - margin));

      setPopupPosition({ x: constrainedX, y: constrainedY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragOffset]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onCancel]);

  const handleSave = async () => {
    if (!selectedDate || selectedDate === currentDate) {
      onCancel();
      return;
    }

    setSaving(true);
    try {
      await onSave(selectedDate);
    } finally {
      setSaving(false);
    }
  };

  const formatDateForDisplay = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  // Calculez poziția optimă pentru popup
  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left: popupPosition.x,
    top: popupPosition.y,
    zIndex: 1000,
    background: 'white',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: isDragging 
      ? '0 20px 35px rgba(0, 0, 0, 0.25)' 
      : '0 10px 25px rgba(0, 0, 0, 0.15)',
    padding: 0,
    minWidth: '320px',
    maxWidth: '320px',
    transition: isDragging ? 'none' : 'box-shadow 0.2s ease'
  };

  return (
    <div ref={popupRef} style={popupStyle}>
      {/* Draggable Header */}
      <div 
        style={{
          padding: '1rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid #e5e7eb',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          background: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
          borderRadius: '6px 6px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
        onMouseDown={handleMouseDown}
      >
        <div>
          <h3 style={{
            margin: 0,
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {dateType === 'start' ? '📅 Data început' : '📅 Data sfârșit'}
          </h3>
          <p style={{
            margin: '0.25rem 0 0 0',
            fontSize: '0.75rem',
            color: '#6b7280',
            lineHeight: '1.2'
          }}>
            {taskName}
          </p>
        </div>
        
        {/* Drag indicator */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          opacity: 0.4
        }}>
          <div style={{ width: '4px', height: '4px', background: '#6b7280', borderRadius: '50%' }} />
          <div style={{ width: '4px', height: '4px', background: '#6b7280', borderRadius: '50%' }} />
          <div style={{ width: '4px', height: '4px', background: '#6b7280', borderRadius: '50%' }} />
        </div>
      </div>

      <div style={{ padding: '1rem' }}>
        {/* Current Date Display */}
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          background: '#f3f4f6',
          borderRadius: '6px'
        }}>
          <div style={{
            fontSize: '0.75rem',
            color: '#6b7280',
            marginBottom: '0.25rem'
          }}>
            Data curentă:
          </div>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151'
          }}>
            {formatDateForDisplay(currentDate)}
          </div>
        </div>

        {/* Date Picker */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{
            display: 'block',
            fontSize: '0.75rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Selectează noua dată:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={minDate}
            max={maxDate}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
              background: 'white',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#d1d5db';
            }}
          />
        </div>

        {/* New Date Preview */}
        {selectedDate && selectedDate !== currentDate && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            background: '#ecfdf5',
            border: '1px solid #d1fae5',
            borderRadius: '6px'
          }}>
            <div style={{
              fontSize: '0.75rem',
              color: '#065f46',
              marginBottom: '0.25rem'
            }}>
              Noua dată:
            </div>
            <div style={{
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#047857'
            }}>
              {formatDateForDisplay(selectedDate)}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#6b7280',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1
            }}
          >
            Anulează
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedDate || selectedDate === currentDate}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'white',
              background: saving ? '#9ca3af' : (selectedDate === currentDate ? '#9ca3af' : '#3b82f6'),
              border: 'none',
              borderRadius: '4px',
              cursor: saving || selectedDate === currentDate ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {saving && (
              <div style={{
                width: '12px',
                height: '12px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
            {saving ? 'Se salvează...' : 'Salvează'}
          </button>
        </div>
      </div>

      {/* CSS Animation pentru loading spinner */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
