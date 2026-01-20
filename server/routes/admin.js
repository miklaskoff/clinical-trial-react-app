/**
 * @file Admin Routes
 * Authentication, drug management, and pending review operations
 */

import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { loginRateLimiter, adminRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// In-memory token store (simple implementation)
const tokens = new Map();
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a secure token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Auth middleware - validates Bearer token
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const token = authHeader.slice(7);
  const tokenData = tokens.get(token);

  if (!tokenData || tokenData.expiresAt < Date.now()) {
    tokens.delete(token);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  next();
}

/**
 * POST /api/admin/login
 * Authenticate with admin password
 */
router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error('ADMIN_PASSWORD environment variable not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (password !== adminPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = generateToken();
    const expiresAt = Date.now() + TOKEN_EXPIRY_MS;
    
    tokens.set(token, { expiresAt });

    res.json({
      token,
      expiresAt: new Date(expiresAt).toISOString()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/logout
 * Invalidate token
 */
router.post('/logout', requireAuth, async (req, res) => {
  const token = req.headers.authorization?.slice(7);
  tokens.delete(token);
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/admin/drugs
 * List all approved drugs
 */
router.get('/drugs', requireAuth, adminRateLimiter, async (req, res) => {
  try {
    const drugs = await db.allAsync(
      'SELECT drug_name, drug_class, approved_at FROM approved_drugs ORDER BY drug_name'
    );

    res.json({ drugs });
  } catch (error) {
    console.error('Error fetching drugs:', error);
    res.status(500).json({ error: 'Failed to fetch drugs' });
  }
});

/**
 * POST /api/admin/drugs
 * Add a new approved drug
 */
router.post('/drugs', requireAuth, adminRateLimiter, async (req, res) => {
  try {
    const { drugName, drugClass } = req.body;

    if (!drugName) {
      return res.status(400).json({ error: 'drugName is required' });
    }

    const normalizedName = drugName.toLowerCase().trim();

    await db.runAsync(
      `INSERT OR REPLACE INTO approved_drugs (drug_name, drug_class, approved_at) 
       VALUES (?, ?, datetime('now'))`,
      [normalizedName, drugClass || 'unknown']
    );

    res.status(201).json({ 
      message: 'Drug added successfully',
      drug: { drugName: normalizedName, drugClass: drugClass || 'unknown' }
    });
  } catch (error) {
    console.error('Error adding drug:', error);
    res.status(500).json({ error: 'Failed to add drug' });
  }
});

/**
 * DELETE /api/admin/drugs/:drugName
 * Remove an approved drug
 */
router.delete('/drugs/:drugName', requireAuth, adminRateLimiter, async (req, res) => {
  try {
    const { drugName } = req.params;
    const normalizedName = drugName.toLowerCase().trim();

    const result = await db.runAsync(
      'DELETE FROM approved_drugs WHERE drug_name = ?',
      [normalizedName]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Drug not found' });
    }

    res.json({ message: 'Drug deleted successfully' });
  } catch (error) {
    console.error('Error deleting drug:', error);
    res.status(500).json({ error: 'Failed to delete drug' });
  }
});

/**
 * GET /api/admin/pending
 * List all pending reviews
 */
router.get('/pending', requireAuth, adminRateLimiter, async (req, res) => {
  try {
    const pending = await db.allAsync(
      'SELECT id, drug_name, drug_class, status, submitted_at FROM pending_reviews ORDER BY submitted_at DESC'
    );

    res.json({ pending });
  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    res.status(500).json({ error: 'Failed to fetch pending reviews' });
  }
});

/**
 * POST /api/admin/pending
 * Add a drug to pending review
 */
router.post('/pending', requireAuth, adminRateLimiter, async (req, res) => {
  try {
    const { drugName, drugClass } = req.body;

    if (!drugName) {
      return res.status(400).json({ error: 'drugName is required' });
    }

    const normalizedName = drugName.toLowerCase().trim();

    const result = await db.runAsync(
      `INSERT INTO pending_reviews (drug_name, drug_class, submitted_at) 
       VALUES (?, ?, datetime('now'))`,
      [normalizedName, drugClass || 'unknown']
    );

    res.status(201).json({ 
      message: 'Added to pending review',
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error adding pending review:', error);
    res.status(500).json({ error: 'Failed to add pending review' });
  }
});

/**
 * POST /api/admin/pending/:id/approve
 * Approve a pending review (move to approved drugs)
 */
router.post('/pending/:id/approve', requireAuth, adminRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the pending review
    const pending = await db.getAsync(
      'SELECT drug_name, drug_class FROM pending_reviews WHERE id = ?',
      [id]
    );

    if (!pending) {
      return res.status(404).json({ error: 'Pending review not found' });
    }

    // Move to approved drugs and delete from pending in parallel
    await Promise.all([
      db.runAsync(
        `INSERT OR REPLACE INTO approved_drugs (drug_name, drug_class, created_at) 
         VALUES (?, ?, datetime('now'))`,
        [pending.drug_name, pending.drug_class]
      ),
      db.runAsync(
        'DELETE FROM pending_reviews WHERE id = ?',
        [id]
      )
    ]);

    res.json({ 
      message: 'Drug approved successfully',
      drug: { drugName: pending.drug_name, drugClass: pending.drug_class }
    });
  } catch (error) {
    console.error('Error approving drug:', error);
    res.status(500).json({ error: 'Failed to approve drug' });
  }
});

/**
 * DELETE /api/admin/pending/:id
 * Reject/delete a pending review
 */
router.delete('/pending/:id', requireAuth, adminRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.runAsync(
      'DELETE FROM pending_reviews WHERE id = ?',
      [id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Pending review not found' });
    }

    res.json({ message: 'Pending review deleted successfully' });
  } catch (error) {
    console.error('Error deleting pending review:', error);
    res.status(500).json({ error: 'Failed to delete pending review' });
  }
});

/**
 * GET /api/admin/stats
 * Get admin dashboard statistics
 */
router.get('/stats', requireAuth, adminRateLimiter, async (req, res) => {
  try {
    // Parallel queries for stats
    const [drugsCount, pendingCount, cacheCount, pendingTermsCount] = await Promise.all([
      db.getAsync('SELECT COUNT(*) as count FROM approved_drugs'),
      db.getAsync('SELECT COUNT(*) as count FROM pending_reviews'),
      db.getAsync('SELECT COUNT(*) as count FROM followup_cache'),
      db.getAsync('SELECT COUNT(*) as count FROM pending_terms WHERE status = ?', ['pending'])
    ]);

    res.json({
      stats: {
        approvedDrugs: drugsCount?.count || 0,
        pendingReviews: pendingCount?.count || 0,
        cachedFollowups: cacheCount?.count || 0,
        pendingTerms: pendingTermsCount?.count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============================================
// PENDING TERMS MANAGEMENT (Unknown conditions/treatments)
// ============================================

/**
 * GET /api/admin/pending-terms
 * List all pending terms for review
 */
router.get('/pending-terms', requireAuth, adminRateLimiter, async (req, res) => {
  try {
    const terms = await db.allAsync(
      `SELECT id, term, type, context, status, submitted_at 
       FROM pending_terms 
       WHERE status = 'pending' 
       ORDER BY submitted_at DESC`
    );

    res.json({ terms });
  } catch (error) {
    console.error('Error fetching pending terms:', error);
    res.status(500).json({ error: 'Failed to fetch pending terms' });
  }
});

/**
 * POST /api/admin/terms/:id/approve
 * Approve a pending term with optional synonyms
 */
router.post('/terms/:id/approve', requireAuth, adminRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { synonyms } = req.body; // Optional array of synonyms

    // Get the pending term
    const term = await db.getAsync(
      'SELECT * FROM pending_terms WHERE id = ?',
      [id]
    );

    if (!term) {
      return res.status(404).json({ error: 'Pending term not found' });
    }

    if (term.status !== 'pending') {
      return res.status(400).json({ error: 'Term already processed' });
    }

    // Update term status to approved
    await db.runAsync(
      `UPDATE pending_terms 
       SET status = 'approved', 
           synonyms = ?,
           reviewed_at = datetime('now'),
           reviewed_by = 'admin'
       WHERE id = ?`,
      [synonyms ? JSON.stringify(synonyms) : null, id]
    );

    res.json({ 
      message: 'Term approved successfully',
      term: { 
        id, 
        term: term.term, 
        type: term.type,
        synonyms: synonyms || []
      }
    });
  } catch (error) {
    console.error('Error approving term:', error);
    res.status(500).json({ error: 'Failed to approve term' });
  }
});

/**
 * POST /api/admin/terms/:id/reject
 * Reject a pending term
 */
router.post('/terms/:id/reject', requireAuth, adminRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body; // Optional rejection reason

    // Get the pending term
    const term = await db.getAsync(
      'SELECT * FROM pending_terms WHERE id = ?',
      [id]
    );

    if (!term) {
      return res.status(404).json({ error: 'Pending term not found' });
    }

    if (term.status !== 'pending') {
      return res.status(400).json({ error: 'Term already processed' });
    }

    // Update term status to rejected
    await db.runAsync(
      `UPDATE pending_terms 
       SET status = 'rejected', 
           context = COALESCE(context, '') || ' | Rejection reason: ' || ?,
           reviewed_at = datetime('now'),
           reviewed_by = 'admin'
       WHERE id = ?`,
      [reason || 'No reason provided', id]
    );

    res.json({ 
      message: 'Term rejected successfully',
      term: { id, term: term.term, type: term.type }
    });
  } catch (error) {
    console.error('Error rejecting term:', error);
    res.status(500).json({ error: 'Failed to reject term' });
  }
});

/**
 * GET /api/admin/terms/history
 * Get history of all processed terms
 */
router.get('/terms/history', requireAuth, adminRateLimiter, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    let query = `SELECT * FROM pending_terms WHERE status != 'pending'`;
    const params = [];
    
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY reviewed_at DESC LIMIT ?`;
    params.push(parseInt(limit, 10));

    const terms = await db.allAsync(query, params);

    res.json({ terms });
  } catch (error) {
    console.error('Error fetching terms history:', error);
    res.status(500).json({ error: 'Failed to fetch terms history' });
  }
});

export default router;
