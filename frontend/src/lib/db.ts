import pg from 'pg';

const { Pool } = pg;

// Connection pool for Next.js API Routes, reusing DATABASE_URL
export const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
