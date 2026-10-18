/**
 * lab-service — CloudRun Driver (stub for Phase 10)
 *
 * This file is a placeholder that will be fully implemented in Phase 10.
 * Exported interface must match localDriver.js.
 */
'use strict';

async function create() {
  throw new Error('CloudRun driver not implemented in Phase 9. Set LAB_DRIVER=local');
}

async function deleteContainer() {
  throw new Error('CloudRun driver not implemented in Phase 9. Set LAB_DRIVER=local');
}

async function status() {
  return 'not_found';
}

async function list() {
  return [];
}

async function waitForJupyter() {
  return false;
}

async function checkpoint() {
  return false;
}

async function areAllKernelsIdle() {
  return false;
}

module.exports = {
  create,
  deleteContainer,
  status,
  list,
  waitForJupyter,
  checkpoint,
  areAllKernelsIdle,
};
