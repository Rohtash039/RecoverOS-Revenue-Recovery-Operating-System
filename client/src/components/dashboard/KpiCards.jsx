import React from 'react';
import { DollarSign, TrendingUp, AlertTriangle, ShieldCheck, Target, ArrowUpRight } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

export function KpiCards({ summary }) {
  if (!summary) return null;

  const {
    initialRevenueAtRisk = 0,
    recoveredRevenue = 0,
    remainingRevenueAtRisk = 0,
    recoveryRate = 0,
    expectedRecovery = 0,
    expectedRecoveryAttainment = 0,
    activeCasesCount = 0,
    casesByState = {}
  } = summary;

  const escalatedCount = casesByState.ESCALATED || 0;
  const recoveredCount = casesByState.RECOVERED || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {/* 1. Initial Revenue at Risk */}
      <div className="p-3.5 rounded-lg bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between transition-colors">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Initial at Risk
        </div>
        <div className="mt-1.5">
          <div className="text-lg font-semibold font-mono text-neutral-900 dark:text-neutral-100">
            {formatINR(initialRevenueAtRisk)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Remaining: <span className="font-mono text-neutral-700 dark:text-neutral-300">{formatINR(remainingRevenueAtRisk)}</span>
          </div>
        </div>
      </div>

      {/* 2. Recovered Revenue */}
      <div className="p-3.5 rounded-lg bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between transition-colors">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Revenue Recovered
        </div>
        <div className="mt-1.5">
          <div className="text-lg font-semibold font-mono text-neutral-900 dark:text-neutral-100">
            {formatINR(recoveredRevenue)}
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-medium">
            {recoveredCount} recoveries
          </div>
        </div>
      </div>

      {/* 3. Recovery Rate */}
      <div className="p-3.5 rounded-lg bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between transition-colors">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Recovery Rate
        </div>
        <div className="mt-1.5">
          <div className="text-lg font-semibold font-mono text-neutral-900 dark:text-neutral-100">
            {recoveryRate}%
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Of total exposed revenue
          </div>
        </div>
      </div>

      {/* 4. Expected Recovery & Attainment */}
      <div className="p-3.5 rounded-lg bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between transition-colors">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Expected Recovery
        </div>
        <div className="mt-1.5">
          <div className="text-lg font-semibold font-mono text-neutral-900 dark:text-neutral-100">
            {formatINR(expectedRecovery)}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Attainment: <span className="font-mono text-neutral-700 dark:text-neutral-300 font-medium">{expectedRecoveryAttainment}%</span>
          </div>
        </div>
      </div>

      {/* 5. Active & Escalated Cases */}
      <div className="p-3.5 rounded-lg bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between transition-colors">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Active Pipeline
        </div>
        <div className="mt-1.5">
          <div className="text-lg font-semibold font-mono text-neutral-900 dark:text-neutral-100">
            {activeCasesCount} <span className="text-xs font-normal text-neutral-500">cases</span>
          </div>
          <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 font-medium">
            {escalatedCount} requiring review
          </div>
        </div>
      </div>
    </div>
  );
}
