/**
 * @file Terms API routes
 * @description Handles unknown terms submitted by users for admin review
 */

import express from 'express';
import { db } from '../db.js';

const router = express.Router();

/**
 * POST /api/terms/unknown
 * Submit an unknown term for review
 * @body {string} term - The unknown term
 * @body {string} type - 'condition' or 'treatment'
 * @body {string} [context] - Where this term was entered
 */
router.post('/unknown', async (req, res) => {
  try {
    const { term, type, context } = req.body;
    
    if (!term || !type) {
      return res.status(400).json({ 
        error: 'Missing required fields: term and type' 
      });
    }
    
    const normalizedTerm = term.toLowerCase().trim();
    const validTypes = ['condition', 'treatment'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid type. Must be "condition" or "treatment"' 
      });
    }
    
    // Check if term already exists
    const existing = await db.getAsync(
      'SELECT id, status FROM pending_terms WHERE term = ? AND type = ?',
      [normalizedTerm, type]
    );
    
    if (existing) {
      return res.json({ 
        success: true, 
        message: 'Term already submitted',
        status: existing.status 
      });
    }
    
    // Insert new term
    await db.runAsync(
      `INSERT INTO pending_terms (term, type, context, status, submitted_at)
       VALUES (?, ?, ?, 'pending', ?)`,
      [normalizedTerm, type, context || null, new Date().toISOString()]
    );
    
    res.json({ success: true, message: 'Term submitted for review' });
  } catch (error) {
    console.error('Error submitting unknown term:', error);
    res.status(500).json({ error: 'Failed to submit term' });
  }
});

/**
 * GET /api/terms/approved
 * Get all approved terms for autocomplete sync
 * @query {string} [type] - Filter by type ('condition' or 'treatment')
 */
router.get('/approved', async (req, res) => {
  try {
    const { type } = req.query;
    
    let query = `
      SELECT term, type, synonyms 
      FROM pending_terms 
      WHERE status = 'approved'
    `;
    const params = [];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY term ASC';
    
    const terms = await db.allAsync(query, params);
    
    // Parse synonyms JSON
    const result = terms.map(t => ({
      term: t.term,
      type: t.type,
      synonyms: t.synonyms ? JSON.parse(t.synonyms) : []
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching approved terms:', error);
    res.status(500).json({ error: 'Failed to fetch approved terms' });
  }
});

export default router;
