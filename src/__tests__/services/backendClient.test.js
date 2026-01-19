/**
 * @file Backend client tests
 * TDD: Tests written BEFORE implementation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BackendClient } from '../../services/api/backendClient.js';

// Mock fetch
global.fetch = vi.fn();

describe('BackendClient', () => {
  let client;
  
  beforeEach(() => {
    client = new BackendClient('http://localhost:3001');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create client with default baseUrl', () => {
      const defaultClient = new BackendClient();
      expect(defaultClient.baseUrl).toBe('http://localhost:3001');
    });

    it('should create client with custom baseUrl', () => {
      const customClient = new BackendClient('http://api.example.com');
      expect(customClient.baseUrl).toBe('http://api.example.com');
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', timestamp: '2024-01-01T00:00:00Z' })
      });

      const result = await client.healthCheck();

      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/health');
      expect(result).toEqual({ status: 'ok', timestamp: '2024-01-01T00:00:00Z' });
    });

    it('should throw on failed health check', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(client.healthCheck()).rejects.toThrow('Health check failed');
    });
  });

  describe('match', () => {
    it('should match patient with trial', async () => {
      const mockResponse = {
        match: true,
        confidence: 0.95,
        reasoning: 'Patient meets criteria'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await client.match({
        trialId: 'NCT123',
        patientData: { age: 30 },
        criterionText: 'Age 18-65'
      });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/match',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('generateFollowUps', () => {
    it('should generate follow-up questions for a drug', async () => {
      const mockResponse = {
        drugName: 'adalimumab',
        drugClass: 'TNF_inhibitors',
        questions: [
          { id: 'q1', question: 'When did you start taking Humira?' }
        ],
        source: 'cache'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await client.generateFollowUps('adalimumab');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/followups/generate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ drugName: 'adalimumab' })
        })
      );
      expect(result.questions).toHaveLength(1);
    });

    it('should return empty questions on error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await client.generateFollowUps('unknownDrug');

      expect(result.questions).toEqual([]);
      expect(result.error).toBeDefined();
    });
  });

  describe('adminLogin', () => {
    it('should login and store token', async () => {
      const mockResponse = {
        token: 'test-token-123',
        expiresAt: '2024-12-31T23:59:59Z'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await client.adminLogin('admin-password');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/admin/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ password: 'admin-password' })
        })
      );
      expect(result.token).toBe('test-token-123');
      expect(client.authToken).toBe('test-token-123');
    });

    it('should throw on invalid credentials', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Invalid password' })
      });

      await expect(client.adminLogin('wrong-password')).rejects.toThrow('Invalid password');
    });
  });

  describe('authenticated requests', () => {
    it('should include auth header when token is set', async () => {
      client.authToken = 'test-token';

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ drugs: [] })
      });

      await client.getApprovedDrugs();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/admin/drugs',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );
    });
  });

  describe('isBackendAvailable', () => {
    it('should return true when backend is healthy', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' })
      });

      const result = await client.isBackendAvailable();
      expect(result).toBe(true);
    });

    it('should return false when backend is down', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.isBackendAvailable();
      expect(result).toBe(false);
    });
  });
});
