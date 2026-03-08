require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { query } = require('../db');

async function migrate() {
  try {
    console.log('Adding unique constraint to practice_sessions...');
    // Remove duplicate rows first (keep the one with the most duration_minutes)
    await query(`
      DELETE FROM practice_sessions
      WHERE id NOT IN (
        SELECT DISTINCT ON (user_id, session_date) id
        FROM practice_sessions
        ORDER BY user_id, session_date, duration_minutes DESC
      )
    `);
    await query(`
      ALTER TABLE practice_sessions
        DROP CONSTRAINT IF EXISTS practice_sessions_user_id_session_date_key,
        ADD CONSTRAINT practice_sessions_user_id_session_date_key UNIQUE (user_id, session_date)
    `);
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
