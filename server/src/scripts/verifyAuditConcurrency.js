import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';
import { recordAuditLog, verifyAuditChainIntegrity } from '../services/audit/auditService.js';
import { AuditLog } from '../models/AuditLog.js';
import { AUDIT_ACTORS } from '../config/constants.js';

async function runAuditConcurrencyVerification() {
  console.log('=== [RecoverOS Verification] Starting P0 Audit Concurrency Hardening Verification ===\n');

  await connectDB();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(` PASS: ${message}`);
      passed++;
    } else {
      console.error(` FAIL: ${message}`);
      failed++;
    }
  }

  try {

    console.log('[Step 1] Seeding baseline dataset (100 initial cases)...');
    await generateSeedDataset();
    const initialVerification = await verifyAuditChainIntegrity();

    assert(
      initialVerification.valid === true && initialVerification.totalEntries === 100,
      `Initial seed audit chain is unbroken (100/100 entries verified, latestHash: ${initialVerification.latestHash.substring(0, 12)}...)`
    );

    console.log('\n[Step 2] Firing 50 simultaneous concurrent audit writes via Promise.all()...');
    const CONCURRENT_COUNT = 50;
    const concurrentPromises = Array.from({ length: CONCURRENT_COUNT }, (_, i) => {
      const caseIdx = 1001 + (i % 20);
      return recordAuditLog({
        recoveryCaseId: `RC-${caseIdx}`,
        transactionId: `TXN-${caseIdx}`,
        actor: i % 2 === 0 ? AUDIT_ACTORS.AI_AGENT : AUDIT_ACTORS.POLICY_ENGINE,
        event: 'CONCURRENT_TEST_EVENT',
        actionTaken: 'RETRY_PAYMENT',
        reason: `Concurrent stress write thread #${i + 1}`,
        financialImpact: (i + 1) * 100,
        payload: { threadId: i + 1, timestamp: Date.now() }
      });
    });

    const results = await Promise.all(concurrentPromises);
    const successCount = results.filter(r => r !== null && r?.auditId).length;

    assert(
      successCount === CONCURRENT_COUNT,
      `All ${CONCURRENT_COUNT} concurrent audit write requests succeeded without drop (${successCount}/${CONCURRENT_COUNT})`
    );

    console.log('\n[Step 3] Inspecting sequence uniqueness and linearity in database...');
    const allLogs = await AuditLog.find({}).sort({ sequence: 1 });
    assert(
      allLogs.length === 100 + CONCURRENT_COUNT,
      `Total audit log count in DB is exactly ${100 + CONCURRENT_COUNT} records`
    );

    const sequences = allLogs.map(l => l.sequence);
    const uniqueSequences = new Set(sequences);
    const isStrictlyMonotonic = sequences.every((seq, idx) => seq === idx + 1);

    assert(
      uniqueSequences.size === allLogs.length,
      `All ${allLogs.length} sequence numbers are strictly unique (No duplicate sequences)`
    );

    assert(
      isStrictlyMonotonic,
      `Sequence numbers form an unbroken contiguous sequence from 1 to ${allLogs.length}`
    );

    console.log('\n[Step 4] Checking for chain forks or duplicate predecessor hashes...');
    const nonGenesisPreviousHashes = allLogs.slice(1).map(l => l.previousHash);
    const uniquePreviousHashes = new Set(nonGenesisPreviousHashes);

    assert(
      uniquePreviousHashes.size === nonGenesisPreviousHashes.length,
      `No chain fork detected: Each of the ${nonGenesisPreviousHashes.length} post-genesis records references a unique predecessor`
    );

    console.log('\n[Step 5] Running cryptographic hash-chain traversal verification...');
    const postConcurrentVerification = await verifyAuditChainIntegrity();

    assert(
      postConcurrentVerification.valid === true,
      `Full cryptographic hash chain verification succeeded across all ${postConcurrentVerification.totalEntries} entries`
    );

  } catch (err) {
    console.error('Audit concurrency verification error:', err);
    failed++;
  } finally {
    await generateSeedDataset();
    await mongoose.disconnect();
    process.exitCode = failed > 0 ? 1 : 0;
  }
}

runAuditConcurrencyVerification();

