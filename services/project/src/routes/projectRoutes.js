const express = require('express');
const {
  authenticateToken,
  requireRole,
  requireProjectRole,
} = require('@rh/shared');
const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  updateProjectStatus,
  deleteProject,
  addMember,
  removeMember,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} = require('../controllers/projectController');

const router = express.Router();

router.use(authenticateToken);

// Project collection routes
router.get('/', getProjects);
router.post('/', createProject);

// Single project routes
router.get('/:id', getProjectById);
router.patch('/:id', requireProjectRole('lead'), updateProject);
router.patch('/:id/status', requireProjectRole('lead'), updateProjectStatus);
router.delete('/:id', requireProjectRole('lead'), deleteProject);

// Project member management
router.post('/:id/members', requireProjectRole('lead'), addMember);
router.delete('/:id/members/:userId', requireProjectRole('lead'), removeMember);

// Milestone routes
router.post('/:id/milestones', requireProjectRole('member'), createMilestone);
router.patch('/:id/milestones/:milestoneId', requireProjectRole('member'), updateMilestone);
router.delete('/:id/milestones/:milestoneId', requireProjectRole('lead'), deleteMilestone);

module.exports = router;
