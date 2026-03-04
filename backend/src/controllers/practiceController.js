const db = require('../db');
const claude = require('../services/claudeService');
const { transcribeWithWhisper } = require('../services/whisperService');
const { getNextReviewDate, buildDailySession } = require('../services/spacedRepetitionService');

async function getDailySession(req, res, next) {
  const userId = req.user.userId;
  const { minutes = 20 } = req.query;

  try {
    const userResult = await db.query('SELECT daily_goal_minutes FROM users WHERE id = $1', [userId]);
    const goalMinutes = parseInt(minutes) || userResult.rows[0]?.daily_goal_minutes || 20;
    const allocation = buildDailySession(goalMinutes);

    const session = {};

    for (const [phase, count] of Object.entries(allocation)) {
      const result = await db.query(
        `SELECT * FROM vocabulary_items
         WHERE user_id = $1 AND current_phase = $2
         AND (next_review_date IS NULL OR next_review_date <= CURRENT_DATE)
         ORDER BY
           CASE WHEN next_review_date IS NULL THEN 1 ELSE 0 END DESC,
           next_review_date ASC,
           usage_accuracy ASC NULLS FIRST
         LIMIT $3`,
        [userId, phase, count]
      );
      session[`phase${phase}`] = result.rows;
    }

    // Count total words due
    const overdueResult = await db.query(
      `SELECT COUNT(*) FROM vocabulary_items
       WHERE user_id = $1 AND (next_review_date IS NULL OR next_review_date <= CURRENT_DATE)`,
      [userId]
    );

    res.json({
      session,
      goalMinutes,
      overdue: parseInt(overdueResult.rows[0].count),
    });
  } catch (err) {
    next(err);
  }
}

async function submitAttempt(req, res, next) {
  const userId = req.user.userId;
  const {
    vocabulary_item_id,
    phase_practiced,
    attempt_type,
    user_response,
    accuracy_score,
    feedback_given,
    duration_seconds,
    advance,
  } = req.body;

  try {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Insert attempt
      await client.query(
        `INSERT INTO practice_attempts
           (vocabulary_item_id, user_id, phase_practiced, attempt_type, user_response, accuracy_score, feedback_given, advanced_to_next_phase, duration_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [vocabulary_item_id, userId, phase_practiced, attempt_type, user_response, accuracy_score, feedback_given, !!advance, duration_seconds]
      );

      // Count attempts for this word in this phase to determine review interval
      const attemptCount = await client.query(
        `SELECT COUNT(*) FROM practice_attempts
         WHERE vocabulary_item_id = $1 AND phase_practiced = $2`,
        [vocabulary_item_id, phase_practiced]
      );
      const nextAttemptNum = parseInt(attemptCount.rows[0].count);

      let updateFields = {
        times_practiced: 'times_practiced + 1',
        last_practiced_date: 'CURRENT_DATE',
        next_review_date: `'${getNextReviewDate(advance ? phase_practiced + 1 : phase_practiced, nextAttemptNum)}'`,
      };

      if (accuracy_score !== undefined) {
        if (attempt_type === 'pronunciation') {
          updateFields.pronunciation_accuracy = accuracy_score;
        } else {
          updateFields.usage_accuracy = accuracy_score;
        }
      }

      let phaseUpdate = '';
      if (advance) {
        const newPhase = Math.min(5, parseInt(phase_practiced) + 1);
        phaseUpdate = `, current_phase = ${newPhase}`;
        if (newPhase === 5) {
          phaseUpdate += ', mastered_date = CURRENT_DATE';
        }
      }

      await client.query(
        `UPDATE vocabulary_items SET
          times_practiced = times_practiced + 1,
          last_practiced_date = CURRENT_DATE,
          next_review_date = $1,
          pronunciation_accuracy = CASE WHEN $2 = 'pronunciation' THEN $3 ELSE pronunciation_accuracy END,
          usage_accuracy = CASE WHEN $2 != 'pronunciation' THEN $3 ELSE usage_accuracy END,
          updated_at = CURRENT_TIMESTAMP
          ${phaseUpdate}
         WHERE id = $4 AND user_id = $5`,
        [
          getNextReviewDate(advance ? parseInt(phase_practiced) + 1 : parseInt(phase_practiced), nextAttemptNum),
          attempt_type,
          accuracy_score,
          vocabulary_item_id,
          userId,
        ]
      );

      await client.query('COMMIT');
      res.json({ success: true, advanced: !!advance });
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

async function transcribeAudio(req, res, next) {
  if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

  try {
    // Check user preference for Whisper vs Web Speech
    const prefResult = await db.query('SELECT use_whisper_api FROM user_preferences WHERE user_id = $1', [req.user.userId]);
    const useWhisper = prefResult.rows[0]?.use_whisper_api && process.env.OPENAI_API_KEY;

    if (useWhisper) {
      const transcript = await transcribeWithWhisper(req.file.buffer, req.file.originalname || 'audio.webm');
      return res.json({ transcript, method: 'whisper' });
    }

    // Return empty - frontend will use Web Speech API
    res.json({ transcript: null, method: 'web_speech', message: 'Use Web Speech API on frontend' });
  } catch (err) {
    next(err);
  }
}

async function evaluatePronunciation(req, res, next) {
  const { target_word, transcript } = req.body;
  if (!target_word || !transcript) {
    return res.status(400).json({ error: 'target_word and transcript are required' });
  }

  try {
    const userResult = await db.query('SELECT russian_level FROM users WHERE id = $1', [req.user.userId]);
    const level = userResult.rows[0]?.russian_level || 'B1';
    const evaluation = await claude.evaluatePronunciation(target_word, transcript, level);
    res.json(evaluation);
  } catch (err) {
    next(err);
  }
}

async function evaluateSentence(req, res, next) {
  const { target_word, sentence } = req.body;
  if (!target_word || !sentence) {
    return res.status(400).json({ error: 'target_word and sentence are required' });
  }

  try {
    const userResult = await db.query('SELECT russian_level FROM users WHERE id = $1', [req.user.userId]);
    const level = userResult.rows[0]?.russian_level || 'B1';
    const evaluation = await claude.evaluateSentence(target_word, sentence, level);
    res.json(evaluation);
  } catch (err) {
    next(err);
  }
}

async function evaluateConversation(req, res, next) {
  const { target_words, transcript, phase = 4, conversation_history = [], user_message } = req.body;

  try {
    const userResult = await db.query('SELECT russian_level FROM users WHERE id = $1', [req.user.userId]);
    const level = userResult.rows[0]?.russian_level || 'B1';

    if (user_message && !transcript) {
      // Generate conversation reply
      const topic = req.body.topic || 'general conversation';
      const reply = await claude.generateConversationReply(user_message, topic, target_words || [], conversation_history, level);
      return res.json({ reply });
    }

    const evaluation = await claude.evaluateConversation(target_words || [], transcript, level, phase);
    res.json(evaluation);
  } catch (err) {
    next(err);
  }
}

async function getTTS(req, res, next) {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  // Return signal to use browser TTS (ElevenLabs integration can be added later)
  res.json({ method: 'browser_tts', text, lang: 'ru-RU' });
}

module.exports = { getDailySession, submitAttempt, transcribeAudio, evaluatePronunciation, evaluateSentence, evaluateConversation, getTTS };
