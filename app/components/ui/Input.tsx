// ==================================================================
// CALEA: app/components/ui/Input.tsx
// DATA: 19.09.2025 20:07 (ora României)
// DESCRIERE: Componenta Input glassmorphism cu label, error și variante
// FUNCȚIONALITATE: Input field modern cu validare, icons și diferite tipuri
// ==================================================================

'use client';

import React, { ReactNode, CSSProperties, forwardRef } from 'react';

interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'datetime-local' | 'time';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filled' | 'outline';
  error?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  helperText?: string;
  className?: string;
  style?: CSSProperties;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  placeholder,
  value,
  defaultValue,
  type = 'text',
  size = 'md',
  variant = 'default',
  error,
  disabled = false,
  required = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  helperText,
  className = '',
  style = {},
  onChange,
  onBlur,
  onFocus,
  onKeyDown
}, ref) => {
  const getVariantStyles = (variant: string, hasError: boolean) => {
    const variants = {
      default: {
        background: 'rgba(255, 255, 255, 0.9)',
        border: hasError
          ? '1px solid rgba(239, 68, 68, 0.5)'
          : '1px solid rgba(209, 213, 219, 0.5)',
        focus: {
          border: hasError
            ? '1px solid rgba(239, 68, 68, 0.8)'
            : '1px solid rgba(59, 130, 246, 0.8)',
          boxShadow: hasError
            ? '0 0 0 3px rgba(239, 68, 68, 0.1)'
            : '0 0 0 3px rgba(59, 130, 246, 0.1)'
        }
      },
      filled: {
        background: hasError
          ? 'rgba(239, 68, 68, 0.05)'
          : 'rgba(249, 250, 251, 0.9)',
        border: 'none',
        focus: {
          background: hasError
            ? 'rgba(239, 68, 68, 0.1)'
            : 'rgba(255, 255, 255, 0.9)',
          boxShadow: hasError
            ? '0 0 0 2px rgba(239, 68, 68, 0.2)'
            : '0 0 0 2px rgba(59, 130, 246, 0.2)'
        }
      },
      outline: {
        background: 'transparent',
        border: hasError
          ? '2px solid rgba(239, 68, 68, 0.5)'
          : '2px solid rgba(209, 213, 219, 0.5)',
        focus: {
          border: hasError
            ? '2px solid rgba(239, 68, 68, 0.8)'
            : '2px solid rgba(59, 130, 246, 0.8)',
          background: 'rgba(255, 255, 255, 0.1)'
        }
      }
    };
    return variants[variant as keyof typeof variants] || variants.default;
  };

  const getSizeStyles = (size: string) => {
    const sizes = {
      sm: {
        padding: icon ? '0.5rem 2.5rem 0.5rem 0.75rem' : '0.5rem 0.75rem',
        fontSize: '0.875rem',
        borderRadius: '8px',
        height: '2.25rem'
      },
      md: {
        padding: icon ? '0.75rem 3rem 0.75rem 1rem' : '0.75rem 1rem',
        fontSize: '1rem',
        borderRadius: '10px',
        height: '2.75rem'
      },
      lg: {
        padding: icon ? '1rem 3.5rem 1rem 1.25rem' : '1rem 1.25rem',
        fontSize: '1.125rem',
        borderRadius: '12px',
        height: '3.25rem'
      }
    };
    return sizes[size as keyof typeof sizes] || sizes.md;
  };

  const variantStyles = getVariantStyles(variant, !!error);
  const sizeStyles = getSizeStyles(size);

  const containerStyles: CSSProperties = {
    width: fullWidth ? '100%' : 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  };

  const labelStyles: CSSProperties = {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: error ? '#ef4444' : '#374151',
    marginBottom: '0.25rem'
  };

  const inputWrapperStyles: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  };

  const inputStyles: CSSProperties = {
    width: '100%',
    outline: 'none',
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(10px)',
    color: '#1f2937',
    fontFamily: 'inherit',
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
    paddingLeft: icon && iconPosition === 'left' ? '2.5rem' : sizeStyles.padding.split(' ')[3] || '1rem',
    paddingRight: icon && iconPosition === 'right' ? '2.5rem' : sizeStyles.padding.split(' ')[1] || '1rem',
    paddingTop: sizeStyles.padding.split(' ')[0] || '0.75rem',
    paddingBottom: sizeStyles.padding.split(' ')[2] || '0.75rem',
    fontSize: sizeStyles.fontSize,
    borderRadius: sizeStyles.borderRadius,
    height: sizeStyles.height,
    ...variantStyles,
    ...style
  };

  const iconStyles: CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    color: error ? '#ef4444' : '#6b7280',
    fontSize: '1rem',
    pointerEvents: 'none',
    zIndex: 1
  };

  const leftIconStyles: CSSProperties = {
    ...iconStyles,
    left: '0.75rem'
  };

  const rightIconStyles: CSSProperties = {
    ...iconStyles,
    right: '0.75rem'
  };

  const helperTextStyles: CSSProperties = {
    fontSize: '0.75rem',
    color: error ? '#ef4444' : '#6b7280',
    marginTop: '0.25rem'
  };

  return (
    <div className={className} style={containerStyles}>
      {label && (
        <label style={labelStyles}>
          {label}
          {required && <span style={{ color: '#ef4444', marginLeft: '0.25rem' }}>*</span>}
        </label>
      )}

      <div style={inputWrapperStyles}>
        {icon && iconPosition === 'left' && (
          <span style={leftIconStyles}>{icon}</span>
        )}

        <input
          ref={ref}
          type={type}
          placeholder={placeholder}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          required={required}
          style={inputStyles}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={(e) => {
            Object.assign(e.target.style, variantStyles.focus);
            if (onFocus) onFocus(e);
          }}
          onBlurCapture={(e) => {
            e.target.style.border = variantStyles.border;
            e.target.style.boxShadow = 'none';
            if (variant === 'filled') {
              e.target.style.background = variantStyles.background;
            }
          }}
          onKeyDown={onKeyDown}
        />

        {icon && iconPosition === 'right' && (
          <span style={rightIconStyles}>{icon}</span>
        )}
      </div>

      {(error || helperText) && (
        <span style={helperTextStyles}>
          {error || helperText}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;