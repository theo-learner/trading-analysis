'use strict';

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    return res.status(200).json(require('../scripts/config/ict-engine.json'));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
