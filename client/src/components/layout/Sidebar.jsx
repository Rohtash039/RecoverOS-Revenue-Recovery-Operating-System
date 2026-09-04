import React from 'react';
import { LayoutGrid, Layers, Activity, FileText } from 'lucide-react';

export function Sidebar({ currentTab, onSelectTab, escalatedCount = 0 }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'queue', label: 'Recovery Queue', icon: Layers, badge: escalatedCount > 0 ? `${escalatedCount}` : null },
    { id: 'activity', label: 'Agent Activity', icon: Activity },
    { id: 'audit', label: 'Audit Ledger', icon: FileText }
  ];

  return (
    <aside className="hidden md:flex w-52 h-full border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0E0E0E] flex-col justify-between py-4 px-2.5 shrink-0 transition-colors overflow-y-auto">
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
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 dark:text-neutral-500'}`} />
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

      {/* Simulator Status Footnote */}
      <div className="px-3 py-2.5 rounded-md bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400 space-y-0.5">
        <div className="font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />
          Simulator: Deterministic
        </div>
        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-normal">
          Synthetic dataset & policy rules.
        </p>
      </div>
    </aside>
  );
}
