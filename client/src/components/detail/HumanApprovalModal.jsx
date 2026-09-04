import { useState } from 'react';
import { Modal } from '../common/Modal';
import { UserCheck, User } from 'lucide-react';
import { formatINR } from '../../utils/formatters';
import { ACTION_LABELS } from '../../utils/constants';

const OPERATOR_PRESETS = [
  { id: 'ops_lead_priya', label: 'Priya (Ops Lead)' },
  { id: 'ops_analyst_arjun', label: 'Arjun (Risk Analyst)' },
  { id: 'ops_lead_rohtash', label: 'Rohtash (Finance Lead)' }
];

export function HumanApprovalModal({
  isOpen,
  onClose,
  targetCase,
  onAction,
  isProcessing
}) {
  const [operatorId, setOperatorId] = useState('ops_lead_priya');

  if (!isOpen || !targetCase) return null;

  const pendingAction = targetCase.pendingHumanAction || targetCase.aiDiagnosis?.recommendedAction || 'RETRY_PAYMENT';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
          <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Authorize High-Value Recovery Action</span>
        </div>
      }
      maxWidth="max-w-md"
    >
      <div className="space-y-3.5 text-xs">
        <div className="p-3.5 rounded-md bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="font-mono text-neutral-600 dark:text-neutral-400 font-medium">{targetCase.transactionId}</span>
            <span className="font-mono font-semibold text-base text-neutral-900 dark:text-neutral-100">
              {formatINR(targetCase.initialRevenueAtRisk)}
            </span>
          </div>

          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-neutral-500 dark:text-neutral-400">Escalation Reason:</span>
              <span className="text-amber-800 dark:text-amber-300 font-medium text-right max-w-[220px]">
                {targetCase.terminalReason || 'High-value ticket threshold exceeded (₹50k+)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500 dark:text-neutral-400">Proposed Action:</span>
              <span className="text-neutral-900 dark:text-neutral-100 font-medium">{ACTION_LABELS[pendingAction] || pendingAction}</span>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-md bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
              <User className="w-3.5 h-3.5 text-neutral-500" />
              <span>Authorizing Operator Identity:</span>
            </label>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">audit-attributed</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {OPERATOR_PRESETS.map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => setOperatorId(op.id)}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                  operatorId === op.id
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold'
                    : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            placeholder="e.g. ops_lead_custom"
            className="w-full px-2.5 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono text-[11px] focus:outline-hidden focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
          />
        </div>

        <p className="text-neutral-600 dark:text-neutral-400 text-xs leading-relaxed">
          Approving this request transitions <code className="text-amber-700 dark:text-amber-400 font-mono">ESCALATED</code> to <code className="text-neutral-900 dark:text-neutral-100 font-mono">EXECUTING</code>, dispatching the recovery action attributed to <strong className="font-mono text-neutral-800 dark:text-neutral-200">{operatorId}</strong>.
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => onAction(targetCase.recoveryCaseId, 'REJECT_ESCALATION', operatorId)}
            disabled={isProcessing || !operatorId.trim()}
            className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition-colors disabled:opacity-50"
          >
            Reject & Stop
          </button>

          <button
            onClick={() => onAction(targetCase.recoveryCaseId, 'APPROVE_ESCALATION', operatorId)}
            disabled={isProcessing || !operatorId.trim()}
            className="px-3.5 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-950 text-xs font-semibold border border-neutral-900 dark:border-white transition-colors disabled:opacity-50"
          >
            Authorize & Execute
          </button>
        </div>
      </div>
    </Modal>
  );
}

