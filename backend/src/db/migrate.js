require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { query } = require('../db');

const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  russian_level VARCHAR(10) DEFAULT 'B1',
  daily_goal_minutes INTEGER DEFAULT 20,
  preferred_practice_time TIME
);

-- Vocabulary items
CREATE TABLE IF NOT EXISTS vocabulary_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  russian_word VARCHAR(255) NOT NULL,
  english_definition TEXT NOT NULL,
  current_phase INTEGER DEFAULT 1 CHECK (current_phase BETWEEN 1 AND 5),
  times_practiced INTEGER DEFAULT 0,
  last_practiced_date DATE,
  next_review_date DATE,
  pronunciation_accuracy DECIMAL(5,2),
  usage_accuracy DECIMAL(5,2),
  first_learned_date DATE DEFAULT CURRENT_DATE,
  mastered_date DATE,
  source VARCHAR(50) DEFAULT 'imported',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vocab_user_phase ON vocabulary_items(user_id, current_phase);
CREATE INDEX IF NOT EXISTS idx_vocab_next_review ON vocabulary_items(user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_vocab_word ON vocabulary_items(user_id, russian_word);

-- Practice sessions
CREATE TABLE IF NOT EXISTS practice_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_date DATE DEFAULT CURRENT_DATE,
  duration_minutes INTEGER,
  words_practiced INTEGER,
  session_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, session_date)
);

-- Practice attempts (detailed logging)
CREATE TABLE IF NOT EXISTS practice_attempts (
  id SERIAL PRIMARY KEY,
  vocabulary_item_id INTEGER REFERENCES vocabulary_items(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  phase_practiced INTEGER,
  attempt_type VARCHAR(50),
  user_response TEXT,
  accuracy_score DECIMAL(5,2),
  feedback_given TEXT,
  advanced_to_next_phase BOOLEAN DEFAULT FALSE,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attempts_vocab ON practice_attempts(vocabulary_item_id);
CREATE INDEX IF NOT EXISTS idx_attempts_date ON practice_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON practice_attempts(user_id);

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  use_web_speech BOOLEAN DEFAULT TRUE,
  use_whisper_api BOOLEAN DEFAULT FALSE,
  use_elevenlabs_tts BOOLEAN DEFAULT FALSE,
  notification_time TIME,
  notification_enabled BOOLEAN DEFAULT TRUE,
  theme VARCHAR(20) DEFAULT 'light'
);

-- Assessment results
CREATE TABLE IF NOT EXISTS assessments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  total_words INTEGER,
  words_tested INTEGER,
  phase_distribution JSONB,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function migrate() {
  try {
    console.log('Running database migrations...');
    await query(schema);
    console.log('Migrations completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
