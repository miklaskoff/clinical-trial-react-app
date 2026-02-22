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

    -- Pending terms (unknown conditions/treatments from users)
    CREATE TABLE IF NOT EXISTS pending_terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT NOT NULL,
      type TEXT NOT NULL,
      context TEXT,
      status TEXT DEFAULT 'pending',
      synonyms TEXT,
      submitted_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT,
      UNIQUE(term, type)
    );

    -- Index for pending terms by status
    CREATE INDEX IF NOT EXISTS idx_pending_terms_status 
    ON pending_terms(status);

    -- Index for approved terms lookup
    CREATE INDEX IF NOT EXISTS idx_pending_terms_approved 
    ON pending_terms(status, type) WHERE status = 'approved';

    -- Configuration table for API keys and settings
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- App version table for cache invalidation
    CREATE TABLE IF NOT EXISTS app_version (
      id INTEGER PRIMARY KEY,
      version TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Parser job history (for Parser Testing UI)
    CREATE TABLE IF NOT EXISTS parser_jobs (
      id TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      clusterType TEXT NOT NULL,
      modelId TEXT NOT NULL,
      totalCriteria INTEGER NOT NULL,
      parsedCount INTEGER DEFAULT 0,
      skippedCount INTEGER DEFAULT 0,
      inputFile TEXT NOT NULL,
      estimatedCost REAL,
      actualCost REAL DEFAULT 0,
      parserVersion TEXT NOT NULL,
      inputData TEXT
    );

    -- Index for job lookups
    CREATE INDEX IF NOT EXISTS idx_parser_jobs_status 
    ON parser_jobs(status);

    -- Index for job history ordering
    CREATE INDEX IF NOT EXISTS idx_parser_jobs_created 
    ON parser_jobs(createdAt DESC);

    -- Parsed criteria cache (for Parser Testing UI)
    CREATE TABLE IF NOT EXISTS parsed_criteria (
      criterionId TEXT PRIMARY KEY,
      nctId TEXT NOT NULL,
      clusterType TEXT NOT NULL,
      parsedAt TEXT NOT NULL,
      parserVersion TEXT NOT NULL,
      modelUsed TEXT NOT NULL,
      inputTokens INTEGER,
      outputTokens INTEGER,
      cacheReadTokens INTEGER DEFAULT 0,
      cacheWriteTokens INTEGER DEFAULT 0,
      costUsd REAL,
      rawInput TEXT NOT NULL,
      parsedOutput TEXT NOT NULL,
      validationStatus TEXT,
      validationErrors TEXT,
      jobId TEXT REFERENCES parser_jobs(id)
    );

    -- Index for NCT lookups
    CREATE INDEX IF NOT EXISTS idx_parsed_criteria_nct 
    ON parsed_criteria(nctId);

    -- Index for job results
    CREATE INDEX IF NOT EXISTS idx_parsed_criteria_job 
    ON parsed_criteria(jobId);

    -- Index for version lookups
    CREATE INDEX IF NOT EXISTS idx_parsed_criteria_version 
    ON parsed_criteria(parserVersion);

    -- API usage tracking (for Parser Testing UI)
    CREATE TABLE IF NOT EXISTS api_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      modelId TEXT NOT NULL,
      inputTokens INTEGER NOT NULL,
      outputTokens INTEGER NOT NULL,
      cacheReadTokens INTEGER DEFAULT 0,
      cacheWriteTokens INTEGER DEFAULT 0,
      costUsd REAL NOT NULL,
      jobId TEXT REFERENCES parser_jobs(id)
    );

    -- Index for usage aggregation
    CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp 
    ON api_usage(timestamp);

    -- Index for job usage
    CREATE INDEX IF NOT EXISTS idx_api_usage_job 
    ON api_usage(jobId);
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
