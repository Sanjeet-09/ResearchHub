'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('@rh/shared');
const labRoutes = require('./routes/labRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check (also exposed via labRoutes)
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'lab', driver: process.env.LAB_DRIVER || 'local' });
});

app.use('/', labRoutes);

app.use(errorHandler);

module.exports = app;
