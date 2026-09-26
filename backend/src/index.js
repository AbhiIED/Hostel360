import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import authRoutes from './routes/authRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import hostelRoutes from './routes/hostelRoutes.js';
import messRoutes from './routes/messRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import displayRoutes from './routes/displayRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import curfewRoutes from './routes/curfewRoutes.js';
import { startTokenSweeper } from './services/sweeper.js';
import { startCurfewScheduler } from './services/curfewScheduler.js';
import prisma from './prisma.js';

dotenv.config();

/**
 * Startup and migration check: Fails loudly if any two active devices share the same secret hash.
 */
export async function verifyDeviceSecretsIntegrity() {
  const activeDevices = await prisma.device.findMany({
    where: { is_active: true },
    select: { id: true, device_code: true, device_name: true, secret_hash: true },
  });

  const seenHashes = new Set();
  for (const device of activeDevices) {
    if (seenHashes.has(device.secret_hash)) {
      const msg = `CRITICAL SECURITY REGRESSION: Active devices share duplicate secret_hash! Device: ${device.device_name} (${device.device_code || device.id})`;
      console.error(msg);
      throw new Error(msg);
    }
    seenHashes.add(device.secret_hash);
  }
  return true;
}

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((u) => u.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

// Security and standard middlewares (9.7 CORS and Helmet Hardened)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", ...allowedOrigins, 'ws:', 'wss:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (like curl, postman, server-to-server) or matching origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin '${origin}' not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id', 'x-device-code'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: corsOptions,
});

// Attach Socket.IO instance to app for use in routes/controllers
app.set('io', io);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'HOSTEL360 API',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/hostels', hostelRoutes);
app.use('/api/messes', messRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/display', displayRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/curfew', curfewRoutes);

// Default 404 handler for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Socket.IO connection and room management
io.on('connection', (socket) => {
  console.log(`Socket client connected: ${socket.id}`);

  // Allow kiosks and dashboards to join device or entity-specific rooms
  socket.on('join', (room) => {
    if (typeof room === 'string') {
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    }
  });

  socket.on('leave', (room) => {
    if (typeof room === 'string') {
      socket.leave(room);
      console.log(`Socket ${socket.id} left room: ${room}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket client disconnected: ${socket.id}`);
  });
});

const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.execArgv.includes('--test') ||
  process.argv.some((a) => a.includes('test'));

if (!isTestEnv) {
  verifyDeviceSecretsIntegrity()
    .then(() => {
      server.listen(PORT, () => {
        console.log(`🚀 HOSTEL360 Backend running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
        console.log(`Health check: http://localhost:${PORT}/api/health`);
        // Start background QR token expiration sweeper
        startTokenSweeper();
        // Start continuous curfew background scheduler
        startCurfewScheduler(io);
      });
    })
    .catch((err) => {
      console.error('Failed to start server due to security integrity failure:', err.message);
      process.exit(1);
    });
}

export { app, server, io };
