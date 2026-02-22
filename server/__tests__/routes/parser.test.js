/**
 * @file parser.test.js
 * @description TDD tests for /api/parser routes (including Parser Testing UI)
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock the ClaudeClient before importing routes
vi.mock('../../services/ClaudeClient.js', () => ({
  getClaudeClient: () => ({
    isConfigured: () => true,
    getApiKeySource: () => 'test',
    initFromDatabase: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        id: 'AGE_001',
        raw_text: 'Age ≥ 18 years',
        _thought_process: 'Identified age minimum of 18 years.',
        AGE_MIN: 18,
        AGE_UNIT: 'years',
        confidence: 1.0,
        parsing_status: 'complete'
      }),
      usage: {
        input_tokens: 100,
        output_tokens: 200,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0
      }
    })
  })
}));

// Mock database module for tests that need database tables
vi.mock('../../db.js', async () => {
  const actual = await vi.importActual('../../db.js');
  
  // In-memory store for mock database
  const mockDb = {
    parserJobs: new Map(),
    parsedCriteria: new Map(),
    apiUsage: [],
    config: new Map([['parser_budget_limit', '100.00']])
  };
  
  return {
    ...actual,
    getDatabase: () => ({
      runAsync: vi.fn().mockImplementation(async (sql, params) => {
        // Handle INSERT for parser_jobs
        if (sql.includes('INSERT INTO parser_jobs')) {
          const id = params[0];
          mockDb.parserJobs.set(id, {
            id,
            createdAt: params[1],
            status: params[2],
            clusterType: params[3],
            modelId: params[4],
            totalCriteria: params[5],
            parsedCount: params[6] || 0,
            skippedCount: params[7] || 0,
            inputFile: params[8],
            parserVersion: params[9],
            inputData: params[10]
          });
          return { changes: 1, lastInsertRowid: id };
        }
        // Handle UPDATE for status
        if (sql.includes('UPDATE parser_jobs SET status')) {
          const jobId = params[1];
          const job = mockDb.parserJobs.get(jobId);
          if (job) {
            job.status = params[0];
          }
          return { changes: 1 };
        }
        // Handle INSERT for parsed_criteria
        if (sql.includes('INSERT INTO parsed_criteria') || sql.includes('INSERT OR REPLACE INTO parsed_criteria')) {
          const criterionId = params[0];
          mockDb.parsedCriteria.set(criterionId, {
            criterionId,
            nctId: params[1],
            clusterType: params[2],
            parsedAt: params[3],
            parserVersion: params[4],
            modelUsed: params[5],
            rawInput: params[6],
            parsedOutput: params[7],
            validationStatus: params[8],
            jobId: params[9]
          });
          return { changes: 1 };
        }
        // Handle DELETE for parsed_criteria
        if (sql.includes('DELETE FROM parsed_criteria WHERE criterionId')) {
          mockDb.parsedCriteria.delete(params[0]);
          return { changes: 1 };
        }
        // Handle INSERT for api_usage
        if (sql.includes('INSERT INTO api_usage')) {
          mockDb.apiUsage.push({
            timestamp: params[0],
            modelId: params[1],
            inputTokens: params[2],
            outputTokens: params[3],
            cacheReadTokens: params[4] || 0,
            cacheWriteTokens: params[5] || 0,
            costUsd: params[6] || params[4],
            jobId: params[7] || params[5]
          });
          return { changes: 1 };
        }
        // Handle config
        if (sql.includes('INSERT OR REPLACE INTO config')) {
          mockDb.config.set(params[0], params[1]);
          return { changes: 1 };
        }
        return { changes: 0 };
      }),
      getAsync: vi.fn().mockImplementation(async (sql, params) => {
        // Get parser job
        if (sql.includes('FROM parser_jobs WHERE id')) {
          return mockDb.parserJobs.get(params[0]);
        }
        // Get parsed criterion
        if (sql.includes('FROM parsed_criteria WHERE criterionId')) {
          return mockDb.parsedCriteria.get(params[0]);
        }
        // Get config
        if (sql.includes('FROM config WHERE key')) {
          const value = mockDb.config.get(params[0]);
          return value ? { value } : undefined;
        }
        // Sum usage
        if (sql.includes('SUM(costUsd)')) {
          const total = mockDb.apiUsage.reduce((sum, u) => sum + u.costUsd, 0);
          return { total };
        }
        return undefined;
      }),
      allAsync: vi.fn().mockImplementation(async (sql, params) => {
        // Get all jobs
        if (sql.includes('FROM parser_jobs')) {
          return Array.from(mockDb.parserJobs.values());
        }
        // Get parsed criteria for job
        if (sql.includes('FROM parsed_criteria WHERE jobId')) {
          return Array.from(mockDb.parsedCriteria.values()).filter(c => c.jobId === params[0]);
        }
        // Check already parsed
        if (sql.includes('FROM parsed_criteria WHERE criterionId IN')) {
          const ids = sql.match(/\?/g)?.map((_, i) => params[i]) || [];
          return ids.filter(id => mockDb.parsedCriteria.has(id)).map(id => mockDb.parsedCriteria.get(id));
        }
        return [];
      }),
      exec: vi.fn()
    }),
    initDatabase: vi.fn().mockResolvedValue(true),
    // Export mock for tests to manipulate
    _mockDb: mockDb
  };
});

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

  // ===========================================================================
  // Parser Testing UI - New Endpoints
  // ===========================================================================

  describe('GET /api/parser/version', () => {
    it('T22: returns parser version', async () => {
      const res = await request(app).get('/api/parser/version');

      expect(res.status).toBe(200);
      expect(res.body.parserVersion).toBeDefined();
      expect(res.body.parserVersion).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('POST /api/parser/upload', () => {
    it('T15: returns criteria count from uploaded JSON', async () => {
      const testCluster = {
        cluster: 'CLUSTER_AIC',
        members: [
          { id: 'AIC_001', nct_id: 'NCT123', raw_text: 'Test criterion 1' },
          { id: 'AIC_002', nct_id: 'NCT456', raw_text: 'Test criterion 2' },
          { id: 'AIC_003', nct_id: 'NCT789', raw_text: 'Test criterion 3' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'test-cluster.json' });

      expect(res.status).toBe(200);
      expect(res.body.criteriaCount).toBe(3);
      expect(res.body.jobId).toBeDefined();
    });

    it('T15b: handles criteria array format', async () => {
      const testCluster = {
        cluster: 'CLUSTER_AIC',
        criteria: [
          { id: 'AIC_001', nct_id: 'NCT123', raw_text: 'Test criterion 1' },
          { id: 'AIC_002', nct_id: 'NCT456', raw_text: 'Test criterion 2' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'test-cluster.json' });

      expect(res.status).toBe(200);
      expect(res.body.criteriaCount).toBe(2);
    });

    it('T15c: returns error for invalid data', async () => {
      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: { invalid: true } });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('T15d: auto-detects cluster from criterion ID prefix (PTH_*)', async () => {
      // JSON without 'cluster' field - should auto-detect from IDs
      const testCluster = {
        members: [
          { id: 'PTH_001', nct_id: 'NCT123', raw_text: 'Prior TNF inhibitor' },
          { id: 'PTH_002', nct_id: 'NCT456', raw_text: 'Methotrexate history' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'pth-cluster.json' });

      expect(res.status).toBe(200);
      expect(res.body.clusterType).toBe('PTH');
      expect(res.body.criteriaCount).toBe(2);
    });

    it('T15e: auto-detects cluster from criterion ID prefix (CMB_*)', async () => {
      const testCluster = {
        members: [
          { id: 'CMB_001', nct_id: 'NCT123', raw_text: 'Diabetes mellitus' },
          { id: 'CMB_002', nct_id: 'NCT456', raw_text: 'Cardiovascular disease' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'cmb-cluster.json' });

      expect(res.status).toBe(200);
      expect(res.body.clusterType).toBe('CMB');
    });

    it('T15f: auto-detects cluster from criterion_id field', async () => {
      const testCluster = {
        criteria: [
          { criterion_id: 'AIC_001', nctId: 'NCT123', text: 'Active infection' },
          { criterion_id: 'AIC_002', nctId: 'NCT456', text: 'Immunodeficiency' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'aic-cluster.json' });

      expect(res.status).toBe(200);
      expect(res.body.clusterType).toBe('AIC');
    });

    it('T15g: prefers explicit cluster field over auto-detection', async () => {
      // Even if IDs suggest PTH, explicit cluster should win
      const testCluster = {
        cluster: 'CLUSTER_CMB',
        members: [
          { id: 'PTH_001', nct_id: 'NCT123', raw_text: 'Test' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'test.json' });

      expect(res.status).toBe(200);
      expect(res.body.clusterType).toBe('CMB');
    });

    it('T15h: returns error when cluster cannot be determined', async () => {
      const testCluster = {
        members: [
          { id: 'UNKNOWN_001', nct_id: 'NCT123', raw_text: 'Test' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'unknown.json' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('cluster');
    });

    it('T15i: auto-detects cluster from filename "Psoriasis_Treatment_History_and_Restrictions"', async () => {
      const testCluster = {
        members: [
          { id: '12345', nct_id: 'NCT123', raw_text: 'Test' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'Psoriasis_Treatment_History_and_Restrictions_members_20260203.json' });

      expect(res.status).toBe(200);
      expect(res.body.clusterType).toBe('PTH');
    });

    it('T15j: auto-detects cluster from filename "Comorbid_Conditions"', async () => {
      const testCluster = {
        members: [
          { id: '12345', nct_id: 'NCT123', raw_text: 'Test' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'Comorbid_Conditions_and_Risk_Factors_members.json' });

      expect(res.status).toBe(200);
      expect(res.body.clusterType).toBe('CMB');
    });

    it('T15k: auto-detects cluster from filename "Active_Infection_Criteria"', async () => {
      const testCluster = {
        members: [
          { id: '12345', nct_id: 'NCT123', raw_text: 'Test' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'Active_Infection_Criteria_members.json' });

      expect(res.status).toBe(200);
      expect(res.body.clusterType).toBe('AIC');
    });

    it('T15l: auto-detects cluster from data.cluster_name field', async () => {
      const testCluster = {
        cluster_name: 'Prior Treatment History',
        members: [
          { id: '12345', nct_id: 'NCT123', raw_text: 'Test' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'random.json' });

      expect(res.status).toBe(200);
      expect(res.body.clusterType).toBe('PTH');
    });

    it('T15m: auto-detects cluster from filename "Severity_Measurements"', async () => {
      const testCluster = {
        members: [
          { id: '12345', nct_id: 'NCT123', raw_text: 'Test' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'Severity_Measurements_members.json' });

      expect(res.status).toBe(200);
      expect(res.body.clusterType).toBe('SEV');
    });

    it('T15n: auto-detects cluster from filename "Flare_Requirements"', async () => {
      const testCluster = {
        members: [
          { id: '12345', nct_id: 'NCT123', raw_text: 'Test' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'Disease_Duration_members.json' });

      expect(res.status).toBe(200);
      expect(res.body.clusterType).toBe('DD');
    });

    it('T15o: auto-detects cluster from filename "Age_Requirements"', async () => {
      const testCluster = {
        members: [
          { id: '12345', nct_id: 'NCT123', raw_text: 'Test' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'Age_Requirements_members.json' });

      expect(res.status).toBe(200);
      expect(res.body.clusterType).toBe('AGE');
    });

    it('T16: identifies already-parsed criteria', async () => {
      // First, add a cached criterion to mock database
      const { getDatabase } = await import('../../db.js');
      const db = getDatabase();
      await db.runAsync(`
        INSERT INTO parsed_criteria 
        (criterionId, nctId, clusterType, parsedAt, parserVersion, modelUsed, rawInput, parsedOutput, validationStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'AIC_001',
        'NCT123',
        'AIC',
        new Date().toISOString(),
        '2.2.0',
        'claude-sonnet-4-5-20250929',
        'Test criterion 1',
        '{}',
        'valid'
      ]);

      const testCluster = {
        cluster: 'CLUSTER_AIC',
        members: [
          { id: 'AIC_001', nct_id: 'NCT123', raw_text: 'Test criterion 1' },
          { id: 'AIC_002', nct_id: 'NCT456', raw_text: 'Test criterion 2' }
        ]
      };

      const res = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'test-cluster.json' });

      expect(res.status).toBe(200);
      expect(res.body.criteriaCount).toBe(2);
      expect(res.body.alreadyParsed).toBe(1);
      expect(res.body.needsParsing).toBe(1);
    });
  });

  describe('POST /api/parser/job/start', () => {
    it('T17: creates job and starts parsing', async () => {
      // First upload
      const testCluster = {
        cluster: 'CLUSTER_AIC',
        members: [
          { id: 'AIC_001', nct_id: 'NCT123', raw_text: 'Test criterion 1' }
        ]
      };

      const uploadRes = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'test.json' });

      const jobId = uploadRes.body.jobId;

      const startRes = await request(app)
        .post('/api/parser/job/start')
        .send({
          jobId,
          model: 'claude-sonnet-4-5-20250929',
          count: 1,
          forceReparse: false
        });

      expect(startRes.status).toBe(200);
      expect(startRes.body.status).toMatch(/running|completed|pending/);
    });
  });

  describe('GET /api/parser/job/:jobId/status', () => {
    it('T18: returns job progress', async () => {
      // Create a job via upload first
      const testCluster = {
        cluster: 'CLUSTER_AIC',
        members: [
          { id: 'AIC_001', nct_id: 'NCT123', raw_text: 'Test criterion 1' }
        ]
      };

      const uploadRes = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'test.json' });

      const jobId = uploadRes.body.jobId;

      const res = await request(app)
        .get(`/api/parser/job/${jobId}/status`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBeDefined();
      expect(res.body.status).toBeDefined();
    });

    it('T18b: returns 404 for non-existent job', async () => {
      const res = await request(app)
        .get('/api/parser/job/non-existent-job/status');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/parser/job/pause', () => {
    it('T19: pauses a running job', async () => {
      // Create a job
      const testCluster = {
        cluster: 'CLUSTER_AIC',
        members: [
          { id: 'AIC_001', nct_id: 'NCT123', raw_text: 'Test 1' },
          { id: 'AIC_002', nct_id: 'NCT456', raw_text: 'Test 2' }
        ]
      };

      const uploadRes = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'test.json' });

      const jobId = uploadRes.body.jobId;

      // Start the job
      await request(app)
        .post('/api/parser/job/start')
        .send({ jobId, model: 'claude-sonnet-4-5-20250929' });

      // Pause the job
      const res = await request(app)
        .post('/api/parser/job/pause')
        .send({ jobId });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('paused');
    });
  });

  describe('POST /api/parser/job/resume', () => {
    it('T20: resumes a paused job', async () => {
      // Create and pause a job
      const testCluster = {
        cluster: 'CLUSTER_AIC',
        members: [
          { id: 'AIC_001', nct_id: 'NCT123', raw_text: 'Test 1' }
        ]
      };

      const uploadRes = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'test.json' });

      const jobId = uploadRes.body.jobId;

      // Start then pause
      await request(app)
        .post('/api/parser/job/start')
        .send({ jobId, model: 'claude-sonnet-4-5-20250929' });

      await request(app)
        .post('/api/parser/job/pause')
        .send({ jobId });

      // Resume
      const res = await request(app)
        .post('/api/parser/job/resume')
        .send({ jobId });

      expect(res.status).toBe(200);
      expect(res.body.status).toMatch(/running|completed/);
    });
  });

  describe('POST /api/parser/estimate', () => {
    it('T23: calculates cost estimate correctly', async () => {
      const res = await request(app)
        .post('/api/parser/estimate')
        .send({
          criteriaCount: 30,
          model: 'claude-sonnet-4-5-20250929',
          useCache: true
        });

      expect(res.status).toBe(200);
      expect(res.body.estimatedCost).toBeDefined();
      expect(typeof res.body.estimatedCost).toBe('number');
      expect(res.body.estimatedCost).toBeGreaterThan(0);
      expect(res.body.estimatedTime).toBeDefined();
      expect(res.body.cacheSavings).toBeDefined();
    });

    it('T23b: Opus model costs more than Sonnet', async () => {
      const sonnetRes = await request(app)
        .post('/api/parser/estimate')
        .send({
          criteriaCount: 30,
          model: 'claude-sonnet-4-5-20250929',
          useCache: true
        });

      const opusRes = await request(app)
        .post('/api/parser/estimate')
        .send({
          criteriaCount: 30,
          model: 'claude-opus-4-20250514',
          useCache: true
        });

      expect(opusRes.body.estimatedCost).toBeGreaterThan(sonnetRes.body.estimatedCost);
    });
  });

  describe('GET /api/parser/balance', () => {
    it('T24: returns usage and remaining balance', async () => {
      const res = await request(app).get('/api/parser/balance');

      expect(res.status).toBe(200);
      expect(res.body.usedAmount).toBeDefined();
      expect(typeof res.body.usedAmount).toBe('number');
      expect(res.body.budgetLimit).toBeDefined();
      expect(res.body.remaining).toBeDefined();
    });
  });

  describe('GET /api/parser/job/:jobId/results', () => {
    it('T25: returns parsed criteria for a job', async () => {
      // Create job and add results
      const testCluster = {
        cluster: 'CLUSTER_AIC',
        members: [
          { id: 'AIC_001', nct_id: 'NCT123', raw_text: 'Test 1' }
        ]
      };

      const uploadRes = await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'test.json' });

      const jobId = uploadRes.body.jobId;

      // Start parsing (will complete since we're mocking)
      await request(app)
        .post('/api/parser/job/start')
        .send({ jobId, model: 'claude-sonnet-4-5-20250929' });

      const res = await request(app)
        .get(`/api/parser/job/${jobId}/results`);

      expect(res.status).toBe(200);
      expect(res.body.results).toBeDefined();
      expect(Array.isArray(res.body.results)).toBe(true);
    });
  });

  describe('GET /api/parser/history', () => {
    it('T26: returns list of past jobs', async () => {
      // Create a job first
      const testCluster = {
        cluster: 'CLUSTER_AIC',
        members: [
          { id: 'AIC_001', nct_id: 'NCT123', raw_text: 'Test 1' }
        ]
      };

      await request(app)
        .post('/api/parser/upload')
        .send({ data: testCluster, filename: 'test.json' });

      const res = await request(app).get('/api/parser/history');

      expect(res.status).toBe(200);
      expect(res.body.jobs).toBeDefined();
      expect(Array.isArray(res.body.jobs)).toBe(true);
    });
  });

  describe('DELETE /api/parser/cache/:criterionId', () => {
    it('T27: clears cached parse for specific criterion', async () => {
      // Add a cached criterion
      const { getDatabase } = await import('../../db.js');
      const db = getDatabase();
      await db.runAsync(`
        INSERT INTO parsed_criteria 
        (criterionId, nctId, clusterType, parsedAt, parserVersion, modelUsed, rawInput, parsedOutput, validationStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'AIC_DELETE_TEST',
        'NCT123',
        'AIC',
        new Date().toISOString(),
        '2.2.0',
        'claude-sonnet-4-5-20250929',
        'Test criterion',
        '{}',
        'valid'
      ]);

      const res = await request(app).delete('/api/parser/cache/AIC_DELETE_TEST');

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });
  });
});
