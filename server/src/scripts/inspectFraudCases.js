import { connectDB, disconnectDB } from '../config/db.js';
import { Customer } from '../models/Customer.js';
import { Transaction } from '../models/Transaction.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { RecoveryAction } from '../models/RecoveryAction.js';
import { getDashboardAnalytics } from '../services/analytics/analyticsService.js';
import { HARD_PROHIBITED_CODES } from '../config/constants.js';

async function inspectDb() {
  await connectDB();

  console.log('=== 1. TRANSACTION COUNTS BY FAILURE CODE ===');
  const failureCodeCounts = await Transaction.aggregate([
    { $group: { _id: '$failureCode', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
    { $sort: { count: -1 } }
  ]);
  console.log(JSON.stringify(failureCodeCounts, null, 2));

  console.log('\n=== 2. TRANSACTION COUNTS BY EVENT TYPE ===');
  const eventTypeCounts = await Transaction.aggregate([
    { $group: { _id: '$eventType', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
  ]);
  console.log(JSON.stringify(eventTypeCounts, null, 2));

  console.log('\n=== 3. RECOVERY CASE COUNTS BY NORMALIZED CATEGORY ===');
  const categoryCounts = await RecoveryCase.aggregate([
    { $group: { _id: '$normalizedFailureCategory', count: { $sum: 1 }, totalAtRisk: { $sum: '$initialRevenueAtRisk' }, states: { $push: '$state' } } },
    { $sort: { count: -1 } }
  ]);
  console.log(JSON.stringify(categoryCounts, null, 2));

  console.log('\n=== 4. SPECIFIC HARD PROHIBITED CASES IN MONGODB ===');
  const hardProhibitedTxns = await Transaction.find({ failureCode: { $in: HARD_PROHIBITED_CODES } });
  console.log(`Found ${hardProhibitedTxns.length} hard-prohibited transactions in MongoDB.`);

  const txnIds = hardProhibitedTxns.map(t => t.transactionId);
  const hardProhibitedCases = await RecoveryCase.find({ transactionId: { $in: txnIds } });

  console.log(`Found ${hardProhibitedCases.length} matching recovery cases in MongoDB.`);
  for (const c of hardProhibitedCases) {
    const txn = hardProhibitedTxns.find(t => t.transactionId === c.transactionId);
    console.log({
      transactionId: c.transactionId,
      recoveryCaseId: c.recoveryCaseId,
      failureCode: txn?.failureCode,
      normalizedFailureCategory: c.normalizedFailureCategory,
      amount: c.initialRevenueAtRisk,
      state: c.state,
      recoveryScore: c.recoveryScore
    });
  }

  console.log('\n=== 5. OVERVIEW ANALYTICS AGGREGATION CHECK ===');
  const analytics = await getDashboardAnalytics();
  console.log('Categories in Analytics:');
  console.log(JSON.stringify(analytics.recoveryByFailureCategory, null, 2));

  console.log('\n=== 6. RECOVERY QUEUE DEFAULT QUERY CHECK (state=ALL, limit=100) ===');
  const queueCases = await RecoveryCase.find({}).sort({ recoveryScore: -1 }).limit(100);
  const fraudInQueue = queueCases.filter(c => ['FRAUD_RISK', 'HARD_DECLINE', 'ACCOUNT_CLOSED'].includes(c.normalizedFailureCategory));
  console.log(`Hard prohibited cases present in top 100 queue sorted by score: ${fraudInQueue.length}`);
  for (const f of fraudInQueue) {
    console.log(`- ${f.recoveryCaseId} (${f.transactionId}): category=${f.normalizedFailureCategory}, score=${f.recoveryScore}, state=${f.state}`);
  }

  await disconnectDB();
}

inspectDb();
