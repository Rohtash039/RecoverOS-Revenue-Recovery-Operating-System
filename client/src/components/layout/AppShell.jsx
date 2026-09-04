import React from 'react';
import { TopHeader } from './TopHeader';
import { Sidebar } from './Sidebar';

export function AppShell({ 
  currentTab, 
  onSelectTab, 
  isRunningBatch, 
  onRunBatch, 
  onResetSeed, 
  activeBatch,
  escalatedCount,
  children 
}) {
  return (
    <div className="h-screen w-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors overflow-hidden">
      <TopHeader 
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        escalatedCount={escalatedCount}
        isRunningBatch={isRunningBatch}
        onRunBatch={onRunBatch}
        onResetSeed={onResetSeed}
        activeBatch={activeBatch}
      />
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar 
          currentTab={currentTab}
          onSelectTab={onSelectTab}
          escalatedCount={escalatedCount}
        />
        <main className="flex-1 flex flex-col min-h-0 p-5 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
