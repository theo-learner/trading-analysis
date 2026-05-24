'use strict';
const cfg = require('./config/trader.json');
const { getExchange } = require('./exchanges/index');
const ex = getExchange('bybit', cfg);

async function main() {
  const pairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'HYPEUSDT', 'ZECUSDT', 'MORPHOUSDT'];
  console.log('═══ 테스트 포지션 정리 시작 ═══\n');

  for (const pair of pairs) {
    const pos = await ex.getPosition(pair);
    if (pos.size > 0) {
      console.log(`Closing ${pair}: qty=${pos.size} entry=$${pos.entryPrice} side=${pos.side}`);
      try {
        await ex.closePosition(pair, pos.side);
        console.log(`  ✅ Closed`);
      } catch (e) {
        console.log(`  ❌ Error: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Verify all closed
  console.log('\n═══ 최종 확인 ═══\n');
  for (const pair of pairs) {
    const pos = await ex.getPosition(pair);
    if (pos.size > 0) {
      console.log(`⚠️  ${pair}: STILL OPEN qty=${pos.size}`);
    } else {
      console.log(`✅ ${pair}: Closed`);
    }
  }
}

main().catch(e => console.error('Fatal:', e.message));
