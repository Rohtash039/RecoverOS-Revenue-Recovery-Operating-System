import { ScorePill } from '../common/ScorePill';
import { StateBadge, DecisionBadge, InvoiceBadge } from '../common/Badge';
import { formatINR } from '../../utils/formatters';
import { ACTION_LABELS } from '../../utils/constants';

export function RecoveryQueueTable({
  cases = [],
  onSelectCase,
  onWhyNotRetry,
  onOpenApproval
}) {
  if (!cases || cases.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-12 text-center rounded-lg bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800 space-y-1.5 transition-colors">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">No recovery cases found</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Try adjusting your search query or status filter.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212] overflow-hidden shadow-sm transition-colors">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs relative">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-[#181818] text-[11px] font-medium text-neutral-600 dark:text-neutral-400 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
              <th className="py-2.5 px-3.5 whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">Transaction / Case</th>
              <th className="py-2.5 px-3.5 whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">Customer</th>
              <th className="py-2.5 px-3.5 text-right whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">Revenue at Risk</th>
              <th className="py-2.5 px-3.5 whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">Failure Reason</th>
              <th className="py-2.5 px-3.5 text-center whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">ROS</th>
              <th className="py-2.5 px-3.5 whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">Recommended Action</th>
              <th className="py-2.5 px-3.5 whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">Policy</th>
              <th className="py-2.5 px-3.5 whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">State</th>
              <th className="py-2.5 px-3.5 text-right whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
            {cases.map((c) => {
              const isEscalated = c.state === 'ESCALATED';
              const isStopped = c.state === 'STOPPED';
              const isHardProhibited = ['FRAUD_SUSPECTED', 'CARD_STOLEN', 'CARD_LOST', 'ACCOUNT_CLOSED', 'DO_NOT_HONOR_PERMANENT'].includes(c.transaction?.failureCode) ||
                ['FRAUD_RISK', 'HARD_DECLINE', 'ACCOUNT_CLOSED'].includes(c.normalizedFailureCategory);
              const isBlocked = c.state === 'AT_RISK' && isHardProhibited;
              const isInvoice = c.transaction?.eventType === 'INVOICE_OVERDUE' || Boolean(c.transaction?.metadata?.invoiceNumber);

              return (
                <tr
                  key={c.recoveryCaseId}
                  className="hover:bg-neutral-50/80 dark:hover:bg-neutral-900/50 transition-colors group"
                >

                  <td className="py-2.5 px-3.5 font-mono">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => onSelectCase(c)}
                        className="text-sky-600 dark:text-sky-400 hover:underline text-left font-medium flex items-center gap-1"
                      >
                        <span>{c.transactionId}</span>
                      </button>
                      {isInvoice && (
                        <InvoiceBadge
                          invoiceNumber={c.transaction?.metadata?.invoiceNumber}
                          daysOverdue={c.transaction?.metadata?.daysOverdue}
                        />
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-normal">
                      {c.recoveryCaseId} {c.transaction?.metadata?.invoiceNumber ? `• ${c.transaction.metadata.invoiceNumber}` : ''}
                    </div>
                  </td>

                  <td className="py-2.5 px-3.5">
                    <div className="text-neutral-900 dark:text-neutral-100 font-medium">{c.customer?.name || 'Customer'}</div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      {c.customer?.tier} • {isInvoice && c.transaction?.metadata?.dueDate ? `Due: ${new Date(c.transaction.metadata.dueDate).toLocaleDateString()}` : `${c.customer?.previousSuccessfulPayments || 0} successes`}
                    </div>
                  </td>

                  <td className="py-2.5 px-3.5 text-right font-mono">
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatINR(c.initialRevenueAtRisk)}
                    </div>
                    {c.state === 'RECOVERED' && (
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                        + {formatINR(c.recoveredAmount)}
                      </div>
                    )}
                  </td>

                  <td className="py-2.5 px-3.5 max-w-[160px]">
                    <div className="text-neutral-800 dark:text-neutral-200 font-medium truncate">
                      {isInvoice ? 'INVOICE OVERDUE' : (c.transaction?.failureCode?.replace(/_/g, ' ') || c.normalizedFailureCategory?.replace(/_/g, ' '))}
                    </div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                      {isInvoice ? `${c.transaction?.metadata?.daysOverdue || 30}d overdue • 90d SLA` : (c.transaction?.failureReason || c.normalizedFailureCategory)}
                    </div>
                  </td>

                  <td className="py-2.5 px-3.5 text-center">
                    <ScorePill score={c.recoveryScore} />
                  </td>

                  <td className="py-2.5 px-3.5">
                    <button
                      onClick={() => onSelectCase(c)}
                      className="text-left group/act"
                      title="Inspect Recovery Recommendation"
                    >
                      <span className="text-neutral-800 dark:text-neutral-200 font-medium group-hover/act:text-sky-600 dark:group-hover/act:text-sky-400 group-hover/act:underline">
                        {ACTION_LABELS[c.aiDiagnosis?.recommendedAction] || c.aiDiagnosis?.recommendedAction || '—'}
                      </span>
                      {c.aiDiagnosis?.confidence && (
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          Confidence: {(c.aiDiagnosis.confidence * 100).toFixed(0)}%
                        </div>
                      )}
                    </button>
                  </td>

                  <td className="py-2.5 px-3.5">
                    {c.policyEvaluation?.decision ? (
                      <DecisionBadge decision={c.policyEvaluation.decision} />
                    ) : (
                      <span className="text-neutral-400 dark:text-neutral-600">—</span>
                    )}
                  </td>

                  <td className="py-2.5 px-3.5">
                    <StateBadge state={c.state} isBlocked={isBlocked} />
                  </td>

                  <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {isEscalated && (
                        <button
                          onClick={() => onOpenApproval(c)}
                          className="px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-medium transition-colors"
                        >
                          Review
                        </button>
                      )}

                      {isStopped && (
                        <button
                          onClick={() => onWhyNotRetry(c)}
                          className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 text-[11px] font-medium transition-colors"
                          title="View why automated retry was blocked"
                        >
                          Why Not Retry?
                        </button>
                      )}

                      <button
                        onClick={() => onSelectCase(c)}
                        className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 text-[11px] font-medium transition-colors"
                      >
                        Inspect
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

