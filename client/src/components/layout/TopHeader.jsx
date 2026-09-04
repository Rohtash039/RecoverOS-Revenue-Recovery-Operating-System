import React, { useState } from 'react';
import { Play, RotateCcw, Loader2, Menu, X, MoreVertical, Settings } from 'lucide-react';
import { ThemeToggle } from '../common/ThemeToggle';
import { useCurrency } from '../../context/CurrencyContext';

export function TopHeader({
  currentTab,
  onSelectTab,
  escalatedCount = 0,
  isRunningBatch,
  onRunBatch,
  onResetSeed,
  activeBatch,
  totalCases = 100,
  isSidebarOpen = true,
  onToggleSidebar
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currency, currencyConfig, openSettings } = useCurrency();

  return (
    <header className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0E0E0E] sticky top-0 z-30 flex items-center justify-between px-3 sm:px-5 transition-colors shrink-0">

      <div className="flex items-center gap-2.5 sm:gap-4">

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="w-7 h-7 rounded-md bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white dark:text-neutral-100 flex items-center justify-center transition-all shrink-0 shadow-xs focus:outline-none cursor-pointer active:scale-95"
            title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            <Menu className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight text-sm">RecoverOS</span>
            </div>
            <div className="hidden sm:block text-[10px] text-neutral-500 dark:text-neutral-400">Revenue Recovery Operations</div>
          </div>
        </div>

        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRunningBatch ? 'bg-sky-500 animate-pulse' : 'bg-neutral-400 dark:bg-neutral-500'}`} />
            <span className="text-neutral-700 dark:text-neutral-300 text-[11px] whitespace-nowrap">
              {isRunningBatch ? `Processing (${activeBatch?.processedCases || 0}/${totalCases})` : 'Agent Idle (Ready)'}
            </span>
          </div>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-2.5">
        <ThemeToggle />

        <button
          type="button"
          onClick={openSettings}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition-colors"
          title="Display Currency & System Settings"
        >
          <Settings className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
          <span className="font-mono text-[11px] font-semibold">{currencyConfig?.symbol} {currency}</span>
        </button>

        <button
          onClick={onResetSeed}
          disabled={isRunningBatch}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition-colors disabled:opacity-50"
          title="Resets database to clean 100-case seed state"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo</span>
        </button>

        <button
          onClick={onRunBatch}
          disabled={isRunningBatch}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-950 text-xs font-semibold border border-neutral-900 dark:border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunningBatch ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Running Batch...</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" />
              <span>Run Recovery Batch</span>
            </>
          )}
        </button>
      </div>

      <div className="flex md:hidden items-center gap-2">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Toggle Header Actions"
          aria-label="Toggle Header Actions"
        >
          {isMobileMenuOpen ? <X className="w-4 h-4" /> : <MoreVertical className="w-4 h-4" />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="absolute top-14 left-0 w-full bg-white dark:bg-[#0E0E0E] border-b border-neutral-200 dark:border-neutral-800 shadow-xl p-4 space-y-3 md:hidden z-50 animate-fade-in">
          <div className="flex items-center justify-between pb-1 border-b border-neutral-100 dark:border-neutral-800/80">
            <span className="text-[10px] font-mono uppercase text-neutral-400 dark:text-neutral-500 tracking-wider font-semibold">Controls & Actions</span>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {isRunningBatch ? `Batch in progress (${activeBatch?.processedCases || 0}/${totalCases})` : 'System Ready'}
            </span>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => {
                onRunBatch();
                setIsMobileMenuOpen(false);
              }}
              disabled={isRunningBatch}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-950 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isRunningBatch ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Running Batch...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Recovery Batch</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  openSettings();
                  setIsMobileMenuOpen(false);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Currency: {currencyConfig?.symbol} {currency}</span>
              </button>

              <button
                onClick={() => {
                  onResetSeed();
                  setIsMobileMenuOpen(false);
                }}
                disabled={isRunningBatch}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Demo</span>
              </button>

              <div className="p-1 border border-neutral-200 dark:border-neutral-800 rounded-md bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

