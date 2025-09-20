// ==================================================================
// CALEA: app/components/ui/Modal.tsx
// DATA: 19.09.2025 20:05 (ora României)
// DESCRIERE: Componenta Modal glassmorphism cu backdrop blur și animații
// FUNCȚIONALITATE: Modal responsive cu overlay, close handlers și variante de mărime
// ==================================================================

'use client';

import React, { ReactNode, useEffect, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closable = true,
  footer,
  className = '',
  style = {}
}) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closable) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, closable]);

  const getSizeStyles = (size: string) => {
    const sizes = {
      sm: {
        maxWidth: '400px',
        margin: '2rem'
      },
      md: {
        maxWidth: '600px',
        margin: '2rem'
      },
      lg: {
        maxWidth: '800px',
        margin: '2rem'
      },
      xl: {
        maxWidth: '1200px',
        margin: '1rem'
      },
      full: {
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: 'calc(100vh - 2rem)',
        margin: '1rem'
      }
    };
    return sizes[size as keyof typeof sizes] || sizes.md;
  };

  const sizeStyles = getSizeStyles(size);

  const overlayStyles: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem',
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? 'visible' : 'hidden',
    transition: 'all 0.3s ease'
  };

  const modalStyles: CSSProperties = {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    width: '100%',
    maxHeight: 'calc(100vh - 4rem)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
    transition: 'all 0.3s ease',
    ...sizeStyles,
    ...style
  };

  const headerStyles: CSSProperties = {
    padding: '1.5rem 2rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255, 255, 255, 0.5)'
  };

  const contentStyles: CSSProperties = {
    padding: '2rem',
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden'
  };

  const footerStyles: CSSProperties = {
    padding: '1.5rem 2rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '1rem'
  };

  if (!isOpen) return null;

  const modalContent = (
    <div style={overlayStyles} onClick={closable ? onClose : undefined}>
      <div
        className={className}
        style={modalStyles}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || closable) && (
          <div style={headerStyles}>
            {title && (
              <h2 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#1f2937'
              }}>
                {title}
              </h2>
            )}
            {closable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                style={{
                  padding: '0.5rem',
                  borderRadius: '8px',
                  color: '#6b7280',
                  fontSize: '1rem'
                }}
              >
                ✕
              </Button>
            )}
          </div>
        )}

        {/* Content */}
        <div style={contentStyles}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={footerStyles}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Render modal in portal
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return null;
};

export default Modal;