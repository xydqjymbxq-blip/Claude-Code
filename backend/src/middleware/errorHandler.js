function errorHandler(err, req, res, next) {
  console.error(err.stack);

  if (err.type === 'validation') {
    return res.status(400).json({ error: err.message });
  }

  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}

module.exports = { errorHandler };
