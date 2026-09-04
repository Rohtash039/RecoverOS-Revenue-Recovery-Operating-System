import { STATE_COLORS, ACTOR_COLORS } from '../../utils/constants';

export function StateBadge({ state, isBlocked = false }) {
  if (isBlocked && state === 'AT_RISK') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50">
        Blocked
      </span>
    );
  }

  const conf = STATE_COLORS[state] || {
    bg: 'bg-neutral-100 dark:bg-neutral-800',
    text: 'text-neutral-700 dark:text-neutral-300',
    border: 'border-neutral-200 dark:border-neutral-700',
    label: state
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${conf.bg} ${conf.text} ${conf.border}`}>
      {conf.label}
    </span>
  );
}

export function ActorBadge({ actor }) {
  const conf = ACTOR_COLORS[actor] || {
    bg: 'bg-neutral-100 dark:bg-neutral-800',
    text: 'text-neutral-700 dark:text-neutral-300',
    border: 'border-neutral-200 dark:border-neutral-700'
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border ${conf.bg} ${conf.text} ${conf.border}`}>
      {actor}
    </span>
  );
}

export function DecisionBadge({ decision }) {
  if (decision === 'APPROVE') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
        Approved
      </span>
    );
  }
  if (decision === 'MODIFY') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
        Modified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
      Rejected
    </span>
  );
}

export function InvoiceBadge({ invoiceNumber, daysOverdue }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shadow-xs">
      <span className="font-semibold">B2B INVOICE</span>
      {daysOverdue !== undefined && <span>• {daysOverdue}d overdue</span>}
    </span>
  );
}

