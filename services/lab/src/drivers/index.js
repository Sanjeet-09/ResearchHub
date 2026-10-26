/**
 * Lab Driver Factory
 * Returns the appropriate driver based on LAB_DRIVER env var.
 */
'use strict';

function getDriver() {
  const driverName = (process.env.LAB_DRIVER || (process.env.NODE_ENV === 'production' ? 'gce' : 'local')).toLowerCase();
  if (driverName === 'gce' || driverName === 'compute' || driverName === 'cloudrun') {
    return require('./gceDriver');
  }
  return require('./localDriver');
}

module.exports = { getDriver };
