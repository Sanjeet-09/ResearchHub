const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('@rh/shared');
const equipmentRoutes = require('./routes/equipmentRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'equipment-service' });
});

// Equipment & Reservation Routes
app.use('/', equipmentRoutes);

// Global Error Handling
app.use(errorHandler);

module.exports = app;
