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

  const phaseNum = parseInt(phase_practiced);
  if (!Number.isInteger(phaseNum) || phaseNum < 1 || phaseNum > 5) {
    return res.status(400).json({ error: 'phase_practiced must be an integer between 1 and 5' });
  }

  try {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Insert attempt
      await client.query(
        `INSERT INTO practice_attempts
           (vocabulary_item_id, user_id, phase_practiced, attempt_type, user_response, accuracy_score, feedback_given, advanced_to_next_phase, duration_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [vocabulary_item_id, userId, phaseNum, attempt_type, user_response, accuracy_score ?? null, feedback_given, !!advance, duration_seconds]
      );

      // Count attempts for this word in this phase to determine review interval
      const attemptCount = await client.query(
        `SELECT COUNT(*) FROM practice_attempts
         WHERE vocabulary_item_id = $1 AND phase_practiced = $2`,
        [vocabulary_item_id, phaseNum]
      );
      const nextAttemptNum = parseInt(attemptCount.rows[0].count);

      const newPhase = advance ? Math.min(5, phaseNum + 1) : phaseNum;
      const nextReview = getNextReviewDate(newPhase, nextAttemptNum);
      const advancedToPhase5 = advance && newPhase === 5;

      await client.query(
        `UPDATE vocabulary_items SET
          times_practiced = times_practiced + 1,
          last_practiced_date = CURRENT_DATE,
          next_review_date = $1,
          pronunciation_accuracy = CASE WHEN $2 = 'pronunciation' THEN COALESCE($3, pronunciation_accuracy) ELSE pronunciation_accuracy END,
          usage_accuracy = CASE WHEN $2 != 'pronunciation' THEN COALESCE($3, usage_accuracy) ELSE usage_accuracy END,
          current_phase = CASE WHEN $4 THEN $5 ELSE current_phase END,
          mastered_date = CASE WHEN $6 THEN CURRENT_DATE ELSE mastered_date END,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 AND user_id = $8`,
        [
          nextReview,
          attempt_type,
          accuracy_score ?? null,
          !!advance,
          newPhase,
          advancedToPhase5,
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

async function completeSession(req, res, next) {
  const userId = req.user.userId;
  const { duration_minutes, words_practiced } = req.body;

  try {
    await db.query(
      `INSERT INTO practice_sessions (user_id, session_date, duration_minutes, words_practiced, session_type)
       VALUES ($1, CURRENT_DATE, $2, $3, 'mixed')
       ON CONFLICT (user_id, session_date) DO UPDATE SET
         duration_minutes = practice_sessions.duration_minutes + EXCLUDED.duration_minutes,
         words_practiced = practice_sessions.words_practiced + EXCLUDED.words_practiced`,
      [userId, Math.max(0, parseInt(duration_minutes) || 0), Math.max(0, parseInt(words_practiced) || 0)]
    );
    res.json({ success: true });
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

module.exports = { getDailySession, submitAttempt, completeSession, transcribeAudio, evaluatePronunciation, evaluateSentence, evaluateConversation, getTTS };
