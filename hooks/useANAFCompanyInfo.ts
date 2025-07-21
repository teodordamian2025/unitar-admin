// ==================================================================
// CALEA: hooks/useANAFCompanyInfo.ts
// DESCRIERE: Hook React pentru integrarea cu ANAF
// ==================================================================

'use client';

import { useState } from 'react';

interface CompanyInfo {
  denumire: string;
  cui: string;
  nrRegCom: string;
  adresa: string;
  telefon: string;
  status: string;
  dataInregistrare: string;
  platitorTva: string;
  dataInceputTva: string | null;
  dataAnulareTva: string | null;
  dataActualizare: string;
  judet: string;
  localitate: string;
  codPostal: string;
  strada: string;
  numar: string;
  bloc: string;
  scara: string;
  etaj: string;
  apartament: string;
}

interface VATInfo {
  isValid: boolean;
  isActive: boolean;
  isVatPayer: boolean;
  data?: {
    denumire: string;
    cui: string;
    status: string;
    platitorTva: string;
    adresa: string;
  };
}

export function useANAFCompanyInfo() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchedCUI, setLastSearchedCUI] = useState<string>('');

  const getCompanyInfo = async (cui: string): Promise<CompanyInfo> => {
    setLoading(true);
    setError(null);
    setLastSearchedCUI(cui);
    
    try {
      const response = await fetch(`/api/anaf/company-info?cui=${encodeURIComponent(cui)}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Eroare la preluarea datelor de la ANAF');
      }
      
      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută la comunicarea cu ANAF';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const verifyVAT = async (cui: string): Promise<VATInfo> => {
    setLoading(true);
    setError(null);
    setLastSearchedCUI(cui);
    
    try {
      const response = await fetch('/api/anaf/verify-vat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cui })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Eroare la verificarea TVA');
      }
      
      return {
        isValid: data.isValid,
        isActive: data.isActive || false,
        isVatPayer: data.isVatPayer || false,
        data: data.data
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută la verificarea TVA';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const isValidCUI = (cui: string): boolean => {
    const cleanCui = cui.replace(/[^0-9]/g, '');
    return cleanCui.length >= 6 && cleanCui.length <= 10;
  };

  const formatCUI = (cui: string): string => {
    const cleanCui = cui.replace(/[^0-9]/g, '');
    return cleanCui ? `RO${cleanCui}` : '';
  };

  return { 
    getCompanyInfo, 
    verifyVAT,
    loading, 
    error,
    lastSearchedCUI,
    clearError,
    isValidCUI,
    formatCUI
  };
}

// Hook auxiliar pentru preluare automată date client
export function useClientANAFSync() {
  const { getCompanyInfo, loading, error } = useANAFCompanyInfo();
  const [clientData, setClientData] = useState<Partial<CompanyInfo> | null>(null);

  const syncClient = async (cui: string) => {
    try {
      const anafData = await getCompanyInfo(cui);
      
      setClientData({
        denumire: anafData.denumire,
        cui: anafData.cui,
        nrRegCom: anafData.nrRegCom,
        adresa: anafData.adresa,
        telefon: anafData.telefon,
        status: anafData.status,
        platitorTva: anafData.platitorTva,
        judet: anafData.judet,
        localitate: anafData.localitate
      });
      
      return anafData;
    } catch (error) {
      setClientData(null);
      throw error;
    }
  };

  const clearClientData = () => {
    setClientData(null);
  };

  return {
    syncClient,
    clientData,
    setClientData,
    clearClientData,
    loading,
    error
  };
}
