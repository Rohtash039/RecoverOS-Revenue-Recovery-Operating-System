import { useState, useEffect, useRef } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useCurrency } from './context/CurrencyContext';
import { KpiCards } from './components/dashboard/KpiCards';
import { RecoveryFunnel } from './components/dashboard/RecoveryFunnel';
import { AnalyticsCharts } from './components/dashboard/AnalyticsCharts';
import { BatchProgressBanner } from './components/dashboard/BatchProgressBanner';
import { QueueFilters } from './components/queue/QueueFilters';
import { RecoveryQueueTable } from './components/queue/RecoveryQueueTable';
import { WhyNotRetryModal } from './components/queue/WhyNotRetryModal';
import { CaseDetailInspector } from './components/detail/CaseDetailInspector';
import { HumanApprovalModal } from './components/detail/HumanApprovalModal';
import { AgentActivityStream } from './components/activity/AgentActivityStream';
import { AuditLogTable } from './components/audit/AuditLogTable';
import { RecoverOSAPI } from './api/client';

export default function App() {
  const { currency } = useCurrency();
  const [currentTab, setCurrentTab] = useState('overview');

  const [summary, setSummary] = useState(null);
  const [cases, setCases] = useState([]);
  const [queuePagination, setQueuePagination] = useState({ total: 0, page: 1, limit: 100 });
  const [activities, setActivities] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('ALL');
  const [minScore, setMinScore] = useState('');
  const [actorFilter, setActorFilter] = useState('ALL');

  const [selectedCaseDetail, setSelectedCaseDetail] = useState(null);
  const [whyNotRetryData, setWhyNotRetryData] = useState(null);
  const [whyNotRetryCase, setWhyNotRetryCase] = useState(null);
  const [approvalTargetCase, setApprovalTargetCase] = useState(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [activeBatch, setActiveBatch] = useState(null);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const pollingRef = useRef(null);

  const fetchData = async () => {
    try {
      const [sumData, queueData, actData, auditData] = await Promise.all([
        RecoverOSAPI.getDashboardSummary(),
        RecoverOSAPI.getRecoveryCases({ state: selectedState, search, minScore, limit: 100 }),
        RecoverOSAPI.getAgentActivity(35),
        RecoverOSAPI.getAuditLogs({ actor: actorFilter, limit: 100 })
      ]);
      setSummary(sumData);
      setCases(queueData.cases || []);
      setQueuePagination(queueData.pagination || { total: 0, page: 1, limit: 100 });
      setActivities(actData || []);
      setAuditLogs(auditData.logs || []);
    } catch (err) {
      console.error('[RecoverOS App Error]', err);
    }
  };

  const isPollingRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      await fetchData();
      try {
        const latestBatch = await RecoverOSAPI.getBatchStatus();
        if (latestBatch) {
          setActiveBatch(latestBatch);
          if (latestBatch.status === 'RUNNING') {
            setIsRunningBatch(true);
          }
        }
      } catch (err) {
        // Silently ignore if no batch exists yet
      }
    };
    init();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedState, search, minScore, actorFilter]);

  useEffect(() => {
    if (!isRunningBatch || !activeBatch?.batchId) return;

    pollingRef.current = setInterval(async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const batchStatus = await RecoverOSAPI.getBatchStatus(activeBatch.batchId);
        setActiveBatch(batchStatus);

        const sumData = await RecoverOSAPI.getDashboardSummary();
        setSummary(sumData);

        if (batchStatus.status === 'COMPLETED' || batchStatus.status === 'FAILED') {
          clearInterval(pollingRef.current);
          setIsRunningBatch(false);
          await fetchData();
        }
      } catch (err) {
        console.error('[Polling Error]', err);
        clearInterval(pollingRef.current);
        setIsRunningBatch(false);
      } finally {
        isPollingRef.current = false;
      }
    }, 750);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isRunningBatch, activeBatch?.batchId]);

  const handleRunBatch = async () => {
    try {
      setIsRunningBatch(true);
      const batch = await RecoverOSAPI.runBatchSimulation('FAST');
      setActiveBatch(batch);
    } catch (err) {
      console.error('[Run Batch Error]', err);
      setIsRunningBatch(false);
    }
  };

  const handleResetSeed = async () => {
    try {
      await RecoverOSAPI.resetSimulation();
      setActiveBatch(null);
      setIsRunningBatch(false);
      await fetchData();
    } catch (err) {
      console.error('[Reset Error]', err);
    }
  };

  const handleSelectCase = async (c) => {
    try {
      const fullDetail = await RecoverOSAPI.getRecoveryCaseById(c.recoveryCaseId);
      setSelectedCaseDetail(fullDetail);
    } catch (err) {
      console.error('[Inspect Error]', err);
    }
  };

  const handleWhyNotRetry = async (c) => {
    try {
      const explanation = await RecoverOSAPI.getWhyNotRetry(c.recoveryCaseId);
      setWhyNotRetryData(explanation);
      setWhyNotRetryCase(c);
    } catch (err) {
      console.error('[Why Not Retry Error]', err);
    }
  };

  const handleHumanActionExecute = async (caseId, actionType, operatorId = 'ops_lead_priya') => {
    try {
      setIsProcessingAction(true);
      await RecoverOSAPI.postCaseAction(caseId, actionType, operatorId);
      setApprovalTargetCase(null);
      if (selectedCaseDetail?.case?.recoveryCaseId === caseId) {
        const updated = await RecoverOSAPI.getRecoveryCaseById(caseId);
        setSelectedCaseDetail(updated);
      }
      await fetchData();
    } catch (err) {
      console.error('[Human Action Error]', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleAnalyzeSingleCase = async (caseId) => {
    try {
      setIsProcessingAction(true);
      await RecoverOSAPI.analyzeCase(caseId);
      const updated = await RecoverOSAPI.getRecoveryCaseById(caseId);
      setSelectedCaseDetail(updated);
      await fetchData();
    } catch (err) {
      console.error('[Analyze Case Error]', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleTabChange = (tab) => {
    setSearch('');
    setCurrentTab(tab);
  };

  const escalatedCasesCount = summary?.casesByState?.ESCALATED || 0;

  return (
    <AppShell
      currentTab={currentTab}
      onSelectTab={handleTabChange}
      isRunningBatch={isRunningBatch}
      onRunBatch={handleRunBatch}
      onResetSeed={handleResetSeed}
      activeBatch={activeBatch}
      escalatedCount={escalatedCasesCount}
    >

      <div className="shrink-0 mb-3" key={`batch-banner-${currency}`}>
        <BatchProgressBanner activeBatch={activeBatch} totalCases={summary?.totalCasesCount || 100} />
      </div>

      {currentTab === 'overview' && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1" key={`overview-${currency}`}>
          <KpiCards summary={summary} />
          <RecoveryFunnel funnel={summary?.pipelineFunnel} />
          <AnalyticsCharts
            categories={summary?.recoveryByFailureCategory || []}
            expectedVsActual={summary?.expectedVsActual}
            casesByState={summary?.casesByState}
          />
        </div>
      )}

      {currentTab === 'queue' && (
        <div className="flex-1 min-h-0 flex flex-col space-y-3.5 overflow-hidden" key={`queue-${currency}`}>
          <QueueFilters
            search={search}
            onSearchChange={setSearch}
            selectedState={selectedState}
            onStateSelect={setSelectedState}
            minScore={minScore}
            onMinScoreChange={setMinScore}
            casesByState={summary?.casesByState}
          />
          <RecoveryQueueTable
            cases={cases}
            onSelectCase={handleSelectCase}
            onWhyNotRetry={handleWhyNotRetry}
            onOpenApproval={(c) => setApprovalTargetCase(c)}
          />
        </div>
      )}

      {currentTab === 'activity' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden" key={`activity-${currency}`}>
          <AgentActivityStream activities={activities} />
        </div>
      )}

      {currentTab === 'audit' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden" key={`audit-${currency}`}>
          <AuditLogTable
            auditLogs={auditLogs}
            actorFilter={actorFilter}
            onActorFilterChange={setActorFilter}
          />
        </div>
      )}

      <CaseDetailInspector
        isOpen={!!selectedCaseDetail}
        onClose={() => setSelectedCaseDetail(null)}
        caseData={selectedCaseDetail}
        onAnalyzeCase={handleAnalyzeSingleCase}
        onOpenApproval={(rc) => {
          setSelectedCaseDetail(null);
          setApprovalTargetCase(rc);
        }}
        isProcessingAction={isProcessingAction}
      />

      <WhyNotRetryModal
        isOpen={!!whyNotRetryData}
        onClose={() => {
          setWhyNotRetryData(null);
          setWhyNotRetryCase(null);
        }}
        explanation={whyNotRetryData}
        targetCase={whyNotRetryCase}
      />

      <HumanApprovalModal
        isOpen={!!approvalTargetCase}
        onClose={() => setApprovalTargetCase(null)}
        targetCase={approvalTargetCase}
        onAction={handleHumanActionExecute}
        isProcessing={isProcessingAction}
      />
    </AppShell>
  );
}

