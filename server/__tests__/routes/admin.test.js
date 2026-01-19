/**
 * @file Admin route tests
 * TDD: Tests written BEFORE implementation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { initDatabase, closeDatabase, db } from '../../db.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let app;

describe('Admin Route', () => {
  const testDbPath = path.join(__dirname, 'test-admin.db');
  
  beforeAll(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    // Initialize database FIRST
    await initDatabase(testDbPath);
    
    // Set admin password for testing
    process.env.ADMIN_PASSWORD = 'test-admin-password';
    
    const serverModule = await import('../../index.js');
    app = serverModule.app;
  });

  beforeEach(async () => {
    // Clear rate limits between tests
    await db.runAsync('DELETE FROM rate_limits');
  });

  afterAll(async () => {
    await closeDatabase();
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('POST /api/admin/login', () => {
    it('should return 400 if password is missing', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 for incorrect password', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({ password: 'wrong-password' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 200 with token for correct password', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({ password: 'test-admin-password' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresAt');
    });
  });

  describe('GET /api/admin/drugs', () => {
    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .get('/api/admin/drugs');

      expect(response.status).toBe(401);
    });

    it('should return approved drugs with valid token', async () => {
      // First login to get token
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ password: 'test-admin-password' });

      const token = loginRes.body.token;

      const response = await request(app)
        .get('/api/admin/drugs')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('drugs');
      expect(Array.isArray(response.body.drugs)).toBe(true);
    });
  });

  describe('POST /api/admin/drugs', () => {
    it('should add a new approved drug', async () => {
      // Login first
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ password: 'test-admin-password' });

      const token = loginRes.body.token;

      const response = await request(app)
        .post('/api/admin/drugs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          drugName: 'testDrug',
          drugClass: 'test_class'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 if drugName is missing', async () => {
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ password: 'test-admin-password' });

      const token = loginRes.body.token;

      const response = await request(app)
        .post('/api/admin/drugs')
        .set('Authorization', `Bearer ${token}`)
        .send({ drugClass: 'test_class' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/admin/drugs/:drugName', () => {
    it('should delete an approved drug', async () => {
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ password: 'test-admin-password' });

      const token = loginRes.body.token;

      // First add a drug
      await request(app)
        .post('/api/admin/drugs')
        .set('Authorization', `Bearer ${token}`)
        .send({ drugName: 'drugToDelete', drugClass: 'test' });

      // Then delete it
      const response = await request(app)
        .delete('/api/admin/drugs/drugToDelete')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/admin/pending', () => {
    it('should return pending reviews', async () => {
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ password: 'test-admin-password' });

      const token = loginRes.body.token;

      const response = await request(app)
        .get('/api/admin/pending')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pending');
      expect(Array.isArray(response.body.pending)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      // Make multiple failed login attempts
      const attempts = [];
      for (let i = 0; i < 7; i++) {
        attempts.push(
          request(app)
            .post('/api/admin/login')
            .send({ password: 'wrong-password' })
        );
      }

      const responses = await Promise.all(attempts);
      
      // Some responses should be rate limited (429)
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
