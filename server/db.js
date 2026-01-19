/**
 * @file Database module with SQLite + async wrapper
 * @description Provides async database operations with optimized indexes
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {AsyncDatabase | null} */
let dbInstance = null;

/**
 * Async wrapper for better-sqlite3
 * Wraps sync operations in Promises for consistent async API
 */
class AsyncDatabase {
  /** @param {Database.Database} database */
  constructor(database) {
    this.db = database;
  }

  /**
   * Run a query (INSERT, UPDATE, DELETE)
   * @param {string} sql 
   * @param {any[]} params 
   * @returns {Promise<Database.RunResult>}
   */
  async runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(sql);
        const result = stmt.run(...params);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get single row
   * @param {string} sql 
   * @param {any[]} params 
   * @returns {Promise<any>}
   */
  async getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(sql);
        const result = stmt.get(...params);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get all rows
   * @param {string} sql 
   * @param {any[]} params 
   * @returns {Promise<any[]>}
   */
  async allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(sql);
        const result = stmt.all(...params);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Execute raw SQL (for schema creation)
   * @param {string} sql 
   */
  exec(sql) {
    this.db.exec(sql);
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

/**
 * Initialize database with schema and indexes
 * @param {string} [dbPath] - Custom path for database file
 * @returns {Promise<AsyncDatabase>}
 */
export async function initDatabase(dbPath) {
  const defaultPath = path.join(__dirname, 'data', 'clinical-trials.db');
  const finalPath = dbPath || defaultPath;

  // Ensure data directory exists
  const dataDir = path.dirname(finalPath);
  const fs = await import('fs');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Create database
  const sqliteDb = new Database(finalPath);
  dbInstance = new AsyncDatabase(sqliteDb);

  // Enable WAL mode for better concurrent performance
  dbInstance.exec('PRAGMA journal_mode = WAL');
  dbInstance.exec('PRAGMA synchronous = NORMAL');
  dbInstance.exec('PRAGMA cache_size = 10000');
  dbInstance.exec('PRAGMA temp_store = MEMORY');

  // Create tables with optimized schema
  dbInstance.exec(`
    -- Approved drugs table
    CREATE TABLE IF NOT EXISTS approved_drugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drug_name TEXT UNIQUE NOT NULL,
      drug_class TEXT NOT NULL,
      approved_at TEXT NOT NULL,
      approved_by TEXT DEFAULT 'admin'
    );

    -- Index for drug lookup
    CREATE INDEX IF NOT EXISTS idx_approved_drugs_drug_name 
    ON approved_drugs(drug_name);

    -- Index for class queries
    CREATE INDEX IF NOT EXISTS idx_approved_drugs_drug_class 
    ON approved_drugs(drug_class);

    -- Follow-up questions cache
    CREATE TABLE IF NOT EXISTS followup_cache (
      drug_class TEXT PRIMARY KEY,
      questions TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    -- Index for cache expiration cleanup
    CREATE INDEX IF NOT EXISTS idx_followup_cache_expires_at 
    ON followup_cache(expires_at);

    -- Rate limiting table
    CREATE TABLE IF NOT EXISTS rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      attempts INTEGER DEFAULT 1,
      window_start TEXT NOT NULL,
      UNIQUE(ip, endpoint)
    );

    -- Index for rate limit lookups
    CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint 
    ON rate_limits(ip, endpoint);

    -- Index for cleanup old entries
    CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start 
    ON rate_limits(window_start);

    -- Pending drug reviews
    CREATE TABLE IF NOT EXISTS pending_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drug_name TEXT NOT NULL,
      drug_class TEXT,
      submitted_at TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      reviewed_at TEXT,
      reviewed_by TEXT
    );

    -- Index for pending reviews
    CREATE INDEX IF NOT EXISTS idx_pending_reviews_status 
    ON pending_reviews(status);

    -- Configuration table for API keys and settings
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return dbInstance;
}

/**
 * Get database instance
 * @returns {AsyncDatabase | null}
 */
export function getDatabase() {
  return dbInstance;
}

/**
 * Database instance wrapper for direct imports
 * Use this for routes that need db access
 * @type {{ runAsync: Function, getAsync: Function, allAsync: Function }}
 */
export const db = {
  runAsync: async (sql, params = []) => {
    const database = getDatabase();
    if (!database) throw new Error('Database not initialized');
    return database.runAsync(sql, params);
  },
  getAsync: async (sql, params = []) => {
    const database = getDatabase();
    if (!database) throw new Error('Database not initialized');
    return database.getAsync(sql, params);
  },
  allAsync: async (sql, params = []) => {
    const database = getDatabase();
    if (!database) throw new Error('Database not initialized');
    return database.allAsync(sql, params);
  }
};

/**
 * Close database connection
 * @returns {Promise<void>}
 */
export async function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export { AsyncDatabase };
