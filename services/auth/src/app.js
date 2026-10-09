const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('@rh/shared');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Security & Parsing
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint (required by Section 4)
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

// Auth Routes (supports both /auth/* and root mounted)
app.use('/auth', authRoutes);
app.use('/', authRoutes);

// Error Handling
app.use(errorHandler);

module.exports = app;
