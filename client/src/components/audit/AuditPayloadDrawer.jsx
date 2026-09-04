import { Modal } from '../common/Modal';
import { ActorBadge } from '../common/Badge';
import { formatDate, formatINR } from '../../utils/formatters';
import {  Database } from 'lucide-react';

export function AuditPayloadDrawer({ isOpen, onClose, auditEvent }) {
  if (!isOpen || !auditEvent) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100 font-mono text-xs font-semibold">
          <Database className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
          <span>Audit Record: {auditEvent.auditId}</span>
        </div>
      }
      maxWidth="max-w-xl"
    >
      <div className="space-y-3.5 text-xs font-mono">
        <div className="p-3 rounded-md bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-neutral-500 dark:text-neutral-400">Timestamp:</span>
            <span className="text-neutral-800 dark:text-neutral-200">{formatDate(auditEvent.timestamp)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500 dark:text-neutral-400">Actor:</span>
            <ActorBadge actor={auditEvent.actor} />
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500 dark:text-neutral-400">Event:</span>
            <span className="text-neutral-900 dark:text-neutral-100 font-semibold">{auditEvent.event}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500 dark:text-neutral-400">Transaction ID:</span>
            <span className="text-neutral-800 dark:text-neutral-200">{auditEvent.transactionId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500 dark:text-neutral-400">Financial Impact:</span>
            <span className={auditEvent.financialImpact > 0 ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-neutral-700 dark:text-neutral-300 font-mono font-medium"}>
              {auditEvent.financialImpact > 0
                ? `+ ${formatINR(auditEvent.financialImpact)}`
                : formatINR(auditEvent.payload?.initialRevenueAtRisk || auditEvent.payload?.amount || auditEvent.payload?.recoveredAmount || auditEvent.financialImpact || 0)}
            </span>
          </div>
        </div>

        <div>
          <div className="text-neutral-500 dark:text-neutral-400 text-[10px] mb-1 font-semibold uppercase tracking-wider">
            Raw Event Payload
          </div>
          <pre className="p-3 rounded-md bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 text-[11px] overflow-x-auto font-mono">
            {JSON.stringify(auditEvent.payload || { reason: auditEvent.reason, action: auditEvent.actionTaken }, null, 2)}
          </pre>
        </div>
      </div>
    </Modal>
  );
}

