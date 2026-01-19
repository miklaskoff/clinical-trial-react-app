/**
 * @file Database tests
 * TDD: Tests written BEFORE implementation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';

// Will be implemented
let db;
let initDatabase;
let closeDatabase;

describe('Database Module', () => {
  const testDbPath = path.join(__dirname, '../data/test-clinical-trials.db');

  beforeAll(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    // Import after cleanup
    const dbModule = await import('../db.js');
    initDatabase = dbModule.initDatabase;
    closeDatabase = dbModule.closeDatabase;
    db = await initDatabase(testDbPath);
  });

  afterAll(async () => {
    if (closeDatabase) {
      await closeDatabase();
    }
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('initDatabase', () => {
    it('should create database file', () => {
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should return database instance with async methods', () => {
      expect(db).toBeDefined();
      expect(typeof db.runAsync).toBe('function');
      expect(typeof db.getAsync).toBe('function');
      expect(typeof db.allAsync).toBe('function');
    });
  });

  describe('approved_drugs table', () => {
    it('should have approved_drugs table', async () => {
      const tables = await db.allAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='approved_drugs'"
      );
      expect(tables.length).toBe(1);
    });

    it('should insert and retrieve approved drug', async () => {
      await db.runAsync(
        'INSERT INTO approved_drugs (drug_name, drug_class, approved_at) VALUES (?, ?, ?)',
        ['adalimumab', 'TNF_inhibitors', new Date().toISOString()]
      );

      const drug = await db.getAsync(
        'SELECT * FROM approved_drugs WHERE drug_name = ?',
        ['adalimumab']
      );

      expect(drug).toBeDefined();
      expect(drug.drug_name).toBe('adalimumab');
      expect(drug.drug_class).toBe('TNF_inhibitors');
    });

    it('should have index on drug_name', async () => {
      const indexes = await db.allAsync(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='approved_drugs'"
      );
      const indexNames = indexes.map(i => i.name);
      expect(indexNames.some(name => name.includes('drug_name'))).toBe(true);
    });
  });

  describe('followup_cache table', () => {
    it('should have followup_cache table', async () => {
      const tables = await db.allAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='followup_cache'"
      );
      expect(tables.length).toBe(1);
    });

    it('should insert and retrieve cached follow-ups', async () => {
      const questions = JSON.stringify([
        { id: 'q1', text: 'When did you last use?', type: 'number' }
      ]);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await db.runAsync(
        'INSERT INTO followup_cache (drug_class, questions, created_at, expires_at) VALUES (?, ?, ?, ?)',
        ['TNF_inhibitors', questions, new Date().toISOString(), expiresAt]
      );

      const cache = await db.getAsync(
        'SELECT * FROM followup_cache WHERE drug_class = ?',
        ['TNF_inhibitors']
      );

      expect(cache).toBeDefined();
      expect(cache.drug_class).toBe('TNF_inhibitors');
      expect(JSON.parse(cache.questions)).toHaveLength(1);
    });

    it('should have index on expires_at', async () => {
      const indexes = await db.allAsync(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='followup_cache'"
      );
      const indexNames = indexes.map(i => i.name);
      expect(indexNames.some(name => name.includes('expires'))).toBe(true);
    });
  });

  describe('rate_limits table', () => {
    it('should have rate_limits table', async () => {
      const tables = await db.allAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='rate_limits'"
      );
      expect(tables.length).toBe(1);
    });

    it('should track rate limit attempts', async () => {
      const ip = '192.168.1.1';
      
      await db.runAsync(
        'INSERT INTO rate_limits (ip, endpoint, attempts, window_start) VALUES (?, ?, ?, ?)',
        [ip, '/api/admin/login', 1, new Date().toISOString()]
      );

      const limit = await db.getAsync(
        'SELECT * FROM rate_limits WHERE ip = ? AND endpoint = ?',
        [ip, '/api/admin/login']
      );

      expect(limit).toBeDefined();
      expect(limit.attempts).toBe(1);
    });
  });

  describe('parallel queries', () => {
    it('should support parallel queries with Promise.all', async () => {
      const [drugs, cache, limits] = await Promise.all([
        db.allAsync('SELECT * FROM approved_drugs'),
        db.allAsync('SELECT * FROM followup_cache'),
        db.allAsync('SELECT * FROM rate_limits')
      ]);

      expect(Array.isArray(drugs)).toBe(true);
      expect(Array.isArray(cache)).toBe(true);
      expect(Array.isArray(limits)).toBe(true);
    });
  });
});
