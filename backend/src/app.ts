import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from './lib/passport';
import eventsRouter from './routes/events';
import authRouter from './routes/auth';

const app = express();

// Parse incoming JSON request bodies
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// Allow requests from the frontend dev server
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));

// Health check — used to verify the server is running
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Mount the events router at /api/events
app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);

export default app;
