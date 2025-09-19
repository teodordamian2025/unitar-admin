// ==================================================================
// CALEA: app/components/ui/LoadingSpinner.tsx
// DATA: 19.09.2025 20:12 (ora României)
// DESCRIERE: Componenta LoadingSpinner glassmorphism pentru stări de încărcare
// FUNCȚIONALITATE: Spinner animat cu variante de mărime și overlay
// ==================================================================

'use client';

import React, { CSSProperties } from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'white' | 'current';
  thickness?: number;
  overlay?: boolean;
  message?: string;
  className?: string;
  style?: CSSProperties;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  thickness = 2,
  overlay = false,
  message,
  className = '',
  style = {}
}) => {
  const getSizeStyles = (size: string) => {
    const sizes = {
      sm: { width: '1rem', height: '1rem' },
      md: { width: '1.5rem', height: '1.5rem' },
      lg: { width: '2rem', height: '2rem' },
      xl: { width: '3rem', height: '3rem' }
    };
    return sizes[size as keyof typeof sizes] || sizes.md;
  };

  const getColorStyles = (color: string) => {
    const colors = {
      primary: '#3b82f6',
      secondary: '#6b7280',
      white: '#ffffff',
      current: 'currentColor'
    };
    return colors[color as keyof typeof colors] || colors.primary;
  };

  const sizeStyles = getSizeStyles(size);
  const colorValue = getColorStyles(color);

  const spinnerStyles: CSSProperties = {
    width: sizeStyles.width,
    height: sizeStyles.height,
    border: `${thickness}px solid rgba(156, 163, 175, 0.3)`,
    borderTopColor: colorValue,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    ...style
  };

  const overlayStyles: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    zIndex: 9999
  };

  const messageStyles: CSSProperties = {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center'
  };

  const spinnerComponent = (
    <>
      <div className={className} style={spinnerStyles} />
      {message && <div style={messageStyles}>{message}</div>}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );

  if (overlay) {
    return (
      <div style={overlayStyles}>
        {spinnerComponent}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      {spinnerComponent}
    </div>
  );
};

export default LoadingSpinner;