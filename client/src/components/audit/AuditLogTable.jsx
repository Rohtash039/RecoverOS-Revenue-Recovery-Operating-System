import React, { useState } from 'react';
import { ActorBadge } from '../common/Badge';
import { formatDate, formatINR } from '../../utils/formatters';
import { AuditPayloadDrawer } from './AuditPayloadDrawer';
import { FileText, Filter, Eye, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { RecoverOSAPI } from '../../api/client';

export function AuditLogTable({ auditLogs = [], actorFilter, onActorFilterChange }) {
  const [selectedLog, setSelectedLog] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const actors = ['ALL', 'SYSTEM', 'AI_AGENT', 'POLICY_ENGINE', 'SIMULATOR', 'HUMAN'];

  const handleVerifyChain = async () => {
    try {
      setIsVerifying(true);
      const res = await RecoverOSAPI.verifyAuditChain();
      setVerificationResult(res);
    } catch (err) {
      console.error('[Chain Verification Error]', err);
      setVerificationResult({ valid: false, reason: err.message });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-3.5 overflow-hidden">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
              <span>Append-Only Compliance Audit Ledger</span>
            </h2>
            <button
              onClick={handleVerifyChain}
              disabled={isVerifying}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-medium border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-neutral-600 dark:text-neutral-400" />
                  <span>Verifying Chain...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Verify Chain Integrity</span>
                </>
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Cryptographically linked SHA-256 audit ledger</p>
            {verificationResult && (
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                verificationResult.valid 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
              }`}>
                {verificationResult.valid ? (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    <span>Valid: {verificationResult.verifiedCount}/{verificationResult.totalEntries} hashes verified</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    <span>Broken at {verificationResult.brokenAtAuditId}</span>
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Actor Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {actors.map((act) => (
            <button
              key={act}
              onClick={() => onActorFilterChange(act)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                actorFilter === act
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              {act}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212] overflow-hidden shadow-sm transition-colors">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs relative">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-[#181818] text-[11px] font-medium text-neutral-600 dark:text-neutral-400 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
                <th className="py-2.5 px-3.5 whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">Timestamp (IST)</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">Actor</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">Transaction ID</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">Event Type</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">Reason / Rule Evaluated</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">Financial Impact</th>
                <th className="py-2.5 px-3.5 text-center whitespace-nowrap bg-neutral-100 dark:bg-[#181818]">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80 font-mono">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400 text-xs font-sans">
                    No audit records found matching active filter.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.auditId} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-900/50 transition-colors">
                    <td className="py-2.5 px-3.5 text-neutral-500 dark:text-neutral-400 text-[11px] whitespace-nowrap">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <ActorBadge actor={log.actor} />
                    </td>
                    <td className="py-2.5 px-3.5 font-semibold text-neutral-900 dark:text-neutral-100">
                      {log.transactionId}
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-neutral-800 dark:text-neutral-200">
                      {log.event}
                    </td>
                    <td className="py-2.5 px-3.5 font-sans text-neutral-600 dark:text-neutral-300 max-w-xs truncate" title={log.reason}>
                      {log.reason || '—'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                      {log.financialImpact > 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-400">+ {formatINR(log.financialImpact)}</span>
                      ) : (
                        <span className="text-neutral-400 dark:text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1 rounded text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        title="View Raw JSON Payload"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AuditPayloadDrawer
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        auditEvent={selectedLog}
      />
    </div>
  );
}
