const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('@rh/shared');
const publicationRoutes = require('./routes/publicationRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'publication-service' });
});

// Publication Routes
app.use('/', publicationRoutes);

// Error Handling
app.use(errorHandler);

module.exports = app;
