import { useState, useEffect } from 'react';
import { TopHeader } from './TopHeader';
import { Sidebar } from './Sidebar';
import { SettingsModal } from '../common/SettingsModal';
import { useCurrency } from '../../context/CurrencyContext';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const { isSettingsOpen, closeSettings } = useCurrency();

  useEffect(() => {
    let prevIsDesktop = window.innerWidth >= 768;

    const handleResize = () => {
      const isDesktop = window.innerWidth >= 768;
      if (isDesktop !== prevIsDesktop) {
        setIsSidebarOpen(isDesktop);
        prevIsDesktop = isDesktop;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const closeMobileSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

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
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={toggleSidebar}
      />
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tabId) => {
            onSelectTab(tabId);
            closeMobileSidebar();
          }}
          escalatedCount={escalatedCount}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 flex flex-col min-h-0 p-3 sm:p-5 overflow-hidden transition-all duration-200">
          {children}
        </main>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
    </div>
  );
}

