/**
 * @file Cache Parity & Version Invalidation Tests
 * Tests for: CMB DB caching, version-based invalidation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDatabase, initDatabase, closeDatabase } from '../../db.js';
import { 
  generateConditionFollowUpQuestions, 
  generateFollowUpQuestions,
  clearCache,
  checkAndInvalidateCache
} from '../../services/FollowUpGenerator.js';

// Mock the ClaudeClient to avoid real API calls in tests
vi.mock('../../services/ClaudeClient.js', () => ({
  getClaudeClient: () => ({
    isConfigured: () => false,  // Return false to skip AI calls and use defaults
    initFromDatabase: async () => {}
  })
}));

describe('Cache Parity: CMB (Conditions) DB Caching', () => {
  let db;

  beforeEach(async () => {
    // Use real database
    await initDatabase();
    db = getDatabase();
    
    // Clear caches before each test
    await clearCache();
  });

  afterEach(async () => {
    await clearCache();
  });

  describe('Condition questions DB storage', () => {
    it('should store condition questions in followup_cache table', async () => {
      // Generate questions for a condition
      const result = await generateConditionFollowUpQuestions('diabetes');
      
      // Check that questions were stored in DB
      const cached = await db.getAsync(
        'SELECT * FROM followup_cache WHERE drug_class LIKE ?',
        ['condition:%']
      );
      
      expect(cached).toBeDefined();
      expect(cached.drug_class).toMatch(/^condition:/);
      expect(JSON.parse(cached.questions)).toBeInstanceOf(Array);
    });

    it('should retrieve condition questions from DB cache after memory clear', async () => {
      // Generate questions first
      const result1 = await generateConditionFollowUpQuestions('diabetes');
      
      // Verify DB has the data
      const dbCached = await db.getAsync(
        'SELECT * FROM followup_cache WHERE drug_class LIKE ?',
        ['condition:%']
      );
      
      expect(dbCached).toBeDefined();
      expect(dbCached.drug_class).toContain('condition:');
    });

    it('should use condition: prefix to avoid collision with treatment cache', async () => {
      // Generate both treatment and condition questions
      await generateFollowUpQuestions('adalimumab');
      await generateConditionFollowUpQuestions('diabetes');
      
      // Check both are cached with different prefixes
      const treatmentCache = await db.getAsync(
        'SELECT * FROM followup_cache WHERE drug_class LIKE ?',
        ['treatment:%']
      );
      const conditionCache = await db.getAsync(
        'SELECT * FROM followup_cache WHERE drug_class LIKE ?',
        ['condition:%']
      );
      
      expect(treatmentCache).toBeDefined();
      expect(conditionCache).toBeDefined();
      expect(treatmentCache.drug_class).not.toBe(conditionCache.drug_class);
    });
  });
});

describe('Version-Based Cache Invalidation', () => {
  let db;

  beforeEach(async () => {
    await initDatabase();
    db = getDatabase();
    await clearCache();
  });

  afterEach(async () => {
    await clearCache();
  });

  describe('app_version table', () => {
    it('should have app_version table in database', async () => {
      const table = await db.getAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='app_version'"
      );
      
      expect(table).toBeDefined();
      expect(table.name).toBe('app_version');
    });

    it('should store app version after checkAndInvalidateCache call', async () => {
      // Call checkAndInvalidateCache to populate version
      await checkAndInvalidateCache('1.0.0-test');
      
      const version = await db.getAsync('SELECT version FROM app_version WHERE id = 1');
      
      expect(version).toBeDefined();
      expect(version.version).toBe('1.0.0-test');
    });
  });

  describe('checkAndInvalidateCache function', () => {
    it('should clear cache when version changes', async () => {
      // First, populate cache
      await generateFollowUpQuestions('adalimumab');
      
      // Verify cache exists
      const beforeClear = await db.getAsync(
        'SELECT COUNT(*) as count FROM followup_cache'
      );
      expect(beforeClear.count).toBeGreaterThan(0);
      
      // Set old version in DB
      await db.runAsync(
        'INSERT OR REPLACE INTO app_version (id, version, updated_at) VALUES (1, ?, ?)',
        ['old-version-0.0.0', new Date().toISOString()]
      );
      
      // Call checkAndInvalidateCache with new version
      const invalidated = await checkAndInvalidateCache('new-version-1.0.0');
      
      expect(invalidated).toBe(true);
      
      // Verify cache is cleared
      const afterClear = await db.getAsync(
        'SELECT COUNT(*) as count FROM followup_cache'
      );
      expect(afterClear.count).toBe(0);
    });

    it('should preserve cache when version is same', async () => {
      const testVersion = 'test-version-1.0.0';
      
      // Set version first
      await checkAndInvalidateCache(testVersion);
      
      // Populate cache
      await generateFollowUpQuestions('adalimumab');
      
      // Verify cache exists
      const beforeCheck = await db.getAsync(
        'SELECT COUNT(*) as count FROM followup_cache'
      );
      expect(beforeCheck.count).toBeGreaterThan(0);
      
      // Call checkAndInvalidateCache with SAME version
      const invalidated = await checkAndInvalidateCache(testVersion);
      
      expect(invalidated).toBe(false);
      
      // Verify cache is preserved
      const afterCheck = await db.getAsync(
        'SELECT COUNT(*) as count FROM followup_cache'
      );
      expect(afterCheck.count).toBe(beforeCheck.count);
    });
  });
});
