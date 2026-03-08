const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

async function register(req, res, next) {
  const { email, password, russian_level = 'B1' } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (email, password_hash, russian_level) VALUES ($1, $2, $3) RETURNING id, email, russian_level, created_at',
      [email.toLowerCase(), password_hash, russian_level]
    );

    const user = result.rows[0];
    await db.query('INSERT INTO user_preferences (user_id) VALUES ($1)', [user.id]);

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({ token, user: { id: user.id, email: user.email, russian_level: user.russian_level } });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.json({ token, user: { id: user.id, email: user.email, russian_level: user.russian_level, daily_goal_minutes: user.daily_goal_minutes } });
  } catch (err) {
    next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.russian_level, u.daily_goal_minutes, u.created_at, up.*
       FROM users u
       LEFT JOIN user_preferences up ON u.id = up.user_id
       WHERE u.id = $1`,
      [req.user.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    delete user.password_hash;
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  const { russian_level, daily_goal_minutes, use_web_speech, use_whisper_api, use_elevenlabs_tts, theme } = req.body;
  const userId = req.user.userId;

  try {
    if (russian_level || daily_goal_minutes) {
      await db.query(
        'UPDATE users SET russian_level = COALESCE($1, russian_level), daily_goal_minutes = COALESCE($2, daily_goal_minutes) WHERE id = $3',
        [russian_level, daily_goal_minutes, userId]
      );
    }
    if (use_web_speech !== undefined || use_whisper_api !== undefined || use_elevenlabs_tts !== undefined || theme) {
      await db.query(
        `UPDATE user_preferences SET
          use_web_speech = COALESCE($1, use_web_speech),
          use_whisper_api = COALESCE($2, use_whisper_api),
          use_elevenlabs_tts = COALESCE($3, use_elevenlabs_tts),
          theme = COALESCE($4, theme)
         WHERE user_id = $5`,
        [use_web_speech, use_whisper_api, use_elevenlabs_tts, theme, userId]
      );
    }
    res.json({ message: 'Profile updated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getProfile, updateProfile };
