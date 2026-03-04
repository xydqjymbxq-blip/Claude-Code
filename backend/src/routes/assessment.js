const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  startAssessment,
  submitAssessmentAnswer,
  completeAssessment,
  getAssessmentStatus,
} = require('../controllers/assessmentController');

router.use(authenticate);

router.post('/start', startAssessment);
router.post('/answer', submitAssessmentAnswer);
router.post('/complete', completeAssessment);
router.get('/status', getAssessmentStatus);

module.exports = router;
