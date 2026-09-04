import { createContext, useContext, useState } from 'react';

export const CURRENCIES = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    flag: '🇮🇳',
    rate: 1,
    locale: 'en-IN',
    decimals: 0
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    flag: '🇺🇸',
    rate: 1 / 83.5,
    locale: 'en-US',
    decimals: 0
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    flag: '🇪🇺',
    rate: 1 / 91.0,
    locale: 'de-DE',
    decimals: 0
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    flag: '🇬🇧',
    rate: 1 / 106.0,
    locale: 'en-GB',
    decimals: 0
  },
  AED: {
    code: 'AED',
    symbol: 'AED ',
    name: 'UAE Dirham',
    flag: '🇦🇪',
    rate: 1 / 22.7,
    locale: 'en-AE',
    decimals: 0
  },
  CAD: {
    code: 'CAD',
    symbol: 'CA$',
    name: 'Canadian Dollar',
    flag: '🇨🇦',
    rate: 1 / 61.5,
    locale: 'en-CA',
    decimals: 0
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    name: 'Singapore Dollar',
    flag: '🇸🇬',
    rate: 1 / 62.5,
    locale: 'en-SG',
    decimals: 0
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    flag: '🇯🇵',
    rate: 1.8,
    locale: 'ja-JP',
    decimals: 0
  }
};

const STORAGE_KEY = 'recoveros_currency';

const CurrencyContext = createContext({
  currency: 'INR',
  currencyConfig: CURRENCIES.INR,
  setCurrency: () => {},
  formatMoney: () => '',
  formatShortMoney: () => '',
  currencies: CURRENCIES,
  isSettingsOpen: false,
  openSettings: () => {},
  closeSettings: () => {}
});

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved && CURRENCIES[saved] ? saved : 'INR';
    } catch {
      return 'INR';
    }
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const setCurrency = (code) => {
    if (!CURRENCIES[code]) return;
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
      window.dispatchEvent(new CustomEvent('recoveros_currency_change', { detail: code }));
    } catch (e) {
      console.warn('Could not save currency to localStorage:', e);
    }
  };

  const currencyConfig = CURRENCIES[currency] || CURRENCIES.INR;

  const formatMoney = (amount = 0) => {
    if (typeof amount !== 'number') amount = Number(amount) || 0;
    const converted = amount * currencyConfig.rate;

    try {
      return new Intl.NumberFormat(currencyConfig.locale, {
        style: 'currency',
        currency: currencyConfig.code,
        maximumFractionDigits: currencyConfig.decimals
      }).format(converted);
    } catch {
      return `${currencyConfig.symbol}${Math.round(converted).toLocaleString()}`;
    }
  };

  const formatShortMoney = (amount = 0) => {
    if (typeof amount !== 'number') amount = Number(amount) || 0;
    const converted = amount * currencyConfig.rate;

    if (currency === 'INR') {
      if (converted >= 100000) {
        return `₹${(converted / 100000).toFixed(2)}L`;
      }
      if (converted >= 1000) {
        return `₹${(converted / 1000).toFixed(1)}k`;
      }
      return `₹${converted.toLocaleString('en-IN')}`;
    }

    if (converted >= 1000000) {
      return `${currencyConfig.symbol}${(converted / 1000000).toFixed(2)}M`;
    }
    if (converted >= 1000) {
      return `${currencyConfig.symbol}${(converted / 1000).toFixed(1)}k`;
    }
    return `${currencyConfig.symbol}${Math.round(converted).toLocaleString()}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencyConfig,
        setCurrency,
        formatMoney,
        formatShortMoney,
        currencies: CURRENCIES,
        isSettingsOpen,
        openSettings: () => setIsSettingsOpen(true),
        closeSettings: () => setIsSettingsOpen(false)
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

