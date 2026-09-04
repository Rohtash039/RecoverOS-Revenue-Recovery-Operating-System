import { useState, useMemo } from 'react';
import { ActorBadge } from '../common/Badge';
import { formatDate, formatINR } from '../../utils/formatters';
import { Activity, Search, Clock, ArrowRight, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Filter } from 'lucide-react';

export function AgentActivityStream({ activities = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActor, setSelectedActor] = useState('ALL');

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      const matchesActor = selectedActor === 'ALL' || act.actor === selectedActor;
      const term = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        act.transactionId?.toLowerCase().includes(term) ||
        act.event?.toLowerCase().includes(term) ||
        act.actionTaken?.toLowerCase().includes(term) ||
        act.reason?.toLowerCase().includes(term);
      return matchesActor && matchesSearch;
    });
  }, [activities, selectedActor, searchTerm]);

  const actorCounts = useMemo(() => {
    const counts = { ALL: activities.length, AI_AGENT: 0, POLICY_ENGINE: 0, SIMULATOR: 0, HUMAN: 0 };
    activities.forEach(a => {
      if (counts[a.actor] !== undefined) counts[a.actor]++;
    });
    return counts;
  }, [activities]);

  const actors = [
    { key: 'ALL', label: 'All Events' },
    { key: 'AI_AGENT', label: 'AI Agent' },
    { key: 'POLICY_ENGINE', label: 'Policy Engine' },
    { key: 'SIMULATOR', label: 'Simulator' },
    { key: 'HUMAN', label: 'Human' }
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4 overflow-hidden">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Agent Decision Activity Stream
            </h2>
            <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/80 px-2 py-0.5 rounded-full ml-1">
              Live Feed
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Chronological operational stream of recovery decisions, policy evaluations, and executed actions
          </p>
        </div>

        <div className="flex items-center gap-3">

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search TXN, event, reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-[#141414] border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600 w-56 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-xs"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-x-auto shrink-0">
        {actors.map(({ key, label }) => {
          const count = actorCounts[key] || 0;
          const isActive = selectedActor === key;
          return (
            <button
              key={key}
              onClick={() => {
                setSearchTerm('');
                setSelectedActor(key);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                isActive
                  ? 'bg-white dark:bg-[#202020] text-neutral-900 dark:text-white shadow-sm border border-neutral-200/80 dark:border-neutral-700'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <span>{label}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                isActive
                  ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                  : 'bg-neutral-200/60 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
        {filteredActivities.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-12 text-center">
            <Activity className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">No activity matching your criteria</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              {searchTerm ? 'Try clearing your search query' : 'Run a batch simulation to generate operational events'}
            </p>
          </div>
        ) : (
          filteredActivities.map((act) => (
            <div
              key={act.auditId}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800/90 bg-white dark:bg-[#141414] p-4 sm:p-5 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all shadow-sm"
            >

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <ActorBadge actor={act.actor} />

                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/80 text-neutral-900 dark:text-neutral-100">
                    {act.transactionId}
                  </span>

                  <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />

                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {act.event}
                  </span>

                  {act.actionTaken && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-700">
                      {act.actionTaken}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 font-mono shrink-0">
                  <Clock className="w-3 h-3 text-neutral-400" />
                  <span>{formatDate(act.timestamp)}</span>
                </div>
              </div>

              {act.reason && (
                <div className="mt-3.5 pt-3 border-t border-neutral-100 dark:border-neutral-800/70">
                  <p className="text-[13px] leading-relaxed font-sans text-neutral-700 dark:text-neutral-300">
                    {act.reason}
                  </p>
                </div>
              )}

              {act.financialImpact > 0 && (
                <div className="mt-3 pt-2.5 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>+ {formatINR(act.financialImpact)} Recovered</span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

