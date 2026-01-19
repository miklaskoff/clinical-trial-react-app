/**
 * @file Express server tests
 * TDD: Tests written BEFORE implementation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

let app;

describe('Express Server', () => {
  beforeAll(async () => {
    // Import the app
    const serverModule = await import('../index.js');
    app = serverModule.app;
  });

  afterAll(async () => {
    // Close database connection
    const dbModule = await import('../db.js');
    await dbModule.closeDatabase();
  });

  describe('Health Check', () => {
    it('should respond to GET /api/health', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('CORS', () => {
    it('should allow CORS from localhost', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers from helmet', async () => {
      const response = await request(app).get('/api/health');
      
      // Helmet adds various security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/unknown-route');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error Handler', () => {
    it('should handle errors gracefully', async () => {
      // This tests the error handler middleware
      const response = await request(app).get('/api/test-error');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
