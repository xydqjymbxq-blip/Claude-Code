require('dotenv').config();

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'ANTHROPIC_API_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const authRoutes = require('./routes/auth');
const vocabularyRoutes = require('./routes/vocabulary');
const practiceRoutes = require('./routes/practice');
const progressRoutes = require('./routes/progress');
const assessmentRoutes = require('./routes/assessment');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(o => o.trim().replace(/[\r\n\t]/g, '')).filter(Boolean)
    : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    console.error(`CORS blocked origin: "${origin}" — allowed: ${JSON.stringify(allowedOrigins)}`);
    const err = new Error(`CORS: origin ${origin} not allowed`);
    err.status = 403;
    callback(err);
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/vocabulary', vocabularyRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/assessment', assessmentRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', error: 'Database unavailable' });
  }
});

app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
