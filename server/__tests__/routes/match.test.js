/**
 * @file Match route tests
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
          content: [{ text: JSON.stringify({ match: true, confidence: 0.9, reasoning: 'Test match' }) }]
        })
      };
    }
  }
}));

describe('Match Route', () => {
  beforeAll(async () => {
    const serverModule = await import('../../index.js');
    app = serverModule.app;
  });

  afterAll(async () => {
    const dbModule = await import('../../db.js');
    await dbModule.closeDatabase();
  });

  describe('POST /api/match', () => {
    it('should return 400 if patientTerm is missing', async () => {
      const response = await request(app)
        .post('/api/match')
        .send({ criterionTerm: 'diabetes' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/patientTerm/i);
    });

    it('should return 400 if criterionTerm is missing', async () => {
      const response = await request(app)
        .post('/api/match')
        .send({ patientTerm: 'type 2 diabetes' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/criterionTerm/i);
    });

    it('should return match result for valid request', async () => {
      const response = await request(app)
        .post('/api/match')
        .send({
          patientTerm: 'type 2 diabetes',
          criterionTerm: 'diabetes mellitus',
          context: 'medical condition'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('match');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.match).toBe('boolean');
      expect(typeof response.body.confidence).toBe('number');
    });

    it('should handle batch matching requests', async () => {
      const response = await request(app)
        .post('/api/match/batch')
        .send({
          queries: [
            { patientTerm: 'hypertension', criterionTerm: 'high blood pressure' },
            { patientTerm: 'adalimumab', criterionTerm: 'TNF inhibitor' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body.results.length).toBe(2);
    });

    it('should return cached result if available', async () => {
      // First request - will be cached
      const firstResponse = await request(app)
        .post('/api/match')
        .send({
          patientTerm: 'psoriasis',
          criterionTerm: 'plaque psoriasis'
        });

      // Second request - should hit cache
      const secondResponse = await request(app)
        .post('/api/match')
        .send({
          patientTerm: 'psoriasis',
          criterionTerm: 'plaque psoriasis'
        });

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body).toEqual(firstResponse.body);
    });
  });
});
