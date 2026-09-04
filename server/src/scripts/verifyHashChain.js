import { connectDB } from '../config/db.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';
import { startBatchRun, getBatchStatus } from '../services/simulation/batchOrchestrator.js';
import { verifyAuditChainIntegrity } from '../services/audit/auditService.js';
import { AuditLog } from '../models/AuditLog.js';

async function runHashChainVerification() {
  console.log('=== [RecoverOS Verification] Starting P2-7 Tamper-Evident Hash-Chained Audit Ledger Verification ===\n');

  await connectDB();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Seed audit trail verification
    // -------------------------------------------------------------
    await generateSeedDataset();
    const initialVerification = await verifyAuditChainIntegrity();

    assert(
      initialVerification.valid === true && initialVerification.totalEntries === 100,
      `Fresh seed audit chain is 100% cryptographically valid (${initialVerification.verifiedCount}/${initialVerification.totalEntries} entries verified)`
    );

    // -------------------------------------------------------------
    // Test 2: Full batch execution audit trail verification
    // -------------------------------------------------------------
    console.log('\n[Step] Executing simulation batch to generate dense multi-actor audit events...');
    const batch = await startBatchRun('FAST');
    while (true) {
      await new Promise(r => setTimeout(r, 100));
      const status = await getBatchStatus(batch.batchId);
      if (status.status === 'COMPLETED' || status.status === 'FAILED') break;
    }

    const postBatchVerification = await verifyAuditChainIntegrity();
    assert(
      postBatchVerification.valid === true && postBatchVerification.totalEntries > 100,
      `Post-batch audit chain is unbroken across ${postBatchVerification.totalEntries} multi-actor events (Latest Hash: ${postBatchVerification.latestHash.substring(0, 16)}...)`
    );

    // -------------------------------------------------------------
    // Test 3: Tamper Detection (Direct MongoDB mutation)
    // -------------------------------------------------------------
    console.log('\n[Step] Simulating malicious audit record tampering in MongoDB...');
    const targetAudit = await AuditLog.findOne({ event: 'REVENUE_RECOVERED' });
    const originalImpact = targetAudit.financialImpact;

    // Maliciously tamper with financialImpact
    targetAudit.financialImpact = 9999999;
    await targetAudit.save();

    const tamperedVerification = await verifyAuditChainIntegrity();
    assert(
      tamperedVerification.valid === false &&
      tamperedVerification.brokenAtAuditId === targetAudit.auditId,
      `Cryptographic tamper detection verified: Chain flagged as INVALID at compromised auditId '${tamperedVerification.brokenAtAuditId}'`
    );

    // -------------------------------------------------------------
    // Test 4: Restoration & Verification Recovery
    // -------------------------------------------------------------
    console.log('\n[Step] Restoring original audit record value...');
    targetAudit.financialImpact = originalImpact;
    await targetAudit.save();

    const restoredVerification = await verifyAuditChainIntegrity();
    assert(
      restoredVerification.valid === true,
      `Audit chain integrity restored to 100% valid after repairing tampered record`
    );

  } finally {
    await generateSeedDataset();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runHashChainVerification();
