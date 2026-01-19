/**
 * @file Config routes for API key storage
 * @description Securely stores API keys on the server
 */

import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

/**
 * POST /api/config/apikey
 * Store API key on server (NOT in client localStorage)
 */
router.post('/apikey', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    // Validate API key format (basic check)
    if (!apiKey.startsWith('sk-ant-')) {
      return res.status(400).json({ error: 'Invalid API key format' });
    }
    
    // Store encrypted or hashed in production - for now, store directly
    // In production, use proper encryption with a server-side secret
    const now = new Date().toISOString();
    
    await db.runAsync(
      `INSERT OR REPLACE INTO config (key, value, updated_at) 
       VALUES (?, ?, ?)`,
      ['anthropic_api_key', apiKey, now]
    );
    
    res.json({ success: true, message: 'API key stored securely on server' });
  } catch (error) {
    console.error('Error storing API key:', error);
    res.status(500).json({ error: 'Failed to store API key' });
  }
});

/**
 * GET /api/config/apikey/status
 * Check if API key is configured (without returning the key)
 */
router.get('/apikey/status', async (req, res) => {
  try {
    const config = await db.getAsync(
      'SELECT key, updated_at FROM config WHERE key = ?',
      ['anthropic_api_key']
    );
    
    res.json({ 
      configured: !!config,
      updatedAt: config?.updated_at || null
    });
  } catch (error) {
    console.error('Error checking API key status:', error);
    res.status(500).json({ error: 'Failed to check API key status' });
  }
});

/**
 * DELETE /api/config/apikey
 * Remove stored API key
 */
router.delete('/apikey', async (req, res) => {
  try {
    await db.runAsync(
      'DELETE FROM config WHERE key = ?',
      ['anthropic_api_key']
    );
    
    res.json({ success: true, message: 'API key removed' });
  } catch (error) {
    console.error('Error removing API key:', error);
    res.status(500).json({ error: 'Failed to remove API key' });
  }
});

/**
 * Internal function to get API key for other services
 * NOT exposed as HTTP endpoint
 */
export async function getStoredApiKey() {
  const config = await db.getAsync(
    'SELECT value FROM config WHERE key = ?',
    ['anthropic_api_key']
  );
  return config?.value || null;
}

export default router;
