const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('@rh/shared');
const documentRoutes = require('./routes/documentRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'document-service' });
});

// Document Routes
app.use('/', documentRoutes);

// Error Handling
app.use(errorHandler);

module.exports = app;
