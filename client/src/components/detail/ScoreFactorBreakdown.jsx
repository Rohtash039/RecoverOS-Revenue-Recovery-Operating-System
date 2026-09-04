import React from 'react';

export function ScoreFactorBreakdown({ factors = {} }) {
  const factorList = [
    { label: 'Failure Recoverability', weight: '30%', score: factors.failureRecoverability || 0, desc: 'Technical transient vs permanent failure category' },
    { label: 'Customer Reliability', weight: '25%', score: factors.customerReliability || 0, desc: 'Historical successful payment velocity and LTV tier' },
    { label: 'Attempt Fatigue', weight: '15%', score: factors.attemptFatigue || 0, desc: 'Remaining retry budget before velocity limits' },
    { label: 'Amount Tier ROI', weight: '15%', score: factors.amountTier || 0, desc: 'Ticket size recovery value relative to dispute risk' },
    { label: 'Recency Window', weight: '15%', score: factors.recency || 0, desc: 'Time elapsed since initial failure event' }
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
          ROS Score Factor Breakdown (0–100)
        </h4>
        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">Weighted Model</span>
      </div>

      <div className="space-y-2">
        {factorList.map((f, idx) => (
          <div key={idx} className="p-2.5 rounded-md bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-800 dark:text-neutral-200 font-medium">
                {f.label} <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">({f.weight})</span>
              </span>
              <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">{f.score} / 100</span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${f.score >= 75 ? 'bg-emerald-600 dark:bg-emerald-400' : f.score >= 40 ? 'bg-amber-600 dark:bg-amber-400' : 'bg-rose-600 dark:bg-rose-400'}`}
                style={{ width: `${f.score}%` }}
              />
            </div>
            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-normal">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
