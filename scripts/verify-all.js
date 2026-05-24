'use strict';
const cfg = require('./config/trader.json');
const { getExchange } = require('./exchanges/index');
const ex = getExchange('bybit', cfg);

async function main() {
  const pairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'HYPEUSDT', 'ZECUSDT', 'MORPHOUSDT'];
  console.log('═══ 현재 오픈 포지션 확인 ═══\n');

  for (const pair of pairs) {
    const pos = await ex.getPosition(pair);
    if (pos.size > 0) {
      console.log('✅ ' + pair + ': entry=$' + pos.entryPrice + ' qty=' + pos.size + ' SL=' + pos.stopLoss + ' TP=' + pos.takeProfit);
    } else {
      console.log('❌ ' + pair + ': No position');
    }
  }

  // Check stop orders per pair
  console.log('\n═══ Stop Orders 확인 ═══\n');
  for (const pair of pairs) {
    const so = await ex._request('GET', '/v5/order/realtime', {
      category: 'linear', symbol: pair, orderFilter: 'StopOrder'
    }, true);
    const list = so.list || [];
    if (list.length > 0) {
      console.log('📋 ' + pair + ' — ' + list.length + ' orders:');
      for (const o of list) {
        console.log('    qty=' + o.qty + ' trigger=' + o.triggerPrice + ' side=' + o.side + ' status=' + o.orderStatus);
      }
    }
  }
}

main().catch(e => console.error('Error:', e.message));
