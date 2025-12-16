import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Request, Response } from "express";
import * as schema from "@shared/schema";

// Use SUPABASE_DATABASE_URL exclusively - no fallback to Replit's DATABASE_URL
const supabaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!supabaseUrl) {
  throw new Error("❌ SUPABASE_DATABASE_URL ontbreekt in Replit Secrets. Deze app gebruikt uitsluitend Supabase als database.");
}

const databaseUrl: string = supabaseUrl;

if (!process.env.SESSION_SECRET) {
  throw new Error("❌ SESSION_SECRET ontbreekt in Replit Secrets.");
}

// Supabase requires SSL with rejectUnauthorized: false (self-signed certs)
const sslConfig = { rejectUnauthorized: false };

// Main database pool - reduced size to avoid connection issues
export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: sslConfig,
  max: 5, // Reduced from 10 to avoid too many connections
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Handle connection errors gracefully
  allowExitOnIdle: false,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('⚠️  Unexpected database pool error:', err.message);
  // Don't crash - connections will be retried
});

pool.on('connect', () => {
  // Silently handle new connections
});

// Separate pool for sessions to avoid conflicts
const sessionPool = new Pool({
  connectionString: databaseUrl,
  ssl: sslConfig,
  max: 2, // Small pool for sessions only
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

sessionPool.on('error', (err) => {
  console.error('⚠️  Session pool error (non-fatal):', err.message);
});

export const db = drizzle(pool, { schema });

const PgStore = connectPgSimple(session);

// Session table is created by migrations, so we don't need auto-creation
// Use separate pool for sessions to avoid conflicts with main pool
const sessionStore = new PgStore({
  pool: sessionPool, // Use separate pool for sessions
  tableName: "session",
  createTableIfMissing: false, // Table is created by migrations
  pruneSessionInterval: false, // Disable automatic pruning to reduce DB load
});

// Handle session store errors gracefully
sessionStore.on('connect', () => {
  console.log('✅ Session store connected');
});

sessionStore.on('error', (error) => {
  console.error('⚠️  Session store error (non-fatal):', error.message);
  // Don't crash the app - sessions will just not persist
});

export const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 12,
  },
  // Add error handling for session operations
  unset: 'destroy',
});

export async function dbHealthHandler(req: Request, res: Response) {
  try {
    const start = Date.now();
    await pool.query("SELECT NOW();");
    const ms = Date.now() - start;

    res.status(200).json({
      status: "ok",
      database: "supabase",
      latency_ms: ms,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("❌ DB Health Error:", err);
    res.status(500).json({
      status: "error",
      message: err?.message ?? "unknown error",
    });
  }
}

export function assertDatabaseConfig() {
  console.log("=================================================");
  console.log("🔒  Supabase PostgreSQL wordt gebruikt als primaire DB");
  const host = databaseUrl.includes('@') ? databaseUrl.split('@')[1]?.split('/')[0] : "Supabase";
  console.log("🌍  Host:", host);
  console.log("🛑  Lokale Replit-opslag is volledig uitgeschakeld.");
  console.log("=================================================");
}

export async function closeDb() {
  try {
    await sessionPool.end();
    await pool.end();
    console.log("🔌 Database pools closed");
  } catch (error) {
    console.error("Error closing database pools:", error);
  }
}
