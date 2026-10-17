const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('@rh/shared');
const activityRoutes = require('./routes/activityRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'activity' });
});

app.use('/', activityRoutes);

app.use(errorHandler);

module.exports = app;
