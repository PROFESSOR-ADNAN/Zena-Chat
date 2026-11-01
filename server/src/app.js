import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes.js';
import conversationRoutes from './routes/conversation.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'zena-server' }));
app.get('/healthz', (req, res) => res.json({ status: 'ok', service: 'zena-server' }));

// V1 API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/conversations', conversationRoutes);

// Backwards-compatible routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
