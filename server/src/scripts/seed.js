import { connectDB, disconnectDB } from '../config/db.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';

async function runSeed() {
  await connectDB();
  console.log('[Seed] Seeding 100 synthetic cases...');
  const result = await generateSeedDataset();
  console.log('[Seed] Seeding completed successfully:', result);
  await disconnectDB();
}

runSeed();
