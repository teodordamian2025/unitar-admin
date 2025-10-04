// ==================================================================
// CALEA: app/hooks/useDebounce.ts
// DATA: 04.10.2025 22:30 (ora României)
// DESCRIERE: Custom hook pentru debouncing input values (previne API spam)
// ==================================================================

import { useEffect, useState } from 'react';

/**
 * Hook pentru debouncing - așteaptă delay ms după ultima schimbare înainte de a returna valoarea
 * @param value - Valoarea de debounced
 * @param delay - Delay în milisecunde (default 800ms)
 * @returns Valoarea debounced
 */
export function useDebounce<T>(value: T, delay: number = 800): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Setează timeout pentru update
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup - anulează timeout-ul dacă value se schimbă din nou înainte de delay
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
