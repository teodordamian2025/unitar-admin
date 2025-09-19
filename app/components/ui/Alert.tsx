// ==================================================================
// CALEA: app/components/ui/Alert.tsx
// DATA: 19.09.2025 20:10 (ora României)
// DESCRIERE: Componenta Alert glassmorphism pentru notificări și mesaje
// FUNCȚIONALITATE: Alert cu variante de tip, dismissible și animații
// ==================================================================

'use client';

import React, { ReactNode, useState, useEffect, CSSProperties } from 'react';
import Button from './Button';

interface AlertProps {
  children: ReactNode;
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  dismissible?: boolean;
  autoClose?: boolean;
  autoCloseDelay?: number;
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClose?: () => void;
}

const Alert: React.FC<AlertProps> = ({
  children,
  type = 'info',
  title,
  dismissible = false,
  autoClose = false,
  autoCloseDelay = 5000,
  icon,
  className = '',
  style = {},
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (autoClose && autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseDelay]);

  const getTypeStyles = (type: string) => {
    const types = {
      info: {
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        color: '#1e40af',
        icon: 'ℹ️'
      },
      success: {
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        color: '#065f46',
        icon: '✅'
      },
      warning: {
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        color: '#92400e',
        icon: '⚠️'
      },
      error: {
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        color: '#991b1b',
        icon: '🚨'
      }
    };
    return types[type as keyof typeof types] || types.info;
  };

  const handleClose = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 300);
  };

  if (!isVisible) return null;

  const typeStyles = getTypeStyles(type);

  const alertStyles: CSSProperties = {
    background: typeStyles.background,
    backdropFilter: 'blur(10px)',
    border: typeStyles.border,
    borderRadius: '12px',
    padding: '1rem 1.5rem',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    transform: isAnimating ? 'scale(0.95) translateY(-10px)' : 'scale(1) translateY(0)',
    opacity: isAnimating ? 0 : 1,
    transition: 'all 0.3s ease',
    ...style
  };

  const iconStyles: CSSProperties = {
    fontSize: '1.25rem',
    flexShrink: 0,
    marginTop: '0.125rem'
  };

  const contentStyles: CSSProperties = {
    flex: 1,
    minWidth: 0
  };

  const titleStyles: CSSProperties = {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: typeStyles.color,
    marginBottom: '0.25rem',
    margin: 0
  };

  const messageStyles: CSSProperties = {
    fontSize: '0.875rem',
    color: typeStyles.color,
    lineHeight: '1.5',
    margin: 0
  };

  const closeButtonStyles: CSSProperties = {
    marginLeft: 'auto',
    flexShrink: 0
  };

  return (
    <div className={className} style={alertStyles}>
      {/* Icon */}
      <div style={iconStyles}>
        {icon || typeStyles.icon}
      </div>

      {/* Content */}
      <div style={contentStyles}>
        {title && (
          <h4 style={titleStyles}>
            {title}
          </h4>
        )}
        <div style={messageStyles}>
          {children}
        </div>
      </div>

      {/* Close Button */}
      {dismissible && (
        <div style={closeButtonStyles}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            icon="✕"
            style={{
              padding: '0.25rem',
              borderRadius: '6px',
              color: typeStyles.color,
              fontSize: '0.875rem',
              opacity: 0.7
            }}
          >
            ✕
          </Button>
        </div>
      )}
    </div>
  );
};

export default Alert;