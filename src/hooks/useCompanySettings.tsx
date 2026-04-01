import React, { createContext, useContext, useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

interface CompanySettings {
  companyName: string;
  sdrName: string;
  loading: boolean;
  isAdmin: boolean;
  refetch: () => Promise<void>;
}

const CompanySettingsContext = createContext<CompanySettings | undefined>(undefined);

export const CompanySettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companyName, setCompanyName] = useState('Minha Empresa');
  const [sdrName, setSdrName] = useState('LiveChat');
  const [loading, setLoading] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // Try company endpoint first
      try {
        const res = await fetch(`${API_BASE}/company`);
        if (res.ok) {
          const company = await res.json();
          if (company?.name) setCompanyName(company.name);
          if (company?.agentName) setSdrName(company.agentName);
          return;
        }
      } catch {}

      // Fallback: try livechat_settings endpoint
      try {
        const res = await fetch(`${API_BASE}/livechat_settings`);
        if (res.ok) {
          const json = await res.json();
          const data = json?.data ?? json;
          if (data?.company_name) setCompanyName(data.company_name);
          if (data?.sdr_name) setSdrName(data.sdr_name);
          return;
        }
      } catch {}

      // Backend unavailable — use defaults
      setCompanyName('Minha Empresa');
      setSdrName('LiveChat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const value: CompanySettings = {
    companyName,
    sdrName,
    loading,
    isAdmin: true, // Always admin in mock mode
    refetch: fetchSettings,
  };

  return (
    <CompanySettingsContext.Provider value={value}>
      {children}
    </CompanySettingsContext.Provider>
  );
};

export const useCompanySettings = () => {
  const context = useContext(CompanySettingsContext);
  if (context === undefined) {
    throw new Error('useCompanySettings must be used within a CompanySettingsProvider');
  }
  return context;
};
