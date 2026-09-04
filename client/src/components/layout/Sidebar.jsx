import { LayoutGrid, Layers, Activity, FileText, X, Settings } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';

export function Sidebar({ currentTab, onSelectTab, escalatedCount = 0, isOpen = true, onClose }) {
  const { currency, currencyConfig, openSettings } = useCurrency();

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'queue', label: 'Recovery Queue', icon: Layers, badge: escalatedCount > 0 ? `${escalatedCount}` : null },
    { id: 'activity', label: 'Agent Activity', icon: Activity },
    { id: 'audit', label: 'Audit Ledger', icon: FileText }
  ];

  return (
    <>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          ${isOpen ? 'flex' : 'hidden'}
          fixed inset-y-0 left-0 z-50 md:static md:z-auto
          w-60 md:w-52 h-full border-r border-neutral-200 dark:border-neutral-800
          bg-white dark:bg-[#0E0E0E] flex-col justify-between py-4 px-2.5 shrink-0
          transition-colors shadow-xl md:shadow-none overflow-y-auto
        `}
      >
        <div className="space-y-3">

          <div className="flex md:hidden items-center justify-between px-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
            <div>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm tracking-tight">RecoverOS</div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400">Revenue Recovery Operations</div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            <div className="px-2.5 pb-2 text-[10px] font-mono tracking-wider text-neutral-400 dark:text-neutral-500 uppercase font-semibold">
              Operations
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 md:py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 md:w-3.5 md:h-3.5 ${isActive ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 dark:text-neutral-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 text-[10px] font-mono font-semibold rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800/80">
          <button
            type="button"
            onClick={openSettings}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/70 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-all text-xs font-medium group cursor-pointer"
            title="Open Display & Currency Settings"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 group-hover:rotate-45 transition-transform duration-200" />
              <span>Settings</span>
            </div>
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
              {currencyConfig?.symbol || '₹'} {currency}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

