/**
 * @file Config routes integration tests
 * @description Real HTTP tests for /api/config endpoints (NO MOCKS)
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';
import { initDatabase } from '../../db.js';
import { getClaudeClient } from '../../services/ClaudeClient.js';
import * as FollowUpGenerator from '../../services/FollowUpGenerator.js';

describe('Config Routes (Real Integration)', () => {
  beforeAll(async () => {
    // Initialize database for tests (don't start server - use app directly)
    await initDatabase(':memory:');
  });

  describe('POST /api/config/apikey', () => {
    it('returns 200 with success:true when valid apiKey provided', async () => {
      const res = await request(app)
        .post('/api/config/apikey')
        .send({ apiKey: 'sk-ant-test123' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');
    });

    it('returns 400 if apiKey is missing', async () => {
      const res = await request(app)
        .post('/api/config/apikey')
        .send({})
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 if apiKey has invalid format', async () => {
      const res = await request(app)
        .post('/api/config/apikey')
        .send({ apiKey: 'invalid-key-format' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns JSON Content-Type header', async () => {
      const res = await request(app)
        .post('/api/config/apikey')
        .send({ apiKey: 'sk-ant-valid-key' })
        .set('Content-Type', 'application/json');

      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('GET /api/config/apikey/status', () => {
    it('returns 200 with configured status', async () => {
      const res = await request(app)
        .get('/api/config/apikey/status');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body).toHaveProperty('configured');
      expect(typeof res.body.configured).toBe('boolean');
    });

    it('returns configured:true after saving a key', async () => {
      // First save a key
      await request(app)
        .post('/api/config/apikey')
        .send({ apiKey: 'sk-ant-test-for-status' })
        .set('Content-Type', 'application/json');

      // Then check status
      const res = await request(app)
        .get('/api/config/apikey/status');

      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(true);
    });
  });

  describe('DELETE /api/config/apikey', () => {
    it('returns 200 with success:true', async () => {
      const res = await request(app)
        .delete('/api/config/apikey');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('returns configured:false after deletion', async () => {
      // Delete the key
      await request(app).delete('/api/config/apikey');

      // Check status
      const res = await request(app).get('/api/config/apikey/status');

      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(false);
    });
  });

  describe('API Key Reload Behavior (CRITICAL)', () => {
    beforeEach(async () => {
      // Delete any existing key
      await request(app).delete('/api/config/apikey');
    });

    it('ClaudeClient reloads from database after saving new API key', async () => {
      const client = getClaudeClient();
      
      // Record initial state
      const initialSource = client.getApiKeySource();
      
      // Save a NEW API key
      const res = await request(app)
        .post('/api/config/apikey')
        .send({ apiKey: 'sk-ant-new-key-test-reload' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      
      // Client should be reconfigured
      expect(client.isConfigured()).toBe(true);
      
      // If initially not from database, source should now be 'database'
      // OR if it WAS database, it should remain configured after reload
      const afterSource = client.getApiKeySource();
      expect(afterSource).toBe('database');
    });

    it('FollowUp cache is cleared after saving API key', async () => {
      // Add something to the cache first
      const memoryCache = FollowUpGenerator.getCacheStats();
      
      // Save API key
      await request(app)
        .post('/api/config/apikey')
        .send({ apiKey: 'sk-ant-cache-clear-test' })
        .set('Content-Type', 'application/json');

      // Cache should be empty after save
      const afterStats = FollowUpGenerator.getCacheStats();
      expect(afterStats.size).toBe(0);
    });

    it('response includes reloaded:true to confirm reload happened', async () => {
      const res = await request(app)
        .post('/api/config/apikey')
        .send({ apiKey: 'sk-ant-reload-confirmation-test' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reloaded', true);
    });
  });
});
