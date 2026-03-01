const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const {
  getDailySession,
  submitAttempt,
  transcribeAudio,
  evaluatePronunciation,
  evaluateSentence,
  evaluateConversation,
  getTTS,
} = require('../controllers/practiceController');

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.use(authenticate);

router.get('/session', getDailySession);
router.post('/attempt', submitAttempt);
router.post('/transcribe', audioUpload.single('audio'), transcribeAudio);
router.post('/evaluate/pronunciation', evaluatePronunciation);
router.post('/evaluate/sentence', evaluateSentence);
router.post('/evaluate/conversation', evaluateConversation);
router.post('/tts', getTTS);

module.exports = router;
