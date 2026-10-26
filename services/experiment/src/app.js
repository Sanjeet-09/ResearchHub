const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('@rh/shared');
const experimentRoutes = require('./routes/experimentRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    return next();
  }
  express.json()(req, res, next);
});

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'experiment-service' });
});

// Experiment Routes
app.use('/', experimentRoutes);

// Error Handling
app.use(errorHandler);

module.exports = app;
