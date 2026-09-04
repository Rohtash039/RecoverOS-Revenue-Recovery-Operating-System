import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { getDashboardAnalytics, invalidateAnalyticsCache } from '../services/analytics/analyticsService.js';

async function runP3Verification() {
  console.log('=== [RecoverOS Verification] Starting P3-9 & P3-10 Performance Verification ===\n');

  await connectDB();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`PASS: ${message}`);
      passed++;
    } else {
      console.error(`FAIL: ${message}`);
      failed++;
    }
  }

  try {

    await RecoveryCase.init();
    const indexes = await RecoveryCase.collection.indexes();
    const compoundIndex = indexes.find(idx => idx.key.state === 1 && idx.key.recoveryScore === -1);

    assert(
      Boolean(compoundIndex),
      'Compound index { state: 1, recoveryScore: -1 } exists on RecoveryCase collection'
    );

    const explainResult = await RecoveryCase.find({ state: 'AT_RISK' })
      .sort({ recoveryScore: -1 })
      .explain('executionStats');

    const winningPlan = explainResult.queryPlanner?.winningPlan;
    const stage = winningPlan?.inputStage?.stage || winningPlan?.stage;
    assert(
      stage === 'IXSCAN' || stage === 'FETCH',
      `Query { state: 'AT_RISK' }.sort({ recoveryScore: -1 }) utilizes IXSCAN index scan (Stage: ${stage})`
    );

    invalidateAnalyticsCache();
    const t0 = Date.now();
    const firstAnalytics = await getDashboardAnalytics();
    const t1 = Date.now();

    const secondAnalytics = await getDashboardAnalytics();
    const t2 = Date.now();

    assert(
      firstAnalytics === secondAnalytics,
      'Subsequent getDashboardAnalytics() within 5s TTL returns cached reference'
    );
    assert(
      (t2 - t1) <= (t1 - t0),
      `Cached call latency (${t2 - t1}ms) is faster than/equal to uncached query (${t1 - t0}ms)`
    );

    invalidateAnalyticsCache();
    const thirdAnalytics = await getDashboardAnalytics();
    assert(
      firstAnalytics !== thirdAnalytics,
      'Calling invalidateAnalyticsCache() forces fresh document computation on next call'
    );

  } catch (err) {
    console.error('Verification error:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
    process.exitCode = failed > 0 ? 1 : 0;
  }
}

runP3Verification();

