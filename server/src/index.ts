import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import dotenv from 'dotenv';

import { setupWebSocket } from './websocket/index.js';
import { setupApiRoutes } from './api/index.js';
import { SessionManager } from './services/sessionManager.js';
import { RepositoryService } from './services/repositoryService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add CORS headers for nginx proxy
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Add request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Query:`, req.query);
  next();
});

// Create shared instances
const sessionManager = new SessionManager();
const repositoryService = new RepositoryService();

async function setupServer() {
  try {
    console.log('[Server] Initializing shared services...');
    await repositoryService.initialize();
    console.log('[Server] RepositoryService initialized');

    console.log('[Server] Setting up API routes...');
    await setupApiRoutes(app, io, sessionManager, repositoryService);
    console.log('[Server] API routes setup complete');

    console.log('[Server] Setting up WebSocket...');
    await setupWebSocket(io, sessionManager);
    console.log('[Server] WebSocket setup complete');

    // Serve static files AFTER API routes are set up
    const publicPath = join(dirname(dirname(__dirname)), 'public');
    console.log('[Server] Production mode:', IS_PRODUCTION);
    console.log('[Server] Public path:', publicPath);

    if (IS_PRODUCTION) {
      app.use(express.static(publicPath));
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
          return;
        }
        res.sendFile(join(publicPath, 'index.html'));
      });
    } else {
      // Development mode - serve built files if available  
      if (existsSync(publicPath)) {
        app.use(express.static(publicPath));
        app.get('*', (req, res) => {
          if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
            return;
          }
          res.sendFile(join(publicPath, 'index.html'));
        });
      }
    }

    console.log('[Server] Static file serving configured');
  } catch (error) {
    console.error('[Server] Failed to setup server:', error);
    process.exit(1);
  }
}

// Setup server before starting
setupServer();

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (process.env.WORK_DIR) {
    console.log(`Working directory: ${process.env.WORK_DIR}`);
  }
});