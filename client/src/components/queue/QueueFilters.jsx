import React from 'react';
import { Search, Filter } from 'lucide-react';

export function QueueFilters({ 
  search, 
  onSearchChange, 
  selectedState, 
  onStateSelect, 
  minScore, 
  onMinScoreChange,
  casesByState = {}
}) {
  const stateTabs = [
    { id: 'ALL', label: 'All Cases' },
    { id: 'ESCALATED', label: 'Escalated', count: casesByState.ESCALATED || 0 },
    { id: 'RECOVERED', label: 'Recovered', count: casesByState.RECOVERED || 0 },
    { id: 'STOPPED', label: 'Stopped', count: casesByState.STOPPED || 0 },
    { id: 'AT_RISK', label: 'At Risk', count: casesByState.AT_RISK || 0 }
  ];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#121212] p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 transition-colors shrink-0">
      {/* State Filter Segmented Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
        {stateTabs.map(tab => {
          const isActive = selectedState === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                onSearchChange(''); // Empty search when clicking other section
                onStateSelect(tab.id);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  isActive
                    ? 'bg-neutral-800 text-neutral-200 dark:bg-neutral-200 dark:text-neutral-800 font-semibold'
                    : tab.id === 'ESCALATED' && tab.count > 0
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-semibold'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search & ROS Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:flex-initial">
          <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search transaction, case or customer ID..."
            className="w-full sm:w-64 pl-8 pr-7 py-1 rounded-md bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-xs"
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
          <span className="text-[11px] font-mono">Min ROS:</span>
          <input
            type="number"
            min="0"
            max="100"
            value={minScore}
            onChange={(e) => onMinScoreChange(e.target.value)}
            placeholder="0"
            className="w-10 px-1 py-0.2 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-mono text-neutral-900 dark:text-neutral-100 text-center focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
