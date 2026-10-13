import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { migrateLocalDataToMongoDB } from '../utils/migrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly locate and load backend/.env regardless of process current working directory
const envCandidates = [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server', '.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}
dotenv.config();

let isConnected = false;

// Safe URI string sanitizer for terminal logging (hides password/secrets)
export const sanitizeMongoUri = (uri) => {
  if (!uri) return 'undefined';
  return uri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:********@');
};

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/menufy';
  const sanitizedUri = sanitizeMongoUri(uri);

  const mongooseOptions = {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  };

  // If URI does not specify a specific database name, route to 'menufy' database
  try {
    const parsed = new URL(uri.replace('mongodb+srv://', 'http://').replace('mongodb://', 'http://'));
    if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '') {
      mongooseOptions.dbName = process.env.MONGODB_DB_NAME || 'menufy';
    }
  } catch {
    mongooseOptions.dbName = process.env.MONGODB_DB_NAME || 'menufy';
  }

  try {
    console.log(`[Database] Connecting to MongoDB: ${sanitizedUri}`);
    await mongoose.connect(uri, mongooseOptions);
    isConnected = true;

    const dbName = mongoose.connection.name;
    const host = mongoose.connection.host;
    console.log(`[Database] ✅ Connected to MongoDB successfully! [Database: "${dbName}", Host: "${host}"]`);

    // Perform safe data migration if database collections are empty
    await migrateLocalDataToMongoDB();
  } catch (err) {
    isConnected = false;
    console.error(`[Database] ❌ MongoDB connection failed: ${err.message}`);

    if (process.env.NODE_ENV === 'production') {
      console.error('[Database] FATAL: Production environment requires a valid MongoDB connection. Refusing fallback.');
      throw err;
    }

    console.warn('[Database] ⚠️  Running in Local Development Disk Mode (operations saved to server/data/foodflow_db.json).');
    console.warn('[Database] ⚠️  Data is NOT currently stored in MongoDB Atlas.');
    console.warn('[Database] ⚠️  To connect to MongoDB Atlas, verify MONGODB_URI and IP access list in server/.env.');
  }
};

export const getIsConnected = () => isConnected;
