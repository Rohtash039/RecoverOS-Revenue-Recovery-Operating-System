import React from 'react';
import { Modal } from '../common/Modal';
import { ShieldX, AlertOctagon, CheckCircle2, XCircle } from 'lucide-react';
import { ScorePill } from '../common/ScorePill';

export function WhyNotRetryModal({ isOpen, onClose, explanation, targetCase }) {
  if (!isOpen || !explanation) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
          <ShieldX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <span>Why Automated Recovery Was Blocked</span>
        </div>
      }
      maxWidth="max-w-lg"
    >
      <div className="space-y-3.5 text-xs">
        {/* Case Info Header */}
        <div className="p-3 rounded-md bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
          <div>
            <div className="font-mono font-semibold text-neutral-900 dark:text-neutral-100 text-sm">{targetCase?.transactionId}</div>
            <div className="text-neutral-500 dark:text-neutral-400 font-mono text-[11px] mt-0.5">Failure Code: {explanation.failureCode}</div>
          </div>
          <div className="text-right">
            <div className="text-neutral-500 dark:text-neutral-400 text-[10px] uppercase font-mono mb-0.5">Recovery Score</div>
            <ScorePill score={explanation.recoveryScore} />
          </div>
        </div>

        {/* Structured Policy Decision Reasons */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
            Evaluated Policy Guardrails:
          </div>
          <div className="space-y-1.5">
            {explanation.reasons.map((reason, idx) => (
              <div 
                key={idx} 
                className="p-2.5 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 flex items-start gap-2 text-neutral-800 dark:text-neutral-200"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed text-xs">{reason}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Policy Limits Status */}
        <div className="p-3 rounded-md bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1 text-[11px]">
          <div className="flex justify-between text-neutral-500 dark:text-neutral-400">
            <span>Attempts Executed:</span>
            <span className="font-mono text-neutral-800 dark:text-neutral-200">{explanation.retryCount} of {explanation.maxRetries} Max Allowed</span>
          </div>
          <div className="flex justify-between text-neutral-500 dark:text-neutral-400">
            <span>Automated Recovery Status:</span>
            <span className="text-rose-700 dark:text-rose-400 font-medium">Prohibited by Configured Policy</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
