const db = require('../db');

async function getDashboard(req, res, next) {
  const userId = req.user.userId;

  try {
    // Phase distribution
    const phaseResult = await db.query(
      `SELECT current_phase, COUNT(*) as count
       FROM vocabulary_items WHERE user_id = $1
       GROUP BY current_phase
       ORDER BY current_phase`,
      [userId]
    );

    // Total words
    const totalResult = await db.query(
      'SELECT COUNT(*) FROM vocabulary_items WHERE user_id = $1',
      [userId]
    );

    // This week's stats
    const weekResult = await db.query(
      `SELECT
        COUNT(DISTINCT vi.id) as words_practiced,
        COUNT(CASE WHEN pa.advanced_to_next_phase THEN 1 END) as words_advanced,
        COUNT(CASE WHEN vi.current_phase = 5 AND vi.mastered_date >= CURRENT_DATE - 7 THEN 1 END) as words_mastered
       FROM practice_attempts pa
       JOIN vocabulary_items vi ON pa.vocabulary_item_id = vi.id
       WHERE pa.user_id = $1 AND pa.created_at >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );

    // Practice time this week
    const timeResult = await db.query(
      `SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
       FROM practice_sessions
       WHERE user_id = $1 AND session_date >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );

    // Streak
    const streakResult = await db.query(
      `SELECT COUNT(DISTINCT session_date) as streak
       FROM practice_sessions
       WHERE user_id = $1
       AND session_date >= CURRENT_DATE - INTERVAL '30 days'
       AND session_date = CURRENT_DATE - (CURRENT_DATE - session_date)`,
      [userId]
    );

    const phaseDist = {};
    for (let i = 1; i <= 5; i++) phaseDist[i] = 0;
    phaseResult.rows.forEach(r => { phaseDist[r.current_phase] = parseInt(r.count); });

    const total = parseInt(totalResult.rows[0].count);
    const week = weekResult.rows[0];

    res.json({
      total_words: total,
      phase_distribution: phaseDist,
      this_week: {
        words_practiced: parseInt(week.words_practiced) || 0,
        words_advanced: parseInt(week.words_advanced) || 0,
        words_mastered: parseInt(week.words_mastered) || 0,
        practice_minutes: parseInt(timeResult.rows[0].total_minutes) || 0,
      },
      estimated_months_to_master: total > 0 ? Math.round((total - (phaseDist[5] || 0)) / Math.max(1, parseInt(week.words_advanced) || 1) * 0.25) : null,
    });
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  const userId = req.user.userId;
  const { days = 30 } = req.query;

  try {
    // Daily practice over time
    const dailyResult = await db.query(
      `SELECT session_date, SUM(duration_minutes) as minutes, SUM(words_practiced) as words
       FROM practice_sessions
       WHERE user_id = $1 AND session_date >= CURRENT_DATE - $2::integer
       GROUP BY session_date ORDER BY session_date`,
      [userId, days]
    );

    // Accuracy trends
    const accuracyResult = await db.query(
      `SELECT
        DATE_TRUNC('week', created_at) as week,
        AVG(CASE WHEN attempt_type = 'pronunciation' THEN accuracy_score END) as avg_pronunciation,
        AVG(CASE WHEN attempt_type != 'pronunciation' THEN accuracy_score END) as avg_usage
       FROM practice_attempts
       WHERE user_id = $1 AND created_at >= CURRENT_DATE - $2::integer
       GROUP BY week ORDER BY week`,
      [userId, days]
    );

    // Words mastered over time
    const masteredResult = await db.query(
      `SELECT mastered_date, COUNT(*) as count
       FROM vocabulary_items
       WHERE user_id = $1 AND mastered_date IS NOT NULL AND mastered_date >= CURRENT_DATE - $2::integer
       GROUP BY mastered_date ORDER BY mastered_date`,
      [userId, days]
    );

    res.json({
      daily_practice: dailyResult.rows,
      accuracy_trends: accuracyResult.rows,
      mastered_over_time: masteredResult.rows,
    });
  } catch (err) {
    next(err);
  }
}

async function getStreakInfo(req, res, next) {
  const userId = req.user.userId;

  try {
    const result = await db.query(
      `SELECT session_date FROM practice_sessions
       WHERE user_id = $1
       ORDER BY session_date DESC`,
      [userId]
    );

    const dates = result.rows.map(r => r.session_date.toISOString().split('T')[0]);
    const uniqueDates = [...new Set(dates)].sort().reverse();

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let expected = today;

    for (const date of uniqueDates) {
      if (date === expected) {
        streak++;
        const d = new Date(expected);
        d.setDate(d.getDate() - 1);
        expected = d.toISOString().split('T')[0];
      } else {
        break;
      }
    }

    res.json({ streak, last_practiced: uniqueDates[0] || null, practice_dates: uniqueDates.slice(0, 60) });
  } catch (err) {
    next(err);
  }
}

async function getWordHistory(req, res, next) {
  const userId = req.user.userId;
  const { id } = req.params;

  try {
    const word = await db.query('SELECT * FROM vocabulary_items WHERE id = $1 AND user_id = $2', [id, userId]);
    if (!word.rows[0]) return res.status(404).json({ error: 'Word not found' });

    const attempts = await db.query(
      `SELECT * FROM practice_attempts WHERE vocabulary_item_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [id]
    );

    res.json({ word: word.rows[0], attempts: attempts.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard, getStats, getStreakInfo, getWordHistory };
