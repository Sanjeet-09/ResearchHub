const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('@rh/shared');
const datasetRoutes = require('./routes/datasetRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    return next();
  }
  express.json({ limit: '50mb' })(req, res, next);
});

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'dataset-service' });
});

// Dataset Routes
app.use('/', datasetRoutes);

// Error Handling
app.use(errorHandler);

module.exports = app;
