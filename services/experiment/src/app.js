const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('@rh/shared');
const experimentRoutes = require('./routes/experimentRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'experiment-service' });
});

// Experiment Routes
app.use('/', experimentRoutes);

// Error Handling
app.use(errorHandler);

module.exports = app;
