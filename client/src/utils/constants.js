export const STATE_COLORS = {
  AT_RISK: { 
    bg: 'bg-neutral-100 dark:bg-neutral-800/80', 
    text: 'text-neutral-700 dark:text-neutral-300', 
    border: 'border-neutral-200 dark:border-neutral-700', 
    label: 'At Risk' 
  },
  SCORING: { 
    bg: 'bg-sky-50 dark:bg-sky-950/40', 
    text: 'text-sky-700 dark:text-sky-400', 
    border: 'border-sky-200 dark:border-sky-800/50', 
    label: 'Scoring' 
  },
  ANALYZING: { 
    bg: 'bg-indigo-50 dark:bg-indigo-950/40', 
    text: 'text-indigo-700 dark:text-indigo-400', 
    border: 'border-indigo-200 dark:border-indigo-800/50', 
    label: 'Analyzing' 
  },
  ACTION_PLANNED: { 
    bg: 'bg-blue-50 dark:bg-blue-950/40', 
    text: 'text-blue-700 dark:text-blue-400', 
    border: 'border-blue-200 dark:border-blue-800/50', 
    label: 'Planned' 
  },
  POLICY_CHECK: { 
    bg: 'bg-amber-50 dark:bg-amber-950/40', 
    text: 'text-amber-700 dark:text-amber-400', 
    border: 'border-amber-200 dark:border-amber-800/50', 
    label: 'Policy Check' 
  },
  EXECUTING: { 
    bg: 'bg-sky-50 dark:bg-sky-950/40', 
    text: 'text-sky-700 dark:text-sky-300', 
    border: 'border-sky-200 dark:border-sky-800/50', 
    label: 'Executing' 
  },
  OBSERVING: { 
    bg: 'bg-neutral-100 dark:bg-neutral-800', 
    text: 'text-neutral-700 dark:text-neutral-300', 
    border: 'border-neutral-200 dark:border-neutral-700', 
    label: 'Observing' 
  },
  RECOVERED: { 
    bg: 'bg-emerald-50 dark:bg-emerald-950/40', 
    text: 'text-emerald-700 dark:text-emerald-400', 
    border: 'border-emerald-200 dark:border-emerald-800/50', 
    label: 'Recovered' 
  },
  ESCALATED: { 
    bg: 'bg-amber-50 dark:bg-amber-950/40', 
    text: 'text-amber-700 dark:text-amber-400', 
    border: 'border-amber-200 dark:border-amber-800/50', 
    label: 'Escalated' 
  },
  STOPPED: { 
    bg: 'bg-rose-50 dark:bg-rose-950/40', 
    text: 'text-rose-700 dark:text-rose-400', 
    border: 'border-rose-200 dark:border-rose-800/50', 
    label: 'Stopped' 
  },
  EXPIRED: { 
    bg: 'bg-neutral-100 dark:bg-neutral-800', 
    text: 'text-neutral-600 dark:text-neutral-400', 
    border: 'border-neutral-200 dark:border-neutral-700', 
    label: 'Expired' 
  }
};

export const ACTION_LABELS = {
  RETRY_PAYMENT: 'Retry Payment',
  SEND_PAYMENT_REMINDER: 'Payment Reminder',
  SEND_CHECKOUT_REMINDER: 'Checkout Reminder',
  SUGGEST_ALTERNATE_PAYMENT: 'Alternate Payment Link',
  ESCALATE_TO_HUMAN: 'Escalate to Human',
  STOP_RECOVERY: 'Stop Recovery'
};

export const ACTOR_COLORS = {
  SYSTEM: { 
    bg: 'bg-neutral-100 dark:bg-neutral-800', 
    text: 'text-neutral-700 dark:text-neutral-300', 
    border: 'border-neutral-200 dark:border-neutral-700' 
  },
  AI_AGENT: { 
    bg: 'bg-neutral-100 dark:bg-neutral-800', 
    text: 'text-neutral-800 dark:text-neutral-200', 
    border: 'border-neutral-300 dark:border-neutral-700' 
  },
  POLICY_ENGINE: { 
    bg: 'bg-amber-50 dark:bg-amber-950/40', 
    text: 'text-amber-700 dark:text-amber-400', 
    border: 'border-amber-200 dark:border-amber-800/50' 
  },
  SIMULATOR: { 
    bg: 'bg-neutral-100 dark:bg-neutral-800', 
    text: 'text-neutral-700 dark:text-neutral-300', 
    border: 'border-neutral-200 dark:border-neutral-700' 
  },
  HUMAN: { 
    bg: 'bg-purple-50 dark:bg-purple-950/40', 
    text: 'text-purple-700 dark:text-purple-400', 
    border: 'border-purple-200 dark:border-purple-800/50' 
  }
};
