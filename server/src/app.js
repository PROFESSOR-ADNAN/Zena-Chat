import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/auth.routes.js';
import conversationRoutes from './routes/conversation.routes.js';
import userRoutes from './routes/user.routes.js';
import attachmentRoutes from './routes/attachment.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Serve uploaded attachments (images, audio, docs)
app.use('/uploads', express.static(uploadsDir));

// Rate limit protection
app.use('/api/v1/auth', rateLimiter({ windowMs: 60000, max: 30 }));

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'zena-server' }));
app.get('/healthz', (req, res) => res.json({ status: 'ok', service: 'zena-server' }));

// V1 API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/attachments', attachmentRoutes);
app.use('/api/v1/metrics', metricsRoutes);

// Backwards-compatible routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/users', userRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
