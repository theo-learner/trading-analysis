'use strict';

const { loadPairs } = require('../scripts/utils/pair-config');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  return res.status(200).json({ pairs: loadPairs() });
};
