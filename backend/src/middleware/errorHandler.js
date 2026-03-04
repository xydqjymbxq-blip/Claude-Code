function errorHandler(err, req, res, next) {
  console.error(err.stack);

  if (err.type === 'validation') {
    return res.status(400).json({ error: err.message });
  }

  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }

  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { errorHandler };
