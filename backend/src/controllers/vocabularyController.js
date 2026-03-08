const db = require('../db');

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  const items = [];
  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length >= 2 && parts[0] && parts[1]) {
      items.push({ russian_word: parts[0], english_definition: parts[1], notes: parts[2] || null });
    }
  }
  return items;
}

function parseJSON(content) {
  const data = JSON.parse(content);
  const arr = Array.isArray(data) ? data : data.cards || data.items || [];
  return arr.map(item => ({
    russian_word: item.russian_word || item.russian || item.front || item.word || '',
    english_definition: item.english_definition || item.english || item.back || item.definition || '',
    notes: item.notes || item.context || null,
  })).filter(item => item.russian_word && item.english_definition);
}

async function importVocabulary(req, res, next) {
  const userId = req.user.userId;

  try {
    let items = [];

    if (req.file) {
      const content = req.file.buffer.toString('utf-8');
      if (req.file.originalname.endsWith('.json') || req.file.mimetype === 'application/json') {
        items = parseJSON(content);
      } else {
        items = parseCSV(content);
      }
    } else if (req.body.words && Array.isArray(req.body.words)) {
      items = req.body.words;
    } else {
      return res.status(400).json({ error: 'No valid file or words provided' });
    }

    if (items.length === 0) {
      return res.status(400).json({ error: 'No valid vocabulary items found in import' });
    }

    // Deduplicate: get existing words for this user
    const existingResult = await db.query(
      'SELECT russian_word FROM vocabulary_items WHERE user_id = $1',
      [userId]
    );
    const existingWords = new Set(existingResult.rows.map(r => r.russian_word.toLowerCase()));

    const newItems = items.filter(item => !existingWords.has(item.russian_word.toLowerCase()));

    if (newItems.length === 0) {
      return res.json({ message: 'All words already imported', imported: 0, duplicates: items.length });
    }

    // Batch insert
    const chunkSize = 500;
    let imported = 0;
    for (let i = 0; i < newItems.length; i += chunkSize) {
      const chunk = newItems.slice(i, i + chunkSize);
      const values = chunk.map((item, idx) => {
        const base = idx * 4;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      }).join(', ');
      const params = chunk.flatMap(item => [item.russian_word, item.english_definition, item.notes || null, userId]);
      await db.query(
        `INSERT INTO vocabulary_items (russian_word, english_definition, notes, user_id)
         VALUES ${values}
         ON CONFLICT DO NOTHING`,
        params
      );
      imported += chunk.length;
    }

    res.json({
      message: 'Import successful',
      imported,
      duplicates: items.length - newItems.length,
      total: items.length,
    });
  } catch (err) {
    next(err);
  }
}

async function getVocabulary(req, res, next) {
  const userId = req.user.userId;
  const { phase, limit = 50, offset = 0, search } = req.query;

  try {
    let queryStr = 'SELECT * FROM vocabulary_items WHERE user_id = $1';
    const params = [userId];

    if (phase) {
      params.push(phase);
      queryStr += ` AND current_phase = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      queryStr += ` AND (russian_word ILIKE $${params.length} OR english_definition ILIKE $${params.length})`;
    }

    queryStr += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(queryStr, params);

    const countResult = await db.query(
      'SELECT COUNT(*) FROM vocabulary_items WHERE user_id = $1' + (phase ? ' AND current_phase = $2' : ''),
      phase ? [userId, phase] : [userId]
    );

    res.json({ words: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    next(err);
  }
}

async function getPhaseWords(req, res, next) {
  const userId = req.user.userId;
  const { phase } = req.params;
  const { limit = 20 } = req.query;

  try {
    const result = await db.query(
      `SELECT * FROM vocabulary_items
       WHERE user_id = $1 AND current_phase = $2
       AND (next_review_date IS NULL OR next_review_date <= CURRENT_DATE)
       ORDER BY next_review_date ASC NULLS FIRST, times_practiced ASC
       LIMIT $3`,
      [userId, phase, limit]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function getWordById(req, res, next) {
  try {
    const result = await db.query(
      'SELECT * FROM vocabulary_items WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Word not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateWord(req, res, next) {
  const { current_phase, notes, pronunciation_accuracy, usage_accuracy } = req.body;
  try {
    const result = await db.query(
      `UPDATE vocabulary_items SET
        current_phase = COALESCE($1, current_phase),
        notes = COALESCE($2, notes),
        pronunciation_accuracy = COALESCE($3, pronunciation_accuracy),
        usage_accuracy = COALESCE($4, usage_accuracy),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [current_phase, notes, pronunciation_accuracy, usage_accuracy, req.params.id, req.user.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Word not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deleteWord(req, res, next) {
  try {
    const result = await db.query('DELETE FROM vocabulary_items WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Word not found' });
    res.json({ message: 'Word deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { importVocabulary, getVocabulary, getWordById, updateWord, deleteWord, getPhaseWords };
