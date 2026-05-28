import express from 'express';
import cors from 'cors';
import mailRoutes from './routes/mail.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';

const app = express();

// Production-ready CORS
// In production, FRONTEND_URL should be set to your actual domain
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['POST'], // We only need POST for this module
  allowedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api', mailRoutes);

// Error Handling
app.use(errorHandler);

export default app;
