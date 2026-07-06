import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('WARNING: DATABASE_URL is not set. Database operations will fail.');
}

export const pool = new Pool({
  connectionString: databaseUrl,
});

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}
