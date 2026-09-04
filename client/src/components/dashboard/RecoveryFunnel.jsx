import React from 'react';
import { ArrowRight, ShieldCheck, CheckCircle, Activity, PlayCircle, AlertCircle } from 'lucide-react';

export function RecoveryFunnel({ funnel = {} }) {
  const steps = [
    { label: '1. Detected at Risk', count: funnel.detectedAtRisk || 0 },
    { label: '2. Diagnosed & Scored', count: funnel.analyzed || 0 },
    { label: '3. Policy Authorized', count: funnel.actionable || 0 },
    { label: '4. Actions Dispatched', count: funnel.executed || 0 },
    { label: '5. Recoveries Attributed', count: funnel.recovered || 0 }
  ];

  return (
    <div className="p-4 rounded-lg bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800 space-y-3 transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
          Recovery Pipeline Progression
        </h3>
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
          Deterministic Bounded Execution
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
        {steps.map((step, idx) => (
          <div key={idx} className="p-2.5 rounded-md bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 truncate mb-1">
              {step.label}
            </div>
            <div className="text-base font-semibold font-mono text-neutral-900 dark:text-neutral-100">
              {step.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
