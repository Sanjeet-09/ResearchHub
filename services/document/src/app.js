const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('@rh/shared');
const documentRoutes = require('./routes/documentRoutes');

const app = express();

app.use(helmet());
app.use(cors());

// Bypass express.json() when Content-Type is multipart/form-data so multer gets raw stream
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    return next();
  }
  express.json()(req, res, next);
});

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'document-service' });
});

// Document Routes
app.use('/', documentRoutes);

// Error Handling
app.use(errorHandler);

module.exports = app;
