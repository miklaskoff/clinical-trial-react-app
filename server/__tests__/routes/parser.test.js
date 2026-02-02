/**
 * @file parser.test.js
 * @description TDD tests for /api/parser routes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the ClaudeClient before importing routes
vi.mock('../../services/ClaudeClient.js', () => ({
  getClaudeClient: () => ({
    isConfigured: () => true,
    getApiKeySource: () => 'test',
    initFromDatabase: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockResolvedValue(JSON.stringify({
      id: 'AGE_001',
      raw_text: 'Age ≥ 18 years',
      _thought_process: 'Identified age minimum of 18 years.',
      AGE_MIN: 18,
      AGE_UNIT: 'years',
      confidence: 1.0,
      parsing_status: 'complete'
    }))
  })
}));

// Import routes after mocking
import parserRoutes from '../../routes/parser.js';

describe('Parser API Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/parser', parserRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/parser/status', () => {
    it('should return parser status with available clusters', async () => {
      const res = await request(app).get('/api/parser/status');

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(true);
      expect(res.body.clusters).toBeInstanceOf(Array);
      expect(res.body.clusters).toContain('AGE');
      expect(res.body.clusters).toContain('CMB');
      expect(res.body.catalogLoaded).toBeDefined();
    });
  });

  describe('GET /api/parser/clusters', () => {
    it('should return list of cluster codes with primary fields', async () => {
      const res = await request(app).get('/api/parser/clusters');

      expect(res.status).toBe(200);
      expect(res.body.clusters).toBeDefined();
      expect(res.body.clusters.AGE).toEqual(['AGE_MIN', 'AGE_MAX', 'AGE_UNIT']);
      expect(res.body.clusters.CMB).toContain('EXCEPTION_CONDITION');
    });
  });

  describe('POST /api/parser/criterion', () => {
    it('should parse a single criterion', async () => {
      const res = await request(app)
        .post('/api/parser/criterion')
        .send({
          criterion: {
            id: 'AGE_001',
            nct_id: 'NCT12345678',
            raw_text: 'Age ≥ 18 years'
          },
          cluster: 'AGE'
        });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('AGE_001');
      expect(res.body.raw_text).toBe('Age ≥ 18 years');
      expect(res.body.AGE_MIN).toBe(18);
      expect(res.body._thought_process).toBeDefined();
    });

    it('should return 400 if criterion is missing', async () => {
      const res = await request(app)
        .post('/api/parser/criterion')
        .send({ cluster: 'AGE' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 400 if cluster is missing', async () => {
      const res = await request(app)
        .post('/api/parser/criterion')
        .send({ criterion: { id: 'X', raw_text: 'Y' } });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 400 if cluster is invalid', async () => {
      const res = await request(app)
        .post('/api/parser/criterion')
        .send({
          criterion: { id: 'X', raw_text: 'Y' },
          cluster: 'INVALID_CLUSTER'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid cluster');
    });
  });

  describe('POST /api/parser/batch', () => {
    it('should parse multiple criteria', async () => {
      const res = await request(app)
        .post('/api/parser/batch')
        .send({
          criteria: [
            { id: 'AGE_001', raw_text: 'Age ≥ 18 years' },
            { id: 'AGE_002', raw_text: 'Age ≤ 65 years' }
          ],
          cluster: 'AGE'
        });

      expect(res.status).toBe(200);
      expect(res.body.results).toBeInstanceOf(Array);
      expect(res.body.results).toHaveLength(2);
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.total).toBe(2);
    });

    it('should return 400 if criteria array is empty', async () => {
      const res = await request(app)
        .post('/api/parser/batch')
        .send({ criteria: [], cluster: 'AGE' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });
});
