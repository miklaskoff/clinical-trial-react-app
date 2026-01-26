/**
 * @file Express server entry point
 * @description Main server with middleware, routes, and error handling
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { initDatabase, getDatabase } from './db.js';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet());

// CORS configuration - allow all localhost ports for development
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow any localhost origin
    if (origin.match(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test error endpoint (for testing error handler)
app.get('/api/test-error', (req, res, next) => {
  next(new Error('Test error'));
});

// Import and mount route modules
import matchRoutes from './routes/match.js';
import followupRoutes from './routes/followups.js';
import adminRoutes from './routes/admin.js';
import configRoutes from './routes/config.js';
import termsRoutes from './routes/terms.js';

app.use('/api/match', matchRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/config', configRoutes);
app.use('/api/terms', termsRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internal server error',
    ...(isDev && { stack: err.stack })
  });
});

// ============================================
// SERVER STARTUP
// ============================================

let server = null;

/**
 * Start the server
 * @returns {Promise<void>}
 */
async function startServer() {
  try {
    // Initialize database
    await initDatabase();
    console.log('✓ Database initialized');

    // Try to initialize Claude client from stored API key
    const { getClaudeClient } = await import('./services/ClaudeClient.js');
    const client = getClaudeClient();
    const apiKeyLoaded = await client.initFromDatabase();
    if (!apiKeyLoaded) {
      console.log('ℹ API key not configured - configure via Admin panel');
    }

    // Start listening
    server = app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('\nShutting down gracefully...');
  
  if (server) {
    server.close();
  }
  
  const { closeDatabase } = await import('./db.js');
  await closeDatabase();
  
  console.log('Server shut down complete');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Only start server if this is the main module (not imported for testing)
if (process.argv[1]?.includes('index.js')) {
  startServer();
}

// Export for testing
export { app, startServer, shutdown };
