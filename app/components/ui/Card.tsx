// ==================================================================
// CALEA: app/components/ui/Card.tsx
// DATA: 19.09.2025 20:00 (ora României)
// DESCRIERE: Componenta Card glassmorphism reutilizabilă cu variante
// FUNCȚIONALITATE: Card cu backdrop-blur, hover effects și variante de culoare
// ==================================================================

'use client';

import React, { ReactNode, CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
  clickable?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  size = 'md',
  hover = false,
  clickable = false,
  className = '',
  style = {},
  onClick
}) => {
  const getVariantStyles = (variant: string) => {
    const variants = {
      default: {
        background: 'rgba(255, 255, 255, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
      },
      primary: {
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
      },
      success: {
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
      },
      warning: {
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
      },
      danger: {
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
      },
      info: {
        background: 'rgba(6, 182, 212, 0.1)',
        border: '1px solid rgba(6, 182, 212, 0.2)',
      }
    };
    return variants[variant as keyof typeof variants] || variants.default;
  };

  const getSizeStyles = (size: string) => {
    const sizes = {
      sm: { padding: '0.75rem' },
      md: { padding: '1.5rem' },
      lg: { padding: '2rem' },
      xl: { padding: '2.5rem' }
    };
    return sizes[size as keyof typeof sizes] || sizes.md;
  };

  const variantStyles = getVariantStyles(variant);
  const sizeStyles = getSizeStyles(size);

  const baseStyles: CSSProperties = {
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s ease',
    cursor: clickable ? 'pointer' : 'default',
    ...variantStyles,
    ...sizeStyles,
    ...style
  };

  const hoverStyles: CSSProperties = hover || clickable ? {
    transform: 'scale(1.02)',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
  } : {};

  return (
    <div
      className={className}
      style={baseStyles}
      onClick={clickable ? onClick : undefined}
      onMouseOver={(e) => {
        if (hover || clickable) {
          Object.assign(e.currentTarget.style, hoverStyles);
        }
      }}
      onMouseOut={(e) => {
        if (hover || clickable) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
        }
      }}
    >
      {children}
    </div>
  );
};

export default Card;