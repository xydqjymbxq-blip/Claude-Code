const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getDashboard,
  getStats,
  getStreakInfo,
  getWordHistory,
} = require('../controllers/progressController');

router.use(authenticate);

router.get('/dashboard', getDashboard);
router.get('/stats', getStats);
router.get('/streak', getStreakInfo);
router.get('/word/:id/history', getWordHistory);

module.exports = router;
