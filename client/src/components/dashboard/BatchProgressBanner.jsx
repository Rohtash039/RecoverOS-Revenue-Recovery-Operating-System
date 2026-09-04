import React from 'react';
import { Loader2, TrendingUp, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

export function BatchProgressBanner({ activeBatch, totalCases = 100 }) {
  if (!activeBatch || activeBatch.status !== 'RUNNING') return null;

  const processed = activeBatch.processedCases || 0;
  const total = activeBatch.totalCases || totalCases;
  const percentage = Math.min(100, Math.round((processed / total) * 100));

  return (
    <div className="p-3.5 rounded-lg bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800 shadow-sm animate-fade-in space-y-2.5 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Loader2 className="w-3.5 h-3.5 text-neutral-900 dark:text-neutral-100 animate-spin" />
          <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
            Batch Recovery in Progress
          </span>
          <span className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            {processed} / {total} Cases ({percentage}%)
          </span>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="text-emerald-700 dark:text-emerald-400 font-medium">
            Recovered: {formatINR(activeBatch.recoveredAmount || 0)} ({activeBatch.recoveredCases || 0})
          </div>
          <div className="text-amber-700 dark:text-amber-400 font-medium">
            Escalated: {activeBatch.escalatedCases || 0}
          </div>
          <div className="text-neutral-500 dark:text-neutral-400">
            Stopped: {activeBatch.stoppedCases || 0}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
        <div 
          className="h-full bg-neutral-900 dark:bg-white transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
