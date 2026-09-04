import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useCurrency, CURRENCIES } from '../../context/CurrencyContext';
import { Settings, Coins, Check, Globe } from 'lucide-react';

export function SettingsModal({ isOpen, onClose }) {
  const { currency, setCurrency } = useCurrency();
  const [selectedCurrency, setSelectedCurrency] = useState(currency);

  useEffect(() => {
    if (isOpen) {
      setSelectedCurrency(currency);
    }
  }, [isOpen, currency]);

  if (!isOpen) return null;

  const sampleAmount = 1604366;
  const stagedConfig = CURRENCIES[selectedCurrency] || CURRENCIES.INR;
  const isChanged = selectedCurrency !== currency;

  const previewFormatted = (() => {
    try {
      const converted = sampleAmount * stagedConfig.rate;
      return new Intl.NumberFormat(stagedConfig.locale, {
        style: 'currency',
        currency: stagedConfig.code,
        maximumFractionDigits: stagedConfig.decimals
      }).format(converted);
    } catch {
      return `${stagedConfig.symbol}${Math.round(sampleAmount * stagedConfig.rate).toLocaleString()}`;
    }
  })();

  const handleApply = () => {
    if (isChanged) {
      setCurrency(selectedCurrency);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100 font-semibold text-sm">
          <Settings className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
          <span>System & Display Settings</span>
        </div>
      }
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 text-xs">

        <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs uppercase tracking-wider">
              Display Currency
            </span>
          </div>
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
            <Globe className="w-3 h-3" />
            Live Global Conversion
          </span>
        </div>

        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-mono text-neutral-400 dark:text-neutral-500 font-semibold flex items-center gap-1.5">
              <span>Preview</span>
              {isChanged && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-sans font-medium">
                  Pending Apply
                </span>
              )}
            </div>
            <div className="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-0.5">
              {previewFormatted}
            </div>
          </div>
          <div className="text-right">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              Selected: {stagedConfig.code} ({stagedConfig.symbol})
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {Object.values(CURRENCIES).map((curr) => {
            const isSelected = selectedCurrency === curr.code;
            return (
              <button
                key={curr.code}
                type="button"
                onClick={() => setSelectedCurrency(curr.code)}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0E0E0E] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{curr.flag}</span>
                  <div className="truncate">
                    <div className="font-semibold text-xs leading-tight">
                      {curr.code} <span className="font-mono text-[11px] opacity-75">({curr.symbol})</span>
                    </div>
                    <div className={`text-[10px] truncate ${isSelected ? 'opacity-80' : 'text-neutral-400 dark:text-neutral-500'}`}>
                      {curr.name}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 shrink-0 ml-1.5" />
                )}
              </button>
            );
          })}
        </div>

        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
          <span>Click Done to apply changes across all metrics.</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-3.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold text-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

