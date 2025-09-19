// ==================================================================
// CALEA: app/components/ui/Button.tsx
// DATA: 19.09.2025 20:02 (ora României)
// DESCRIERE: Componenta Button glassmorphism cu variante și stări
// FUNCȚIONALITATE: Button modern cu loading, disabled și variante de culoare
// ==================================================================

'use client';

import React, { ReactNode, CSSProperties } from 'react';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  className = '',
  style = {},
  onClick,
  type = 'button'
}) => {
  const getVariantStyles = (variant: string) => {
    const variants = {
      primary: {
        background: 'rgba(59, 130, 246, 0.9)',
        color: 'white',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        hover: {
          background: 'rgba(59, 130, 246, 1)',
          boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)'
        }
      },
      secondary: {
        background: 'rgba(107, 114, 128, 0.1)',
        color: '#374151',
        border: '1px solid rgba(107, 114, 128, 0.2)',
        hover: {
          background: 'rgba(107, 114, 128, 0.2)',
          boxShadow: '0 8px 24px rgba(107, 114, 128, 0.2)'
        }
      },
      success: {
        background: 'rgba(16, 185, 129, 0.9)',
        color: 'white',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        hover: {
          background: 'rgba(16, 185, 129, 1)',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'
        }
      },
      warning: {
        background: 'rgba(245, 158, 11, 0.9)',
        color: 'white',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        hover: {
          background: 'rgba(245, 158, 11, 1)',
          boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)'
        }
      },
      danger: {
        background: 'rgba(239, 68, 68, 0.9)',
        color: 'white',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        hover: {
          background: 'rgba(239, 68, 68, 1)',
          boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)'
        }
      },
      ghost: {
        background: 'transparent',
        color: '#374151',
        border: 'none',
        hover: {
          background: 'rgba(107, 114, 128, 0.1)',
          boxShadow: 'none'
        }
      },
      outline: {
        background: 'rgba(255, 255, 255, 0.1)',
        color: '#374151',
        border: '1px solid rgba(107, 114, 128, 0.3)',
        hover: {
          background: 'rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }
      }
    };
    return variants[variant as keyof typeof variants] || variants.primary;
  };

  const getSizeStyles = (size: string) => {
    const sizes = {
      sm: {
        padding: '0.5rem 1rem',
        fontSize: '0.875rem',
        borderRadius: '8px'
      },
      md: {
        padding: '0.75rem 1.5rem',
        fontSize: '0.875rem',
        borderRadius: '10px'
      },
      lg: {
        padding: '1rem 2rem',
        fontSize: '1rem',
        borderRadius: '12px'
      },
      xl: {
        padding: '1.25rem 2.5rem',
        fontSize: '1.125rem',
        borderRadius: '14px'
      }
    };
    return sizes[size as keyof typeof sizes] || sizes.md;
  };

  const variantStyles = getVariantStyles(variant);
  const sizeStyles = getSizeStyles(size);

  const baseStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: icon ? '0.5rem' : '0',
    fontWeight: '600',
    cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(10px)',
    width: fullWidth ? '100%' : 'auto',
    opacity: (disabled || loading) ? 0.6 : 1,
    ...variantStyles,
    ...sizeStyles,
    ...style
  };

  const handleClick = () => {
    if (!disabled && !loading && onClick) {
      onClick();
    }
  };

  return (
    <button
      type={type}
      className={className}
      style={baseStyles}
      onClick={handleClick}
      disabled={disabled || loading}
      onMouseOver={(e) => {
        if (!disabled && !loading) {
          Object.assign(e.currentTarget.style, variantStyles.hover);
        }
      }}
      onMouseOut={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.background = variantStyles.background;
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        }
      }}
    >
      {loading && (
        <div
          style={{
            width: '1rem',
            height: '1rem',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
      )}

      {!loading && icon && iconPosition === 'left' && (
        <span style={{ fontSize: '1.1em' }}>{icon}</span>
      )}

      {!loading && children}

      {!loading && icon && iconPosition === 'right' && (
        <span style={{ fontSize: '1.1em' }}>{icon}</span>
      )}

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </button>
  );
};

export default Button;