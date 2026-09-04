import React, { useState } from 'react';
import { Play, RotateCcw, Loader2, Menu, X, LayoutGrid, Layers, Activity, FileText } from 'lucide-react';
import { ThemeToggle } from '../common/ThemeToggle';

export function TopHeader({ 
  currentTab,
  onSelectTab,
  escalatedCount = 0,
  isRunningBatch, 
  onRunBatch, 
  onResetSeed, 
  activeBatch,
  totalCases = 100 
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'queue', label: 'Recovery Queue', icon: Layers, badge: escalatedCount > 0 ? `${escalatedCount}` : null },
    { id: 'activity', label: 'Agent Activity', icon: Activity },
    { id: 'audit', label: 'Audit Ledger', icon: FileText }
  ];

  const handleMobileNavClick = (tabId) => {
    if (onSelectTab) onSelectTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0E0E0E] sticky top-0 z-30 flex items-center justify-between px-3 sm:px-5 transition-colors shrink-0">
      {/* Brand & Status */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs shrink-0">
            R
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight text-sm">RecoverOS</span>
              <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 font-medium">
                FINTECH OPS
              </span>
            </div>
            <div className="hidden sm:block text-[10px] text-neutral-500 dark:text-neutral-400">Revenue Recovery Operations</div>
          </div>
        </div>

        {/* Live Agent Status Indicator - ALWAYS VISIBLE ON SMALL SCREENS */}
        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRunningBatch ? 'bg-sky-500 animate-pulse' : 'bg-neutral-400 dark:bg-neutral-500'}`} />
            <span className="text-neutral-700 dark:text-neutral-300 text-[11px] whitespace-nowrap">
              {isRunningBatch ? `Processing (${activeBatch?.processedCases || 0}/${totalCases})` : 'Agent Idle (Ready)'}
            </span>
          </div>
        </div>
      </div>

      {/* Desktop Action Controls & Theme Toggle (md:flex) */}
      <div className="hidden md:flex items-center gap-2.5">
        <ThemeToggle />

        <button
          onClick={onResetSeed}
          disabled={isRunningBatch}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition-colors disabled:opacity-50"
          title="Resets database to clean 100-case seed state"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo</span>
        </button>

        {/* Enterprise Charcoal/White Primary Action Button */}
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
              <span>Run Recovery Batch (100)</span>
            </>
          )}
        </button>
      </div>

      {/* Mobile Hamburger Button (md:hidden) */}
      <div className="flex md:hidden items-center gap-2">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown / Overlay */}
      {isMobileMenuOpen && (
        <div className="absolute top-14 left-0 w-full bg-white dark:bg-[#0E0E0E] border-b border-neutral-200 dark:border-neutral-800 shadow-xl p-4 space-y-4 md:hidden z-50 animate-fade-in">
          {/* Mobile Navigation Links */}
          <div className="space-y-1">
            <div className="px-2 pb-1 text-[10px] font-mono uppercase text-neutral-400 tracking-wider">Navigation</div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleMobileNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 text-[10px] font-mono font-semibold rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Mobile Actions */}
          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
            <button
              onClick={() => {
                onRunBatch();
                setIsMobileMenuOpen(false);
              }}
              disabled={isRunningBatch}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-950 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isRunningBatch ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Running Batch...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Recovery Batch (100)</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onResetSeed();
                  setIsMobileMenuOpen(false);
                }}
                disabled={isRunningBatch}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 text-xs font-medium"
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
