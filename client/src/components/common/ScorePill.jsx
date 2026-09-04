import React from 'react';

export function ScorePill({ score = 0, size = 'sm' }) {
  let badgeStyle = 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700';

  if (score >= 75) {
    badgeStyle = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50';
  } else if (score >= 40) {
    badgeStyle = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50';
  } else if (score > 0) {
    badgeStyle = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50';
  }

  if (size === 'lg') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono font-semibold text-sm ${badgeStyle}`}>
        <span>{score}</span>
        <span className="text-[10px] font-normal opacity-70">/ 100</span>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium border ${badgeStyle}`}>
      {score}
    </span>
  );
}
