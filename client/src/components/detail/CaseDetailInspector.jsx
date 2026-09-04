import { useState, useEffect } from 'react';
import { Drawer } from '../common/Drawer';
import { StateBadge, DecisionBadge, ActorBadge, InvoiceBadge } from '../common/Badge';
import { ScorePill } from '../common/ScorePill';
import { ScoreFactorBreakdown } from './ScoreFactorBreakdown';
import { CustomerActionModal } from './CustomerActionModal';
import { formatINR, formatDate } from '../../utils/formatters';
import { ACTION_LABELS } from '../../utils/constants';
import {
  ShieldCheck, MessageSquare, Play, AlertTriangle, ExternalLink
} from 'lucide-react';

export function CaseDetailInspector({
  isOpen,
  onClose,
  caseData,
  onAnalyzeCase,
  onOpenApproval,
  isProcessingAction
}) {
  const [activeTab, setActiveTab] = useState('DIAGNOSIS');
  const [customerActionModal, setCustomerActionModal] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('DIAGNOSIS');
    }
  }, [isOpen, caseData?.case?.recoveryCaseId]);

  if (!isOpen || !caseData) return null;

  const { case: rc, customer, transaction, actions = [], auditLogs = [] } = caseData;
  const isEscalated = rc.state === 'ESCALATED';
  const isAtRisk = rc.state === 'AT_RISK';
  const isInvoice = transaction?.eventType === 'INVOICE_OVERDUE' || Boolean(transaction?.metadata?.invoiceNumber);

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-neutral-900 dark:text-neutral-100 font-semibold">{rc.transactionId}</span>
            {isInvoice && (
              <InvoiceBadge
                invoiceNumber={transaction?.metadata?.invoiceNumber}
                daysOverdue={transaction?.metadata?.daysOverdue}
              />
            )}
            <StateBadge state={rc.state} />
          </div>
        }
        width="max-w-2xl"
      >
        <div className="space-y-4">

          <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
            <div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-mono">Revenue at Risk</div>
              <div className="text-base font-semibold font-mono text-neutral-900 dark:text-neutral-100">{formatINR(rc.initialRevenueAtRisk)}</div>
              {rc.state === 'RECOVERED' && (
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">+ {formatINR(rc.recoveredAmount)}</div>
              )}
            </div>

            <div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-mono">Customer</div>
              <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">{customer?.name || 'Customer'}</div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">{customer?.tier} • {customer?.previousSuccessfulPayments || 0} successes</div>
            </div>

            <div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-mono">Failure Code</div>
              <div className="text-xs font-mono font-medium text-neutral-800 dark:text-neutral-200">{isInvoice ? 'INVOICE_OVERDUE' : transaction?.failureCode}</div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">{isInvoice ? `${transaction?.metadata?.daysOverdue || 30}d overdue` : transaction?.failureReason}</div>
            </div>

            <div className="text-right sm:text-center">
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-mono mb-0.5">ROS Score</div>
              <ScorePill score={rc.recoveryScore} size="lg" />
            </div>
          </div>

          {isInvoice && (
            <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-indigo-900 dark:text-indigo-200">Commercial Invoice:</span>
                <span className="font-mono text-indigo-800 dark:text-indigo-300 font-medium">{transaction?.metadata?.invoiceNumber || 'INV-2026-XXXX'}</span>
                <span className="text-neutral-400 dark:text-neutral-600">•</span>
                <span className="text-neutral-600 dark:text-neutral-400">Due: <strong className="text-neutral-800 dark:text-neutral-200">{transaction?.metadata?.dueDate ? new Date(transaction.metadata.dueDate).toLocaleDateString() : 'N/A'}</strong></span>
                <span className="text-neutral-400 dark:text-neutral-600">•</span>
                <span className="text-amber-700 dark:text-amber-400 font-medium">{transaction?.metadata?.daysOverdue || 30} Days Overdue</span>
              </div>
              <div className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-100/80 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700/50">
                Extended 90-Day SLA Window
              </div>
            </div>
          )}

          {isEscalated && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Held for Human Operator Authorization ({rc.terminalReason || 'High-value threshold'})</span>
              </div>
              <button
                onClick={() => onOpenApproval(rc)}
                className="px-3 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 text-xs font-semibold transition-colors"
              >
                Authorize Action
              </button>
            </div>
          )}

          {isAtRisk && (
            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                <span>Ready for diagnostic analysis and bounded execution.</span>
              </div>
              <button
                onClick={() => onAnalyzeCase(rc.recoveryCaseId)}
                disabled={isProcessingAction}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Analyze & Execute</span>
              </button>
            </div>
          )}

          <div className="flex border-b border-neutral-200 dark:border-neutral-800 text-xs font-medium space-x-5">
            {[
              { id: 'DIAGNOSIS', label: 'Recovery Recommendation' },
              { id: 'SCORING', label: 'ROS Score Factors' },
              { id: 'POLICY', label: 'Policy Guardrails' },
              { id: 'TIMELINE', label: 'Recovery Journey' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white font-semibold'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'DIAGNOSIS' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">Decision Support Output</span>
                  {rc.aiDiagnosis?.confidence && (
                    <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                      Confidence: {(rc.aiDiagnosis.confidence * 100).toFixed(1)}%
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">Diagnosis Category: </span>
                    <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">{rc.aiDiagnosis?.diagnosisCategory || rc.normalizedFailureCategory}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">Root Cause Analysis: </span>
                    <p className="text-neutral-800 dark:text-neutral-200 mt-0.5 leading-relaxed">{rc.aiDiagnosis?.rootCauseAnalysis || 'Pending analysis'}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">Recommended Intervention: </span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {ACTION_LABELS[rc.aiDiagnosis?.recommendedAction] || rc.aiDiagnosis?.recommendedAction || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">Strategic Reasoning: </span>
                    <p className="text-neutral-700 dark:text-neutral-300 mt-0.5 leading-relaxed italic">{rc.aiDiagnosis?.reasoning || '—'}</p>
                  </div>
                </div>
              </div>

              {(() => {
                const msg = (() => {
                  if (rc.state === 'ESCALATED') {
                    return {
                      channel: rc.aiDiagnosis?.customerMessage?.channel || 'EMAIL',
                      headline: 'Transaction Review in Progress',
                      body: 'Your high-value transaction encountered a temporary delay and is pending review by our operations team. No automated charges or retries have been dispatched.',
                      cta: 'View Status'
                    };
                  }
                  if (rc.state === 'RECOVERED') {
                    return {
                      channel: rc.aiDiagnosis?.customerMessage?.channel || 'EMAIL',
                      headline: 'Payment Successfully Completed',
                      body: `Your payment of ${formatINR(rc.recoveredAmount || rc.initialRevenueAtRisk)} has been successfully recovered and confirmed.`,
                      cta: 'View Confirmation'
                    };
                  }
                  if (rc.state === 'STOPPED') {
                    return {
                      channel: rc.aiDiagnosis?.customerMessage?.channel || 'EMAIL',
                      headline: 'Payment Recovery Discontinued',
                      body: 'Automated recovery for this transaction has been halted in accordance with safety guardrails. Please use an alternate payment method if needed.',
                      cta: 'Alternate Payment'
                    };
                  }
                  return rc.aiDiagnosis?.customerMessage || null;
                })();

                if (!msg?.body) return null;

                return (
                  <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
                    <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-medium">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Customer Communication Template ({msg.channel})</span>
                    </div>
                    <div className="p-3 rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs">{msg.headline}</div>
                      <p className="text-neutral-600 dark:text-neutral-400 text-xs leading-relaxed">{msg.body}</p>
                      <div className="pt-1.5">
                        <button
                          type="button"
                          onClick={() => setCustomerActionModal({ type: msg.cta, caseData })}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 text-[11px] font-semibold transition-colors cursor-pointer shadow-sm"
                        >
                          <span>{msg.cta}</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'SCORING' && (
            <ScoreFactorBreakdown factors={rc.scoreFactors} />
          )}

          {activeTab === 'POLICY' && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Policy Guardrail Evaluation</span>
                  </div>
                  {rc.policyEvaluation?.decision && (
                    <DecisionBadge decision={rc.policyEvaluation.decision} />
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">Proposed Action: </span>
                    <span className="font-mono text-neutral-800 dark:text-neutral-200">{rc.policyEvaluation?.originalAction || rc.aiDiagnosis?.recommendedAction || '—'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">Policy Authorized Action: </span>
                    <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">{rc.policyEvaluation?.finalAction || '—'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">Guardrail Reason(s): </span>
                    <div className="mt-1 space-y-1">
                      {rc.policyEvaluation?.reasons?.map((r, i) => (
                        <div key={i} className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200">
                          {r}
                        </div>
                      )) || <div className="text-neutral-500">No policy violations evaluated.</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'TIMELINE' && (
            <div className="space-y-3 text-xs">
              <div className="relative border-l border-neutral-200 dark:border-neutral-800 ml-3 space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.auditId} className="relative pl-5">
                    <div className="absolute -left-1 top-1.5 w-2 h-2 rounded-full bg-neutral-900 dark:bg-white" />
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400">{formatDate(log.timestamp)}</span>
                      <ActorBadge actor={log.actor} />
                      <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">{log.event}</span>
                    </div>
                    {log.reason && (
                      <p className="text-neutral-600 dark:text-neutral-400 text-[11px] mt-0.5 leading-relaxed">{log.reason}</p>
                    )}
                    {log.financialImpact > 0 && (
                      <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 mt-0.5 font-medium">
                        Financial Attribution: + {formatINR(log.financialImpact)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Drawer>

      <CustomerActionModal
        isOpen={!!customerActionModal}
        onClose={() => setCustomerActionModal(null)}
        actionType={customerActionModal?.type}
        caseData={customerActionModal?.caseData || caseData}
      />
    </>
  );
}

