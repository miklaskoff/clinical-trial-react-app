/**
 * @file Follow-up generator tests
 * TDD: Tests written BEFORE implementation
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

let app;

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: class Anthropic {
    constructor() {
      this.messages = {
        create: vi.fn().mockResolvedValue({
          content: [{
            text: JSON.stringify({
              questions: [
                { id: 'q1', text: 'When did you last use this medication?', type: 'number', unit: 'weeks' },
                { id: 'q2', text: 'Are you currently taking this medication?', type: 'radio', options: ['Yes', 'No'] },
                { id: 'q3', text: 'How did you respond to treatment?', type: 'select', options: ['Good response', 'Partial response', 'No response', 'Intolerant'] }
              ]
            })
          }]
        })
      };
    }
  }
}));

describe('Follow-up Generator Route', () => {
  beforeAll(async () => {
    const serverModule = await import('../../index.js');
    app = serverModule.app;
  });

  afterAll(async () => {
    const dbModule = await import('../../db.js');
    await dbModule.closeDatabase();
  });

  describe('POST /api/followups/generate', () => {
    it('should return 400 if drugName is missing', async () => {
      const response = await request(app)
        .post('/api/followups/generate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/drugName/i);
    });

    it('should return follow-up questions for known drug', async () => {
      const response = await request(app)
        .post('/api/followups/generate')
        .send({ drugName: 'adalimumab' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('questions');
      expect(Array.isArray(response.body.questions)).toBe(true);
      expect(response.body.questions.length).toBeGreaterThan(0);
    });

    it('should include drug class in response', async () => {
      const response = await request(app)
        .post('/api/followups/generate')
        .send({ drugName: 'adalimumab' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('drugClass');
    });

    it('should return cached questions on repeat request', async () => {
      // First request
      const first = await request(app)
        .post('/api/followups/generate')
        .send({ drugName: 'etanercept' });

      // Second request should be cached
      const second = await request(app)
        .post('/api/followups/generate')
        .send({ drugName: 'etanercept' });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.cached).toBe(true);
    });

    it('should handle unknown drugs gracefully', async () => {
      const response = await request(app)
        .post('/api/followups/generate')
        .send({ drugName: 'unknownDrugXYZ123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('questions');
      expect(response.body.drugClass).toBe('unknown');
    });

    it('should include relevant criteria IDs in response', async () => {
      const response = await request(app)
        .post('/api/followups/generate')
        .send({ drugName: 'adalimumab' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matchingCriteriaCount');
    });
  });

  describe('GET /api/followups/cache', () => {
    it('should return cache statistics', async () => {
      const response = await request(app)
        .get('/api/followups/cache');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('size');
      expect(response.body).toHaveProperty('entries');
    });
  });

  describe('DELETE /api/followups/cache', () => {
    it('should clear the cache', async () => {
      const response = await request(app)
        .delete('/api/followups/cache');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });
  });
});
