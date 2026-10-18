/**
 * Lab Driver Factory
 * Returns the appropriate driver based on LAB_DRIVER env var.
 */
'use strict';

function getDriver() {
  const driverName = (process.env.LAB_DRIVER || 'local').toLowerCase();
  if (driverName === 'cloudrun') {
    return require('./cloudrunDriver');
  }
  return require('./localDriver');
}

module.exports = { getDriver };
