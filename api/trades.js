'use strict';

const { openTrades, closedTrades } = require('../scripts/utils/trade-store');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const open   = openTrades();
    const closed = closedTrades(50);
    return res.status(200).json({
      open,
      closed,
      total: { open: open.length, closed: closed.length },
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
