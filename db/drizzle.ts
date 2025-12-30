import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import 'dotenv/config'; // Load environment variables
import * as schema from './schema';

// CRITICAL: Configure connection pool for performance
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Connection pool settings
    max: 20, // Maximum number of clients in the pool
    min: 2, // Minimum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection can't be established
    // Performance settings
    statement_timeout: 30000, // Cancel queries that take longer than 30 seconds
    query_timeout: 30000, // Query timeout
    // ssl: process.env.NODE_ENV === "production", // Optional: Enable SSL for production
});

// Log pool errors
pool.on('error', (err) => {
    console.error('[DB Pool Error]', err);
});

// Log when a client is acquired (development only)
if (process.env.NODE_ENV === 'development') {
    pool.on('acquire', () => {
        console.log('[DB Pool] Client acquired. Total: %d, Idle: %d, Waiting: %d',
            pool.totalCount, pool.idleCount, pool.waitingCount);
    });
}

export const db = drizzle(pool, { schema });