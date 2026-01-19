/**
 * @file Rate Limiter Middleware
 * Custom rate limiting with SQLite persistence
 */

import { db } from '../db.js';

/**
 * Creates a rate limiter middleware
 * @param {Object} options - Rate limiter configuration
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Max requests per window
 * @param {string} options.keyPrefix - Prefix for rate limit keys
 * @returns {Function} Express middleware
 */
export function createRateLimiter(options = {}) {
  const {
    windowMs = 60 * 1000, // 1 minute
    max = 10,
    keyPrefix = 'rl'
  } = options;

  return async (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const endpoint = `${keyPrefix}:${req.method}:${req.path}`;
    const now = new Date().toISOString();
    const windowStart = new Date(Date.now() - windowMs).toISOString();

    try {
      // Clean old entries and get current record in parallel
      const [, currentRecord] = await Promise.all([
        db.runAsync(
          'DELETE FROM rate_limits WHERE window_start < ?',
          [windowStart]
        ),
        db.getAsync(
          'SELECT attempts, window_start FROM rate_limits WHERE ip = ? AND endpoint = ?',
          [ip, endpoint]
        )
      ]);

      let attempts = 0;
      
      if (currentRecord && currentRecord.window_start >= windowStart) {
        attempts = currentRecord.attempts;
      }

      if (attempts >= max) {
        res.set('Retry-After', Math.ceil(windowMs / 1000));
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      // Upsert rate limit record
      await db.runAsync(
        `INSERT INTO rate_limits (ip, endpoint, attempts, window_start) 
         VALUES (?, ?, 1, ?)
         ON CONFLICT(ip, endpoint) 
         DO UPDATE SET attempts = attempts + 1, window_start = CASE 
           WHEN window_start < ? THEN ? 
           ELSE window_start 
         END`,
        [ip, endpoint, now, windowStart, now]
      );

      // Set rate limit headers
      res.set('X-RateLimit-Limit', max);
      res.set('X-RateLimit-Remaining', Math.max(0, max - attempts - 1));
      res.set('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // On error, allow request to proceed
      next();
    }
  };
}

/**
 * Strict rate limiter for login attempts
 * 5 attempts per minute
 */
export const loginRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyPrefix: 'login'
});

/**
 * General admin rate limiter
 * 100 requests per minute
 */
export const adminRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyPrefix: 'admin'
});

export default { createRateLimiter, loginRateLimiter, adminRateLimiter };
