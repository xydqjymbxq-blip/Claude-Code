const db = require('../db');
const claude = require('../services/claudeService');
const { getNextReviewDate } = require('../services/spacedRepetitionService');

// Sample words across difficulty strata for assessment
async function sampleWordsForAssessment(userId, sampleSize = 150) {
  // Get total word count
  const totalResult = await db.query('SELECT COUNT(*) FROM vocabulary_items WHERE user_id = $1', [userId]);
  const total = parseInt(totalResult.rows[0].count);

  if (total === 0) return [];

  // Sample evenly across the vocabulary using row_number
  const result = await db.query(
    `SELECT * FROM (
       SELECT *, ROW_NUMBER() OVER (ORDER BY created_at) as rn,
              COUNT(*) OVER () as total_count
       FROM vocabulary_items WHERE user_id = $1
     ) ranked
     WHERE rn % GREATEST(1, (total_count / $2)::integer) = 0
     LIMIT $2`,
    [userId, sampleSize]
  );

  return result.rows;
}

// Statistical projection of phase distribution across all words
function projectPhaseDistribution(assessmentResults, totalWords) {
  const phaseCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  assessmentResults.forEach(r => {
    const phase = r.suggested_phase || 1;
    phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
  });

  const tested = assessmentResults.length;
  const projected = {};
  for (const [phase, count] of Object.entries(phaseCounts)) {
    projected[phase] = Math.round((count / tested) * totalWords);
  }

  // Adjust to ensure total matches
  const projectedTotal = Object.values(projected).reduce((a, b) => a + b, 0);
  const diff = totalWords - projectedTotal;
  projected[1] = Math.max(0, projected[1] + diff);

  return projected;
}

async function startAssessment(req, res, next) {
  const userId = req.user.userId;
  const { sample_size = 150 } = req.body;

  try {
    // Check if words exist
    const totalResult = await db.query('SELECT COUNT(*) FROM vocabulary_items WHERE user_id = $1', [userId]);
    const total = parseInt(totalResult.rows[0].count);

    if (total === 0) {
      return res.status(400).json({ error: 'Please import vocabulary before starting assessment' });
    }

    const words = await sampleWordsForAssessment(userId, Math.min(sample_size, 150));

    // Store assessment state in DB (simplified: just return the words)
    res.json({
      words: words.map(w => ({
        id: w.id,
        russian_word: w.russian_word,
        english_definition: w.english_definition,
      })),
      total_words: total,
      sample_size: words.length,
      instructions: 'You will be tested on recognition (Russian → English) and production (English → Russian) for a sample of your vocabulary.',
    });
  } catch (err) {
    next(err);
  }
}

async function submitAssessmentAnswer(req, res, next) {
  const { word_id, test_type, response } = req.body;

  if (!word_id || !test_type || !response) {
    return res.status(400).json({ error: 'word_id, test_type, and response are required' });
  }

  try {
    const wordResult = await db.query('SELECT * FROM vocabulary_items WHERE id = $1', [word_id]);
    const word = wordResult.rows[0];
    if (!word) return res.status(404).json({ error: 'Word not found' });

    const evaluation = await claude.generateAssessmentFeedback(
      word.russian_word,
      response,
      test_type,
      'B1'
    );

    res.json({ evaluation, word: { russian_word: word.russian_word, english_definition: word.english_definition } });
  } catch (err) {
    next(err);
  }
}

async function completeAssessment(req, res, next) {
  const userId = req.user.userId;
  const { results } = req.body; // Array of { word_id, suggested_phase, correct }

  if (!results || !Array.isArray(results)) {
    return res.status(400).json({ error: 'results array required' });
  }

  try {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const totalResult = await client.query(
        'SELECT COUNT(*) FROM vocabulary_items WHERE user_id = $1',
        [userId]
      );
      const totalWords = parseInt(totalResult.rows[0].count);

      // Update phases for assessed words
      for (const result of results) {
        const phase = Math.max(1, Math.min(5, result.suggested_phase || 1));
        const nextReview = getNextReviewDate(phase, 0);
        await client.query(
          `UPDATE vocabulary_items SET
            current_phase = $1,
            next_review_date = $2,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = $3 AND user_id = $4`,
          [phase, nextReview, result.word_id, userId]
        );
      }

      // Project phases for all remaining (unassessed) words
      const projection = projectPhaseDistribution(results, totalWords);

      // Assign phases to unassessed words based on projection
      const unassessedIds = results.map(r => r.word_id);
      if (unassessedIds.length > 0) {
        for (const [phase, count] of Object.entries(projection)) {
          if (count > 0 && parseInt(phase) > 1) {
            await client.query(
              `UPDATE vocabulary_items SET
                current_phase = $1,
                updated_at = CURRENT_TIMESTAMP
               WHERE user_id = $2
               AND id NOT IN (${unassessedIds.map((_, i) => `$${i + 3}`).join(',')})
               AND current_phase = 1
               AND ctid IN (
                 SELECT ctid FROM vocabulary_items
                 WHERE user_id = $2
                 AND id NOT IN (${unassessedIds.map((_, i) => `$${i + 3}`).join(',')})
                 AND current_phase = 1
                 LIMIT $${unassessedIds.length + 3}
               )`,
              [phase, userId, ...unassessedIds, count]
            );
          }
        }
      }

      // Save assessment record
      await client.query(
        `INSERT INTO assessments (user_id, total_words, words_tested, phase_distribution)
         VALUES ($1, $2, $3, $4)`,
        [userId, totalWords, results.length, JSON.stringify(projection)]
      );

      await client.query('COMMIT');
      res.json({ success: true, projection, total_words: totalWords, assessed: results.length });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
}

async function getAssessmentStatus(req, res, next) {
  const userId = req.user.userId;
  try {
    const result = await db.query(
      'SELECT * FROM assessments WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 1',
      [userId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    next(err);
  }
}

module.exports = { startAssessment, submitAssessmentAnswer, completeAssessment, getAssessmentStatus };
