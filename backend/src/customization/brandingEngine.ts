import { prisma } from '../config/db.js';
import { BrandingConfig } from './types.js';

export const DEFAULT_BRANDING: BrandingConfig = {
  companyName: 'Acme Corporation',
  portalTitle: 'ITAM Enterprise Hub',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#2563eb', // Blue-600
  accentColor: '#10b981', // Emerald-500
  headerBgColor: '#0f172a', // Slate-900
  loginBannerText: 'Welcome to Acme Global Enterprise IT Asset Management System. Authorized personnel only.',
  currencySymbol: '$',
  currencyCode: 'USD',
  dateFormat: 'YYYY-MM-DD',
  supportEmail: 'it-support@acme-corp.com',
  supportPhone: '+1 (555) 019-2834',
  helpdeskUrl: 'https://helpdesk.acme-corp.com',
  customCss: '',
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  CNY: '¥',
  AED: 'AED',
  SGD: 'S$',
};

export const SYMBOL_TO_CODE: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₹': 'INR',
  '¥': 'JPY',
  'A$': 'AUD',
  'C$': 'CAD',
  CHF: 'CHF',
  AED: 'AED',
  'S$': 'SGD',
};

export class BrandingEngine {
  private static CACHE: BrandingConfig | null = null;

  static async getBranding(): Promise<BrandingConfig> {
    if (this.CACHE) return this.CACHE;

    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'customization.branding' },
      });

      if (setting && setting.value) {
        const parsed = JSON.parse(setting.value);
        const config: BrandingConfig = { ...DEFAULT_BRANDING, ...parsed };
        if (config.currencyCode && !config.currencySymbol) {
          config.currencySymbol = CURRENCY_SYMBOLS[config.currencyCode.toUpperCase()] || '$';
        }
        this.CACHE = config;
        return config;
      }

      // Fallback: check legacy system setting or database organization
      const legacyCompanyName = await prisma.systemSetting.findUnique({
        where: { key: 'company.name' },
      });
      const legacyCurrency = await prisma.systemSetting.findUnique({
        where: { key: 'company.currency' },
      });
      const org = await prisma.organization.findFirst();
      const resolvedCompany = legacyCompanyName?.value || org?.name || DEFAULT_BRANDING.companyName;
      const resolvedCurrencyCode = legacyCurrency?.value ? legacyCurrency.value.toUpperCase() : DEFAULT_BRANDING.currencyCode;
      const resolvedCurrencySymbol = CURRENCY_SYMBOLS[resolvedCurrencyCode] || DEFAULT_BRANDING.currencySymbol;

      const config: BrandingConfig = {
        ...DEFAULT_BRANDING,
        companyName: resolvedCompany,
        currencyCode: resolvedCurrencyCode,
        currencySymbol: resolvedCurrencySymbol,
      };
      this.CACHE = config;
      return config;
    } catch (e) {
      console.warn('Failed to load branding from DB, using defaults:', e);
    }

    const fallback: BrandingConfig = { ...DEFAULT_BRANDING };
    this.CACHE = fallback;
    return fallback;
  }

  static async updateBranding(config: Partial<BrandingConfig>): Promise<BrandingConfig> {
    const current = await this.getBranding();

    let currencyCode = config.currencyCode || current.currencyCode;
    let currencySymbol = config.currencySymbol || current.currencySymbol;

    if (config.currencyCode && !config.currencySymbol) {
      currencySymbol = CURRENCY_SYMBOLS[config.currencyCode.toUpperCase()] || '$';
    } else if (config.currencySymbol && !config.currencyCode) {
      currencyCode = SYMBOL_TO_CODE[config.currencySymbol] || 'USD';
    }

    const updated: BrandingConfig = {
      ...current,
      ...config,
      currencyCode: currencyCode ? currencyCode.toUpperCase() : 'USD',
      currencySymbol: currencySymbol || '$',
    };

    await prisma.systemSetting.upsert({
      where: { key: 'customization.branding' },
      update: {
        value: JSON.stringify(updated),
        group: 'BRANDING',
      },
      create: {
        key: 'customization.branding',
        value: JSON.stringify(updated),
        group: 'BRANDING',
      },
    });

    // Synchronize company name with prisma.organization and legacy system setting
    if (updated.companyName) {
      try {
        await prisma.organization.updateMany({
          data: { name: updated.companyName },
        });
        await prisma.systemSetting.upsert({
          where: { key: 'company.name' },
          update: { value: updated.companyName, group: 'BRANDING' },
          create: { key: 'company.name', value: updated.companyName, group: 'BRANDING' },
        });
      } catch (err) {
        console.warn('Failed to sync companyName with Organization table:', err);
      }
    }

    // Synchronize company currency with legacy system setting
    if (updated.currencyCode) {
      try {
        await prisma.systemSetting.upsert({
          where: { key: 'company.currency' },
          update: { value: updated.currencyCode, group: 'BRANDING' },
          create: { key: 'company.currency', value: updated.currencyCode, group: 'BRANDING' },
        });
      } catch (err) {
        console.warn('Failed to sync company.currency with SystemSetting table:', err);
      }
    }

    this.CACHE = updated;
    return updated;
  }

  static async resetBranding(): Promise<BrandingConfig> {
    await prisma.systemSetting.deleteMany({
      where: { key: 'customization.branding' },
    });
    this.CACHE = { ...DEFAULT_BRANDING };
    return this.CACHE;
  }
}
