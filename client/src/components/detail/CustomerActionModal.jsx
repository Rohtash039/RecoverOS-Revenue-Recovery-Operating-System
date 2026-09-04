import { useState } from 'react';
import { Modal } from '../common/Modal';
import { formatINR, formatDate } from '../../utils/formatters';
import {
  CheckCircle2, Clock, CreditCard, QrCode, Copy, Check, ExternalLink, ShieldCheck, AlertCircle, Building2, Smartphone
} from 'lucide-react';

export function CustomerActionModal({ isOpen, onClose, actionType, caseData }) {
  const [copied, setCopied] = useState(false);
  const [selectedAltMethod, setSelectedAltMethod] = useState('UPI');

  if (!isOpen || !caseData) return null;

  const rc = caseData.case || caseData;
  const customer = caseData.customer || rc.customer;
  const transaction = caseData.transaction || rc.transaction;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const normalizedType = (() => {
    const t = (actionType || '').toUpperCase();
    if (t.includes('CONFIRM')) return 'CONFIRMATION';
    if (t.includes('STATUS')) return 'STATUS';
    if (t.includes('ALTERNATE') || t.includes('PAYMENT')) return 'ALTERNATE_PAYMENT';
    return 'CONFIRMATION';
  })();

  const titleMap = {
    CONFIRMATION: 'Customer Payment Receipt & Confirmation',
    STATUS: 'Live Transaction Status Portal',
    ALTERNATE_PAYMENT: 'Customer Alternate Payment Gateway'
  };

  const amount = rc.recoveredAmount || rc.initialRevenueAtRisk || transaction?.amount || 0;
  const checkoutUrl = `https://checkout.recoveros.io/pay/${rc.transactionId || 'TXN-8000'}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={titleMap[normalizedType]}
      maxWidth="max-w-lg"
    >

      {normalizedType === 'CONFIRMATION' && (
        <div className="space-y-4 text-xs font-sans">
          <div className="p-4 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <div className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">
                Payment Successfully Recovered
              </div>
              <p className="text-emerald-700 dark:text-emerald-400 text-xs mt-0.5">
                Funds have been recovered and settled via the smart retry engine.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 p-4 space-y-2.5">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-neutral-500 dark:text-neutral-400">Amount Recovered</span>
              <span className="font-mono text-base font-bold text-neutral-900 dark:text-neutral-100">
                {formatINR(amount)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-neutral-500 dark:text-neutral-400">Transaction ID</span>
              <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                {rc.transactionId}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-neutral-500 dark:text-neutral-400">Recovery Case ID</span>
              <span className="font-mono text-neutral-700 dark:text-neutral-300">
                {rc.recoveryCaseId}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-neutral-500 dark:text-neutral-400">Customer</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {customer?.name || 'Enterprise Customer'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-neutral-500 dark:text-neutral-400">Payment Rail</span>
              <span className="text-neutral-700 dark:text-neutral-300">
                {transaction?.paymentMethod || 'Primary Gateway'} (Auto-Recovered)
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-neutral-500 dark:text-neutral-400">Settlement Time</span>
              <span className="font-mono text-neutral-600 dark:text-neutral-400">
                {formatDate(rc.updatedAt || new Date().toISOString())}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => handleCopy(`Receipt ${rc.transactionId} - ${formatINR(amount)} Recovered`)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 text-xs font-semibold transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Receipt Details' : 'Copy Receipt Details'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {normalizedType === 'STATUS' && (
        <div className="space-y-4 text-xs font-sans">
          <div className="p-4 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center gap-3">
            <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <div className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                Transaction Review in Progress
              </div>
              <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                High-value threshold verification active. No unauthorized retry has been dispatched.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 p-4 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-neutral-500 dark:text-neutral-400">Transaction Value</span>
              <span className="font-mono text-base font-bold text-neutral-900 dark:text-neutral-100">
                {formatINR(amount)}
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                Verification Pipeline:
              </div>
              <div className="space-y-1.5 pl-2 border-l-2 border-amber-400 dark:border-amber-600">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">1. Initial Failure Diagnosed</span>
                  <span className="text-neutral-400 font-mono">Passed</span>
                </div>
                <div className="flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 font-medium">
                  <span>2. Held for Human Operator Approval (₹50k+ Rule)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/80">Active</span>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500">
                  <span>3. Execution of Authorized Routing</span>
                  <span className="text-[10px] font-mono">Pending</span>
                </div>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Customer Notice: Your account is safe and no double charge can occur. Review typically completes within 15 minutes.
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => handleCopy(`https://status.recoveros.io/track/${rc.transactionId}`)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 text-xs font-semibold transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Status URL' : 'Copy Customer Status Link'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {normalizedType === 'ALTERNATE_PAYMENT' && (
        <div className="space-y-4 text-xs font-sans">
          <div className="p-4 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-neutral-700 dark:text-neutral-300 shrink-0" />
            <div>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                Alternate Payment Rails
              </div>
              <p className="text-neutral-600 dark:text-neutral-400 text-xs mt-0.5">
                Automated retries on previous instrument were stopped. Select a secondary payment channel.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 p-4 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-neutral-500 dark:text-neutral-400">Payable Amount</span>
              <span className="font-mono text-base font-bold text-neutral-900 dark:text-neutral-100">
                {formatINR(amount)}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                Select Alternate Method for Customer:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'UPI', label: 'UPI / QR', icon: Smartphone },
                  { id: 'NETBANKING', label: 'NetBanking', icon: Building2 },
                  { id: 'CARD', label: 'Secondary Card', icon: CreditCard }
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setSelectedAltMethod(id)}
                    className={`p-2.5 rounded-md border text-xs font-medium flex flex-col items-center gap-1.5 transition-colors ${
                      selectedAltMethod === id
                        ? 'bg-white dark:bg-neutral-800 border-neutral-900 dark:border-white text-neutral-900 dark:text-white shadow-sm'
                        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
              <div className="text-[10px] font-mono text-neutral-400 uppercase">Generated Checkout URL</div>
              <div className="font-mono text-[11px] text-sky-600 dark:text-sky-400 truncate">
                {checkoutUrl}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => handleCopy(checkoutUrl)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 text-xs font-semibold transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Payment Link' : 'Copy Instant Checkout Link'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

