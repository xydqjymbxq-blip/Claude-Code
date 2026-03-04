const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const {
  importVocabulary,
  getVocabulary,
  getWordById,
  updateWord,
  deleteWord,
  getPhaseWords,
} = require('../controllers/vocabularyController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.json') || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and JSON files are allowed'));
    }
  },
});

router.use(authenticate);

router.post('/import', upload.single('file'), importVocabulary);
router.get('/', getVocabulary);
router.get('/phase/:phase', getPhaseWords);
router.get('/:id', getWordById);
router.put('/:id', updateWord);
router.delete('/:id', deleteWord);

module.exports = router;
