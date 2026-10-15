import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrandingConfig } from './types.js';
import { customizationApi } from './customizationApi.js';

interface BrandingContextType {
  branding: BrandingConfig;
  loading: boolean;
  refreshBranding: () => Promise<void>;
  updateBranding: (data: Partial<BrandingConfig>) => Promise<void>;
  formatCurrency: (amount: number | undefined | null) => string;
  formatDate: (dateStr: string | Date | undefined | null) => string;
}

const DEFAULT_BRANDING: BrandingConfig = {
  companyName: 'Acme Corporation',
  portalTitle: 'ITAM Enterprise Hub',
  primaryColor: '#2563eb',
  accentColor: '#10b981',
  headerBgColor: '#0f172a',
  loginBannerText: 'Welcome to Acme Global Enterprise IT Asset Management System. Authorized personnel only.',
  currencySymbol: '$',
  currencyCode: 'USD',
  dateFormat: 'YYYY-MM-DD',
  supportEmail: 'it-support@acme-corp.com',
};

const BrandingContext = createContext<BrandingContextType>({
  branding: DEFAULT_BRANDING,
  loading: false,
  refreshBranding: async () => {},
  updateBranding: async () => {},
  formatCurrency: () => '',
  formatDate: () => '',
});

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const data = await customizationApi.getBranding();
      if (data) {
        setBranding({ ...DEFAULT_BRANDING, ...data });
        applyBrandingToDOM(data);
      }
    } catch (e) {
      console.warn('Failed to fetch dynamic branding, using defaults:', e);
    } finally {
      setLoading(false);
    }
  };

  const applyBrandingToDOM = (cfg: BrandingConfig) => {
    if (cfg.companyName || cfg.portalTitle) {
      document.title = `${cfg.companyName || cfg.portalTitle} - IT Asset Management`;
    }

    // Dynamic Favicon
    if (cfg.faviconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = cfg.faviconUrl;
    }

    // Dynamic Root CSS variables & Custom CSS Injection
    const root = document.documentElement;
    if (cfg.primaryColor) {
      root.style.setProperty('--primary-color', cfg.primaryColor);
    }
    if (cfg.accentColor) {
      root.style.setProperty('--accent-color', cfg.accentColor);
    }

    // Custom CSS tag
    const customStyleId = 'custom-enterprise-css';
    let styleTag = document.getElementById(customStyleId) as HTMLStyleElement | null;
    if (cfg.customCss) {
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = customStyleId;
        document.head.appendChild(styleTag);
      }
      styleTag.innerHTML = cfg.customCss;
    } else if (styleTag) {
      styleTag.remove();
    }

    if (cfg.companyName) {
      try {
        const savedUser = localStorage.getItem('itam_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.organization) {
            parsed.organization.name = cfg.companyName;
            localStorage.setItem('itam_user', JSON.stringify(parsed));
          }
        }
      } catch (err) {}
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const refreshBranding = async () => {
    await fetchBranding();
  };

  const updateBranding = async (data: Partial<BrandingConfig>) => {
    const updated = await customizationApi.updateBranding(data);
    const merged = { ...branding, ...updated };
    setBranding(merged);
    applyBrandingToDOM(merged);
  };

  const formatCurrency = (amount: number | undefined | null): string => {
    if (amount === undefined || amount === null || isNaN(amount)) return `${branding.currencySymbol}0`;
    return `${branding.currencySymbol}${Number(amount).toLocaleString()}`;
  };

  const formatDate = (dateStr: string | Date | undefined | null): string => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');

      if (branding.dateFormat === 'DD/MM/YYYY') return `${dd}/${mm}/${yyyy}`;
      if (branding.dateFormat === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return String(dateStr);
    }
  };

  return (
    <BrandingContext.Provider
      value={{
        branding,
        loading,
        refreshBranding: fetchBranding,
        updateBranding,
        formatCurrency,
        formatDate,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
