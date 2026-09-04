import mongoose from 'mongoose';
import { ENV } from './env.js';

const mongo_url = ENV.MONGO_URI || "mongodb://127.0.0.1:27017/recoveros";
export async function connectDB() {
  try {
    const conn = await mongoose.connect(mongo_url);
    console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`Connection Error: ${error.message}`);
    process.exit(1);
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

