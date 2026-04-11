// reports/20260410_dashboard.jsx — 2026-04-10 멀티페어 기술적 분석 대시보드
const { useState } = React;

// ─── 색상 팔레트 ──────────────────────────────────────────────────
const C = {
  bg: '#0b0e14',
  panel: '#131720',
  card: '#1a1f2e',
  border: '#2a2f3e',
  text: '#e8eaed',
  sub: '#9ca3af',
  bull: '#4ade80',
  bear: '#f87171',
  neutral: '#fbbf24',
  heat: '#f59e0b',
  cvdP: '#22d3ee',
  cvdN: '#fb923c',
  conv: '#a78bfa',
  blue: '#60a5fa',
  indigo: '#818cf8',
};

// ─── 분석 데이터 ──────────────────────────────────────────────────
const PAIRS = ['BTC', 'ETH', 'SOL', 'HYPE'];

const market = {
  BTC: {
    full: 'BTCUSDT',
    price: '~$83,000',
    change: -1.2,
    bias: 'bear',
    biasLabel: '약세',
    confidence: 50,
    summary: '1D 하락추세 지속. $74k 저점 반등 중 Wave B 구간. $88k OB 상방 돌파 여부가 핵심.',
    ew: {
      htf: 'Intermediate — ABC 베어 조정',
      count: 'Wave B 반등 진행 중',
      narrative: [
        'ATH $109,000 (2026-01) 이후 5파동 임펄스 하락 또는 ABC 조정 진행.',
        'Wave A: $109,000 → $74,000 (3/19 FOMC 급락 포함). 대형 하방 임펄스.',
        '현재 Wave B 반등 중: $74,000 → $88,000 목표 구간 테스트 예상.',
        'Wave C 시나리오: $55,000~$65,000 (Wave A 길이의 0.618~1.0 배)',
        '대안 카운트: Wave 4 조정 (Wave 5 상방 재개 가능) — $90,000 이상 회복 시 재검토.',
      ],
      invalidation: 'Wave B 무효: $74,000 이탈. Wave C 무효: $90,000 일봉 종가 돌파.',
      keyLevels: [
        { label: 'Wave A 저점', price: '$74,000', type: 'support' },
        { label: 'Wave B 목표 (OB)', price: '$88,000', type: 'resistance' },
        { label: 'Wave C 1차 목표', price: '$65,000', type: 'target' },
        { label: 'Wave C 2차 목표', price: '$55,000', type: 'target' },
      ],
    },
    ict: {
      structure: 'BOS 하방 연속 확인 / CHoCH 미발생 (상방 전환 미확인)',
      pdArray: [
        { name: '공급 OB (1D)', zone: '$88,000 ~ $92,000', type: 'supply', note: '3/19 FOMC 낙하 시작 기점. 강한 거부 예상.' },
        { name: '수요 OB (1D)', zone: '$74,000 ~ $76,000', type: 'demand', note: '최근 저점 형성 구간. BSL 스윕 완료 흔적.' },
        { name: 'FVG (미충전)', zone: '$84,500 ~ $87,000', type: 'fvg', note: '4H 미충전 공정가치 갭. 단기 반등 목표.' },
      ],
      liquidity: [
        { label: '$74,000 BSL', status: '스윕 완료', color: C.bull },
        { label: '$65,000 하방 유동성', status: '미스윕 (잠재 타깃)', color: C.bear },
        { label: '$88,000~$90,000 SSL', status: '상방 유동성 풀 (매집 가능)', color: C.neutral },
      ],
      premium: 'Discount Zone (Equilibrium: ~$91,500 기준 하방)',
    },
    vrvp: {
      poc: '$85,000',
      vaH: '$92,000',
      vaL: '$74,000',
      position: '현재가 POC 하방',
      note: 'POC $85k 기준 현재가 하방 = 상방에 대형 저항 볼륨 집중. $74k~$80k 구간 볼륨 얇음 = 지지 취약. 하방 이탈 시 $65k까지 진공.',
    },
    indicators: {
      rsi: { '1D': { val: 42, signal: 'Bull 다이버전스 진행' }, '4H': { val: 62, signal: '중립-과열' }, '1H': { val: 67, signal: '단기 과열' } },
      cci: { '1D': { val: -43, signal: '회복 중' }, '4H': { val: -18, signal: '중립' }, '1H': { val: 227, signal: '단기 과매수' } },
      ma: '역배열 (가격 < BB20 < EMA50 < EMA200)',
      bb: '1D: 하단밴드 내부 복귀 시도 / 1H: 상단밴드 접근 중',
    },
    scenarios: [
      {
        type: 'bull', prob: 30, label: '단기 반등 지속',
        desc: '$80,000 지지 유지 → $84,500 FVG 충전 → $88,000 OB 테스트',
        trigger: '$84,500 4H 종가 돌파',
        entry: '$82,000 ~ $83,500', sl: '$79,500', tp1: '$88,000', tp2: '$92,000', rr: '1 : 2.5',
      },
      {
        type: 'bear', prob: 50, label: 'Wave C 하락 개시',
        desc: '$88,000 OB 반락 → $74,000 재테스트 → $65,000 Wave C 목표',
        trigger: '$80,000 일봉 종가 붕괴',
        entry: '$87,500 ~ $88,500 숏', sl: '$91,000', tp1: '$74,000', tp2: '$65,000', rr: '1 : 3.0',
      },
      {
        type: 'neutral', prob: 20, label: '박스권 횡보',
        desc: '$74,000 ~ $88,000 범위 내 조정 지속',
        trigger: '매크로 불확실성 / 거래량 수축',
        entry: '관망', sl: '-', tp1: '-', tp2: '-', rr: '-',
      },
    ],
    notes: [
      '3/19 FOMC 급락 → $74k 지지. 차트 주석 "여기 3번째 발을 때 주세보고 롱 진입" 표기.',
      '1H CCI 227 단기 과매수 → 즉각 롱 추격 자제.',
      'RSI 1D Bull 다이버전스 형성 중 (RSI HL, 가격 LL).',
      'VRVP 상방 대형 노드 = $88k OB 강한 저항 수렴.',
    ],
  },

  ETH: {
    full: 'ETHUSDT',
    price: '~$1,590',
    change: -2.1,
    bias: 'strong-bear',
    biasLabel: '강한 약세',
    confidence: 65,
    summary: '전 페어 중 최약체. BTC 대비 극심한 상대약세. Wave C 또는 Wave 5 마무리 구간. VRVP 하방 볼륨 공백.',
    ew: {
      htf: 'Intermediate — 5파 또는 C파 연장',
      count: 'Wave 5 / C파 마무리 단계',
      narrative: [
        'ATH $4,100 이후 강한 하락 구조. ETH/BTC 비율 다년 최저점 = 알트 약세 구조.',
        '3파 하락 (ABC) 가능: A: $4,100→$2,100, B: $2,100→$2,800, C: 진행 중.',
        '5파 하락 가능: 현재 Wave 5 연장 → $1,200~$1,400 목표.',
        'RSI 1D Bull 시그널 표기 있으나 가격 계속 하락 = 약한 다이버전스.',
        '$1,500~$1,600 구간 = 2020년 초 주요 지지 구간. 반등 기반 가능.',
      ],
      invalidation: '$2,100 일봉 종가 회복 시 카운트 전면 재검토.',
      keyLevels: [
        { label: '최근 저점', price: '$1,380', type: 'support' },
        { label: '미충전 FVG', price: '$1,720 ~ $1,850', type: 'fvg' },
        { label: '대형 공급 OB', price: '$2,100 ~ $2,400', type: 'resistance' },
        { label: 'C파 목표', price: '$1,200 ~ $1,300', type: 'target' },
      ],
    },
    ict: {
      structure: '강력 BOS 하방 연속 / 반등 모두 Lower High 형성 중',
      pdArray: [
        { name: '대형 공급 OB (1D)', zone: '$2,100 ~ $2,400', type: 'supply', note: '2025년 고점 영역 대형 공급 블록.' },
        { name: '수요 OB (4H)', zone: '$1,380 ~ $1,420', type: 'demand', note: '최근 반등 기점. 재테스트 시 중요 구간.' },
        { name: 'FVG (1D)', zone: '$1,720 ~ $1,850', type: 'fvg', note: '최근 급락에서 생성된 미충전 갭.' },
      ],
      liquidity: [
        { label: '$1,380 저점 유동성', status: '접근 중 (스윕 예정)', color: C.bear },
        { label: '$1,200 하방 유동성', status: '미스윕 (최종 타깃)', color: C.bear },
        { label: '$1,720~$1,850 SSL', status: '상방 유동성 풀', color: C.neutral },
      ],
      premium: 'Extreme Discount Zone',
    },
    vrvp: {
      poc: '$2,400',
      vaH: '$3,200',
      vaL: '$1,380',
      position: '현재가 분포 최하단',
      note: 'POC $2,400 대비 현재가 $1,590 = 대형 저항 완전 상방. 현재가 아래 볼륨 거의 없음 = 지지 취약. $1,380 이탈 시 $1,200까지 진공 상태.',
    },
    indicators: {
      rsi: { '1D': { val: 41, signal: 'Bull 신호 (약한 다이버전스)' }, '4H': { val: 47, signal: '중립' }, '1H': { val: 68, signal: '단기 과열' } },
      cci: { '1D': { val: -46, signal: '회복 중' }, '4H': { val: -22, signal: '음수' }, '1H': { val: -178, signal: '음수 (RSI와 괴리)' } },
      ma: '전 타임프레임 역배열. 모든 MA 하향 기울기.',
      bb: '1D: 하단밴드 지속 압박 / 1H: RSI 상승 vs CCI 음수 = 신호 분열',
    },
    scenarios: [
      {
        type: 'bull', prob: 20, label: '단기 반등',
        desc: '$1,500 지지 확인 → $1,720 FVG 충전 → $2,100 OB 테스트',
        trigger: '$1,720 4H 종가 돌파',
        entry: '$1,570 ~ $1,600', sl: '$1,480', tp1: '$1,720', tp2: '$1,850', rr: '1 : 1.8',
      },
      {
        type: 'bear', prob: 60, label: 'Wave C/5 하락',
        desc: '$1,500 붕괴 → $1,380 재테스트 → $1,200~$1,300',
        trigger: '$1,500 일봉 종가 붕괴',
        entry: '$1,700 ~ $1,720 숏', sl: '$1,850', tp1: '$1,380', tp2: '$1,200', rr: '1 : 2.5',
      },
      {
        type: 'neutral', prob: 20, label: '박스권',
        desc: '$1,380 ~ $1,720 범위 횡보',
        trigger: 'BTC 방향성 대기',
        entry: '관망', sl: '-', tp1: '-', tp2: '-', rr: '-',
      },
    ],
    notes: [
      'ETH/BTC 비율 다년 최저점 → BTC 회복해도 ETH 상대 약세 지속 가능.',
      '1H RSI 68 상승 vs CCI -178 음수 = 신뢰도 낮은 단기 반등 신호.',
      'VRVP 하방 볼륨 공백 = 구조적 지지 부재.',
      '$1,500 지지선이 단기 생존 분기점.',
    ],
  },

  SOL: {
    full: 'SOLUSDT',
    price: '~$118',
    change: -0.8,
    bias: 'bear',
    biasLabel: '약세',
    confidence: 50,
    summary: 'ATH $295 이후 강한 하락. $95~$100 강한 지지 OB. 4H RSI 중립 = 방향성 대기 중. BTC 방향이 결정적.',
    ew: {
      htf: 'Minor — ABC 조정 C파 마무리',
      count: 'Wave 5 하락 또는 C파 종료 근접',
      narrative: [
        'ATH $295 (2024-11) 이후 강한 하락 5파 or ABC 진행.',
        '현재 $115~$120 구간 = 잠재 반전 구간 (RSI 과매도 회복 신호).',
        '$95~$100 구간 = 2024년 주요 지지 + 강한 수요 OB → 최종 지지.',
        '조기 반등 시 Wave 4 성격 반등: 목표 $130~$145 OB 구간.',
        '종료 후 Wave 5 상승 재개 가능 (BTC 동반 필수).',
      ],
      invalidation: '$90,000 이탈 시 추가 하락 (Wave 연장). $130 4H 돌파 시 반전 확인.',
      keyLevels: [
        { label: '수요 OB (강한 지지)', price: '$95 ~ $100', type: 'support' },
        { label: '현재가 지지', price: '$112 ~ $115', type: 'support' },
        { label: 'FVG (미충전)', price: '$125 ~ $130', type: 'fvg' },
        { label: '공급 OB', price: '$130 ~ $145', type: 'resistance' },
      ],
    },
    ict: {
      structure: 'BOS 하방 지속 / $130 이상 CHoCH 없음 = 상방 전환 미확인',
      pdArray: [
        { name: '공급 OB (4H × 다수)', zone: '$130 ~ $145', type: 'supply', note: '전 고점 구간 복수 공급 블록 형성.' },
        { name: '수요 OB (1D)', zone: '$95 ~ $100', type: 'demand', note: '2024년 브레이크아웃 기점 = 강한 수요 구조.' },
        { name: 'FVG (4H)', zone: '$125 ~ $130', type: 'fvg', note: '급락 과정에서 생성된 미충전 갭.' },
      ],
      liquidity: [
        { label: '$95~$100 유동성', status: '타깃 미도달 (스윕 가능성)', color: C.bear },
        { label: '$88 하방 유동성', status: '극단적 시나리오', color: C.bear },
        { label: '$130~$145 상방 SSL', status: '반등 목표', color: C.neutral },
      ],
      premium: 'Extreme Discount Zone',
    },
    vrvp: {
      poc: '~$135',
      vaH: '$160',
      vaL: '$95',
      position: '현재가 POC 하방',
      note: 'POC $135 기준 현재가 $118 = 저항 상방. $95~$100 구간 볼륨 집중 = 강한 지지. 현재가 아래 볼륨 점차 감소.',
    },
    indicators: {
      rsi: { '1D': { val: 38, signal: '과매도 근접' }, '4H': { val: 52, signal: '중립 (방향성 대기)' }, '1H': { val: 68, signal: '단기 과열' } },
      cci: { '1D': { val: -50, signal: '과매도' }, '4H': { val: -35, signal: '음수' }, '1H': { val: -178, signal: '음수 (RSI 괴리)' } },
      ma: '전 타임프레임 역배열. 1H만 단기 반등.',
      bb: '1D: 하단밴드 반복 터치 / 4H: 중앙밴드 하방',
    },
    scenarios: [
      {
        type: 'bull', prob: 35, label: '단기 반등',
        desc: '$115 지지 유지 → $130 FVG/OB 테스트 → $145',
        trigger: '$125 4H 종가 돌파',
        entry: '$115 ~ $118', sl: '$110', tp1: '$130', tp2: '$145', rr: '1 : 2.0',
      },
      {
        type: 'bear', prob: 45, label: '추가 하락',
        desc: '$115 붕괴 → $95~$100 수요 OB 테스트',
        trigger: '$112 일봉 종가 붕괴',
        entry: '$128 ~ $130 숏', sl: '$135', tp1: '$100', tp2: '$88', rr: '1 : 2.8',
      },
      {
        type: 'neutral', prob: 20, label: '횡보',
        desc: '$100 ~ $130 박스권 압축',
        trigger: '거래량 감소 / BTC 횡보',
        entry: '관망', sl: '-', tp1: '-', tp2: '-', rr: '-',
      },
    ],
    notes: [
      '$95~$100 = 강한 수요 OB + RSI 극과매도 = 잠재 주요 반전 구간.',
      '4H RSI 52 중립 → 아직 방향 미결정. BTC 방향 추종.',
      '1H CCI -178 + RSI 68 = 단기 반등 신뢰도 낮음. 확인 후 진입.',
      'ETH 약세와 달리 SOL은 $95~$100 OB 도달 시 반등 기회 존재.',
    ],
  },

  HYPE: {
    full: 'HYPEUSDT',
    price: '~$31,500',
    change: 4.2,
    bias: 'bull',
    biasLabel: '강세',
    confidence: 60,
    summary: '전 페어 대비 뚜렷한 상대강도. 4H BB 하단밴드 상향 전환. RSI 강한 모멘텀. 조정 완료 후 임펄스 초입 가능성.',
    ew: {
      htf: 'Minor — Wave 3 진행 (조정 완료 후 임펄스)',
      count: 'Wave 3 진행 중 (또는 연장 Wave 1)',
      narrative: [
        '타 페어 대비 구조적 강세. 차트상 사용자 직접 표기 EW 레이블 다수 확인.',
        'Wave 1: $10,000대 → $40,000+. Wave 2: 조정 완료 (~$24,000 저점).',
        'Wave 3 진행 중: 목표 $42,000~$45,000 (Wave 1 길이의 1.618배).',
        '4H BB 하단밴드 상향 전환 = 추세 강화 핵심 시그널.',
        '1H RSI 74 모멘텀 유효. 단기 조정 후 재진입 기회 가능.',
      ],
      invalidation: '$27,000 이탈 시 Wave 4가 Wave 1 구간 침범 = 카운트 무효.',
      keyLevels: [
        { label: 'Wave 2 저점', price: '~$24,000', type: 'support' },
        { label: '수요 OB', price: '$27,000 ~ $30,000', type: 'support' },
        { label: '근접 FVG', price: '$35,000 ~ $37,000', type: 'fvg' },
        { label: 'Wave 3 목표', price: '$42,000 ~ $45,000', type: 'target' },
      ],
    },
    ict: {
      structure: 'CHoCH 상방 전환 확인 / 상승 BOS 진행 중',
      pdArray: [
        { name: '공급 OB (4H)', zone: '$38,000 ~ $42,000', type: 'supply', note: '기존 고점 구간 공급 블록. 최종 저항.' },
        { name: '수요 OB (4H)', zone: '$27,000 ~ $30,000', type: 'demand', note: '최근 CHoCH 발생 기점. 강한 수요 구조.' },
        { name: 'FVG (1H)', zone: '$35,000 ~ $37,000', type: 'fvg', note: '상승 과정 생성 미충전 갭. 조정 시 충전 가능.' },
      ],
      liquidity: [
        { label: '하방 유동성', status: '다수 스윕 완료 (청정)', color: C.bull },
        { label: '$42k~$45k SSL', status: '상방 유동성 타깃', color: C.bull },
        { label: '$50,000+ BSL', status: '장기 유동성 풀', color: C.neutral },
      ],
      premium: '중립 → Premium Zone 진입 직전',
    },
    vrvp: {
      poc: '~$32,000',
      vaH: '$38,000',
      vaL: '$27,000',
      position: '현재가 POC 근접 상방',
      note: '1H POC 현재가 근접. 상방 볼륨 얇음 = 추가 상승 저항 약함. $27k~$30k 수요 OB 볼륨 집중 = 강한 지지.',
    },
    indicators: {
      rsi: { '1D': { val: 68, signal: '강세 모멘텀' }, '4H': { val: 75, signal: '과매수 주의' }, '1H': { val: 74, signal: '강한 모멘텀' } },
      cci: { '1D': { val: 45, signal: '양수 회복' }, '4H': { val: 30, signal: '양수' }, '1H': { val: 120, signal: '강세' } },
      ma: '4H-1H 정배열 전환 확인. 1D 회복 진행 중.',
      bb: '4H: 하단밴드 상향 전환 (핵심 시그널) / 1H: 상단밴드 접촉 중',
    },
    scenarios: [
      {
        type: 'bull', prob: 60, label: '임펄스 Wave 3 지속',
        desc: '$30k 지지 유지 → $35k FVG 충전 → $38~42k OB 테스트',
        trigger: '$36,000 4H 종가 돌파',
        entry: '$30,000 ~ $32,000', sl: '$28,500', tp1: '$38,000', tp2: '$42,000', rr: '1 : 2.5',
      },
      {
        type: 'bear', prob: 25, label: '과매수 조정',
        desc: 'RSI 75+ 과매수 반락 → $27,000~$28,000 조정 지지',
        trigger: '$30,000 일봉 종가 붕괴',
        entry: '$37,000 ~ $38,000 숏', sl: '$40,000', tp1: '$30,000', tp2: '$27,000', rr: '1 : 2.0',
      },
      {
        type: 'neutral', prob: 15, label: '압축 횡보',
        desc: '$30,000 ~ $36,000 삼각형 수렴',
        trigger: '거래량 수축 / 시장 리더십 약화',
        entry: '관망', sl: '-', tp1: '-', tp2: '-', rr: '-',
      },
    ],
    notes: [
      '전 페어 대비 상대강도 1위 → 시장 주도 자산.',
      '4H BB 하단밴드 상향 전환 = 추세 반전 강력 시그널.',
      'RSI 4H 75 과매수 → 즉각 고점 매수보다 $30k~$32k 조정 후 진입 선호.',
      'BTC 약세 환경에서도 강세 유지 = 독립적 매집 세력 존재 가능성.',
    ],
  },
};

// ─── 공통 컴포넌트 ────────────────────────────────────────────────

function Badge({ type, children }) {
  const colors = {
    bull: { bg: '#14532d', color: C.bull, border: '#166534' },
    'strong-bull': { bg: '#14532d', color: C.bull, border: '#166534' },
    bear: { bg: '#450a0a', color: C.bear, border: '#7f1d1d' },
    'strong-bear': { bg: '#3b0000', color: '#fca5a5', border: '#7f1d1d' },
    neutral: { bg: '#422006', color: C.neutral, border: '#78350f' },
    supply: { bg: '#450a0a', color: C.bear, border: '#7f1d1d' },
    demand: { bg: '#14532d', color: C.bull, border: '#166534' },
    fvg: { bg: '#1e1b4b', color: C.indigo, border: '#3730a3' },
    target: { bg: '#1e1f5e', color: C.blue, border: '#1d4ed8' },
    support: { bg: '#14532d', color: C.bull, border: '#166534' },
    resistance: { bg: '#450a0a', color: C.bear, border: '#7f1d1d' },
  };
  const s = colors[type] || colors.neutral;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
      fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px',
      backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {children}
    </span>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      backgroundColor: C.card, border: `1px solid ${C.border}`,
      borderRadius: '8px', padding: '16px', ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, color }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px',
      textTransform: 'uppercase', color: color || C.sub,
      marginBottom: '12px', paddingBottom: '8px',
      borderBottom: `1px solid ${C.border}`,
    }}>
      {children}
    </div>
  );
}

function RsiBar({ label, val, signal }) {
  const color = val >= 70 ? C.bear : val <= 30 ? C.bull : val >= 55 ? C.neutral : C.sub;
  const pct = Math.min(100, Math.max(0, val));
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: C.sub, fontSize: '12px' }}>{label}</span>
        <span style={{ color, fontSize: '12px', fontWeight: 600 }}>{val} — {signal}</span>
      </div>
      <div style={{ height: '4px', backgroundColor: C.border, borderRadius: '2px' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '2px' }} />
      </div>
    </div>
  );
}

function ProbBar({ type, prob, label }) {
  const color = type === 'bull' ? C.bull : type === 'bear' ? C.bear : C.neutral;
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ color, fontSize: '12px', fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontSize: '12px', fontWeight: 700 }}>{prob}%</span>
      </div>
      <div style={{ height: '6px', backgroundColor: C.border, borderRadius: '3px' }}>
        <div style={{ width: `${prob}%`, height: '100%', backgroundColor: color, borderRadius: '3px', opacity: 0.85 }} />
      </div>
    </div>
  );
}

// ─── 탭 컨텐츠 ───────────────────────────────────────────────────

function OverviewTab({ pairKey, d }) {
  const bias = d.bias;
  const biasColor = bias === 'bull' || bias === 'strong-bull' ? C.bull :
                    bias === 'bear' || bias === 'strong-bear' ? C.bear : C.neutral;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      {/* 가격 & 바이어스 */}
      <Card style={{ gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: C.sub, fontSize: '11px', marginBottom: '2px' }}>현재가 (차트 기준)</div>
            <div style={{ color: C.text, fontSize: '28px', fontWeight: 700, fontFamily: 'monospace' }}>{d.price}</div>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '6px',
            padding: '12px 16px', borderRadius: '8px',
            backgroundColor: bias.includes('bear') ? '#1a0a0a' : bias === 'bull' ? '#0a1a0a' : '#1a1500',
            border: `1px solid ${biasColor}33`,
          }}>
            <div style={{ color: C.sub, fontSize: '11px' }}>종합 바이어스</div>
            <div style={{ color: biasColor, fontSize: '20px', fontWeight: 700 }}>{d.biasLabel}</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{
                  width: '10px', height: '10px', borderRadius: '2px',
                  backgroundColor: i < d.confidence / 10 ? biasColor : C.border,
                  opacity: i < d.confidence / 10 ? 0.8 : 1,
                }} />
              ))}
            </div>
            <div style={{ color: C.sub, fontSize: '11px' }}>확신도 {d.confidence}%</div>
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ color: C.sub, fontSize: '11px', marginBottom: '6px' }}>종합 요약</div>
            <div style={{ color: C.text, fontSize: '13px', lineHeight: '1.6' }}>{d.summary}</div>
          </div>
        </div>
      </Card>

      {/* 핵심 레벨 */}
      <Card>
        <SectionTitle>핵심 가격 레벨</SectionTitle>
        {d.ew.keyLevels.map((lv, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 0', borderBottom: i < d.ew.keyLevels.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <span style={{ color: C.sub, fontSize: '12px' }}>{lv.label}</span>
            <Badge type={lv.type}>{lv.price}</Badge>
          </div>
        ))}
      </Card>

      {/* VRVP */}
      <Card>
        <SectionTitle>볼륨 프로파일 (VRVP)</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          {[
            { label: 'VA High', val: d.vrvp.vaH, color: C.bear },
            { label: 'POC', val: d.vrvp.poc, color: C.neutral },
            { label: 'VA Low', val: d.vrvp.vaL, color: C.bull },
          ].map((item, i) => (
            <div key={i} style={{
              textAlign: 'center', padding: '8px',
              backgroundColor: C.panel, borderRadius: '6px',
              border: `1px solid ${item.color}33`,
            }}>
              <div style={{ color: C.sub, fontSize: '10px', marginBottom: '3px' }}>{item.label}</div>
              <div style={{ color: item.color, fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>{item.val}</div>
            </div>
          ))}
        </div>
        <div style={{ color: C.sub, fontSize: '11px' }}>현재가 위치: <span style={{ color: C.neutral }}>{d.vrvp.position}</span></div>
        <div style={{ color: C.sub, fontSize: '11px', marginTop: '6px', lineHeight: '1.5' }}>{d.vrvp.note}</div>
      </Card>

      {/* 지표 */}
      <Card>
        <SectionTitle>지표 요약</SectionTitle>
        {Object.entries(d.indicators.rsi).map(([tf, { val, signal }]) => (
          <RsiBar key={tf} label={`RSI ${tf}`} val={val} signal={signal} />
        ))}
        <div style={{ marginTop: '10px', padding: '8px', backgroundColor: C.panel, borderRadius: '6px' }}>
          <div style={{ color: C.sub, fontSize: '11px', marginBottom: '4px' }}>MA 구조</div>
          <div style={{ color: C.text, fontSize: '12px' }}>{d.indicators.ma}</div>
        </div>
        <div style={{ marginTop: '8px', padding: '8px', backgroundColor: C.panel, borderRadius: '6px' }}>
          <div style={{ color: C.sub, fontSize: '11px', marginBottom: '4px' }}>볼린저밴드</div>
          <div style={{ color: C.text, fontSize: '12px' }}>{d.indicators.bb}</div>
        </div>
      </Card>

      {/* 시나리오 확률 */}
      <Card>
        <SectionTitle>시나리오 확률</SectionTitle>
        {d.scenarios.map((s, i) => (
          <ProbBar key={i} type={s.type} prob={s.prob} label={s.label} />
        ))}
      </Card>

      {/* 주요 관찰 */}
      <Card style={{ gridColumn: '1 / -1' }}>
        <SectionTitle>주요 관찰 포인트</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {d.notes.map((note, i) => (
            <div key={i} style={{
              display: 'flex', gap: '8px', padding: '8px',
              backgroundColor: C.panel, borderRadius: '6px',
            }}>
              <span style={{ color: C.conv, fontSize: '14px', flexShrink: 0 }}>▸</span>
              <span style={{ color: C.text, fontSize: '12px', lineHeight: '1.5' }}>{note}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function EWTab({ d }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <Card style={{ gridColumn: '1 / -1' }}>
        <SectionTitle color={C.conv}>엘리엇 웨이브 구조</SectionTitle>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ padding: '8px 16px', backgroundColor: C.panel, borderRadius: '6px', border: `1px solid ${C.conv}44` }}>
            <div style={{ color: C.sub, fontSize: '11px' }}>HTF 구조</div>
            <div style={{ color: C.conv, fontSize: '14px', fontWeight: 600 }}>{d.ew.htf}</div>
          </div>
          <div style={{ padding: '8px 16px', backgroundColor: C.panel, borderRadius: '6px', border: `1px solid ${C.conv}44` }}>
            <div style={{ color: C.sub, fontSize: '11px' }}>현재 카운트</div>
            <div style={{ color: C.text, fontSize: '14px', fontWeight: 600 }}>{d.ew.count}</div>
          </div>
        </div>
        {d.ew.narrative.map((line, i) => (
          <div key={i} style={{
            display: 'flex', gap: '8px', padding: '8px 0',
            borderBottom: i < d.ew.narrative.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <span style={{ color: C.conv, fontWeight: 700, minWidth: '20px' }}>{i + 1}.</span>
            <span style={{ color: C.text, fontSize: '13px', lineHeight: '1.6' }}>{line}</span>
          </div>
        ))}
      </Card>

      <Card>
        <SectionTitle>무효화 조건</SectionTitle>
        <div style={{
          padding: '12px', backgroundColor: '#2d0a0a', borderRadius: '6px',
          border: `1px solid ${C.bear}44`,
        }}>
          <div style={{ color: C.bear, fontSize: '12px', lineHeight: '1.7' }}>{d.ew.invalidation}</div>
        </div>
      </Card>

      <Card>
        <SectionTitle>웨이브 레벨</SectionTitle>
        {d.ew.keyLevels.map((lv, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderBottom: i < d.ew.keyLevels.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <span style={{ color: C.sub, fontSize: '12px' }}>{lv.label}</span>
            <Badge type={lv.type}>{lv.price}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}

function ICTTab({ d }) {
  const typeColor = { supply: C.bear, demand: C.bull, fvg: C.indigo };
  const typeLabel = { supply: '공급 OB', demand: '수요 OB', fvg: 'FVG' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <Card style={{ gridColumn: '1 / -1' }}>
        <SectionTitle color={C.heat}>마켓 스트럭처</SectionTitle>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px', padding: '12px', backgroundColor: C.panel, borderRadius: '6px' }}>
            <div style={{ color: C.sub, fontSize: '11px', marginBottom: '4px' }}>구조 상태</div>
            <div style={{ color: C.text, fontSize: '13px' }}>{d.ict.structure}</div>
          </div>
          <div style={{ flex: 1, minWidth: '200px', padding: '12px', backgroundColor: C.panel, borderRadius: '6px' }}>
            <div style={{ color: C.sub, fontSize: '11px', marginBottom: '4px' }}>프리미엄 / 디스카운트</div>
            <div style={{ color: C.neutral, fontSize: '13px', fontWeight: 600 }}>{d.ict.premium}</div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>PD Array (오더블록 / FVG)</SectionTitle>
        {d.ict.pdArray.map((item, i) => (
          <div key={i} style={{
            padding: '10px', marginBottom: '8px',
            backgroundColor: C.panel, borderRadius: '6px',
            borderLeft: `3px solid ${typeColor[item.type] || C.sub}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: typeColor[item.type], fontSize: '11px', fontWeight: 700 }}>
                {typeLabel[item.type]}
              </span>
              <span style={{ color: C.text, fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{item.zone}</span>
            </div>
            <div style={{ color: C.sub, fontSize: '11px' }}>{item.note}</div>
          </div>
        ))}
      </Card>

      <Card>
        <SectionTitle>유동성 맵</SectionTitle>
        {d.ict.liquidity.map((liq, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px', marginBottom: '6px',
            backgroundColor: C.panel, borderRadius: '6px',
          }}>
            <span style={{ color: C.text, fontSize: '12px' }}>{liq.label}</span>
            <span style={{ color: liq.color, fontSize: '11px', fontWeight: 600 }}>{liq.status}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function OrderflowTab() {
  return (
    <Card>
      <SectionTitle color={C.cvdP}>오더플로우 데이터</SectionTitle>
      <div style={{
        padding: '24px', textAlign: 'center',
        backgroundColor: C.panel, borderRadius: '8px',
        border: `1px dashed ${C.border}`,
      }}>
        <div style={{ color: C.neutral, fontSize: '24px', marginBottom: '8px' }}>⚠</div>
        <div style={{ color: C.text, fontSize: '14px', marginBottom: '4px' }}>오더플로우 캡처 미실시</div>
        <div style={{ color: C.sub, fontSize: '12px', lineHeight: '1.6' }}>
          이번 세션은 <code style={{ color: C.cvdP }}>--tv-only</code> 옵션으로 실행되었습니다.<br />
          Coinglass 청산 히트맵, Coinalyze OI/펀딩비 데이터가 없습니다.<br /><br />
          전체 분석을 위해 다음을 실행하세요:<br />
          <code style={{ color: C.cvdP }}>node scripts/capture.js</code> (Coinglass + Coinalyze 포함)
        </div>
      </div>
      <div style={{ marginTop: '16px' }}>
        <SectionTitle>TradingView 기반 추론</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { label: 'BTC OI 추정', val: '횡보 → 단기 레버리지 청산 후 회복 중', color: C.neutral },
            { label: 'ETH 펀딩비 추정', val: '중립~약한 음수 (지속 매도 압력)', color: C.bear },
            { label: 'SOL OI 추정', val: '저점에서 OI 소폭 증가 = 신규 롱 진입 신호 가능', color: C.neutral },
            { label: 'HYPE 추정', val: '강한 양수 펀딩비 가능성 (강세 모멘텀)', color: C.bull },
          ].map((item, i) => (
            <div key={i} style={{ padding: '10px', backgroundColor: C.panel, borderRadius: '6px' }}>
              <div style={{ color: C.sub, fontSize: '11px', marginBottom: '4px' }}>{item.label}</div>
              <div style={{ color: item.color, fontSize: '12px' }}>{item.val}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ScenariosTab({ d }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {d.scenarios.map((s, i) => {
        const color = s.type === 'bull' ? C.bull : s.type === 'bear' ? C.bear : C.neutral;
        const bg = s.type === 'bull' ? '#0a1a0a' : s.type === 'bear' ? '#1a0a0a' : '#1a1500';
        return (
          <Card key={i} style={{ border: `1px solid ${color}44` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                backgroundColor: bg, border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color, fontSize: '18px', fontWeight: 700, flexShrink: 0,
              }}>{s.prob}%</div>
              <div>
                <div style={{ color, fontSize: '16px', fontWeight: 700 }}>{s.label}</div>
                <div style={{ color: C.sub, fontSize: '12px', marginTop: '2px' }}>
                  트리거: {s.trigger}
                </div>
              </div>
            </div>
            <div style={{
              padding: '10px', backgroundColor: bg, borderRadius: '6px',
              color: C.text, fontSize: '13px', lineHeight: '1.6', marginBottom: '12px',
            }}>
              {s.desc}
            </div>
            {s.entry !== '관망' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {[
                  { label: '진입', val: s.entry, color: C.text },
                  { label: '손절 (SL)', val: s.sl, color: C.bear },
                  { label: 'TP 1', val: s.tp1, color: C.bull },
                  { label: 'TP 2', val: s.tp2, color: C.bull },
                ].map((item, j) => (
                  <div key={j} style={{
                    padding: '8px', backgroundColor: C.panel, borderRadius: '6px', textAlign: 'center',
                  }}>
                    <div style={{ color: C.sub, fontSize: '10px', marginBottom: '2px' }}>{item.label}</div>
                    <div style={{ color: item.color, fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>{item.val}</div>
                  </div>
                ))}
              </div>
            )}
            {s.rr !== '-' && (
              <div style={{ marginTop: '8px', textAlign: 'right' }}>
                <span style={{ color: C.sub, fontSize: '11px' }}>R:R = </span>
                <span style={{ color: C.cvdP, fontSize: '13px', fontWeight: 700 }}>{s.rr}</span>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function RiskTab({ allData }) {
  const riskItems = [
    {
      pair: 'BTC', color: '#f7931a',
      longSetup: '$82,000~83,500 / SL $79,500 / TP $88k~$92k',
      shortSetup: '$87,500~88,500 / SL $91,000 / TP $74k~$65k',
      maxRisk: '포지션의 1~2%',
      note: '1H CCI 과매수 → 롱 즉각 진입 자제. $84.5k FVG 충전 확인 후 진입.',
    },
    {
      pair: 'ETH', color: '#627eea',
      longSetup: '$1,570~1,600 / SL $1,480 / TP $1,720~1,850',
      shortSetup: '$1,700~1,720 / SL $1,850 / TP $1,380~$1,200',
      maxRisk: '포지션의 0.5~1% (고위험 구간)',
      note: '강한 하락추세 내 롱은 극소 포지션. 숏 바이어스 유효.',
    },
    {
      pair: 'SOL', color: '#9945ff',
      longSetup: '$115~118 / SL $110 / TP $130~$145',
      shortSetup: '$128~130 / SL $135 / TP $100~$88',
      maxRisk: '포지션의 1~1.5%',
      note: '$95~$100 OB 도달 시 높은 R:R 롱 기회. 현재는 방향 대기.',
    },
    {
      pair: 'HYPE', color: '#22d3ee',
      longSetup: '$30,000~32,000 / SL $28,500 / TP $38k~$42k',
      shortSetup: '$37,000~38,000 / SL $40,000 / TP $30k~$27k',
      maxRisk: '포지션의 1.5~2%',
      note: '4 페어 중 유일한 강세. 조정 후 롱 우선 전략. $30k 지지 확인 필수.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Card style={{ border: `1px solid ${C.neutral}44` }}>
        <SectionTitle color={C.neutral}>리스크 관리 원칙</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            { title: '시장 구조', val: '전반적 약세 (BTC/ETH/SOL 하락추세)', color: C.bear },
            { title: '권장 포지션 크기', val: '통상의 50~70% 축소', color: C.neutral },
            { title: '시장 리더', val: 'HYPE — 상대강도 최강', color: C.bull },
          ].map((item, i) => (
            <div key={i} style={{ padding: '10px', backgroundColor: C.panel, borderRadius: '6px' }}>
              <div style={{ color: C.sub, fontSize: '11px', marginBottom: '4px' }}>{item.title}</div>
              <div style={{ color: item.color, fontSize: '13px', fontWeight: 600 }}>{item.val}</div>
            </div>
          ))}
        </div>
      </Card>

      {riskItems.map((item, i) => (
        <Card key={i}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              backgroundColor: `${item.color}22`, border: `1px solid ${item.color}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: item.color, fontSize: '13px', fontWeight: 700,
            }}>{item.pair}</div>
            <div style={{ color: C.text, fontSize: '15px', fontWeight: 600 }}>{item.pair}USDT 리스크 관리</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div style={{ padding: '10px', backgroundColor: '#0a1a0a', borderRadius: '6px', border: `1px solid ${C.bull}33` }}>
              <div style={{ color: C.bull, fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>롱 셋업</div>
              <div style={{ color: C.text, fontSize: '11px', fontFamily: 'monospace', lineHeight: '1.7' }}>{item.longSetup}</div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#1a0a0a', borderRadius: '6px', border: `1px solid ${C.bear}33` }}>
              <div style={{ color: C.bear, fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>숏 셋업</div>
              <div style={{ color: C.text, fontSize: '11px', fontFamily: 'monospace', lineHeight: '1.7' }}>{item.shortSetup}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, padding: '8px', backgroundColor: C.panel, borderRadius: '6px' }}>
              <span style={{ color: C.sub, fontSize: '11px' }}>최대 리스크: </span>
              <span style={{ color: C.neutral, fontSize: '11px', fontWeight: 600 }}>{item.maxRisk}</span>
            </div>
            <div style={{ flex: 2, padding: '8px', backgroundColor: C.panel, borderRadius: '6px' }}>
              <span style={{ color: C.sub, fontSize: '11px' }}>주의: </span>
              <span style={{ color: C.text, fontSize: '11px' }}>{item.note}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── 메인 대시보드 ────────────────────────────────────────────────

const TABS = ['Overview', 'Elliott Wave', 'ICT', 'Orderflow', 'Scenarios', 'Risk'];

function Dashboard() {
  const [activePair, setActivePair] = useState('BTC');
  const [activeTab, setActiveTab] = useState('Overview');

  const d = market[activePair];

  const pairColors = { BTC: '#f7931a', ETH: '#627eea', SOL: '#9945ff', HYPE: '#22d3ee' };
  const biasColor = (bias) =>
    bias === 'bull' || bias === 'strong-bull' ? C.bull :
    bias === 'bear' || bias === 'strong-bear' ? C.bear : C.neutral;

  return (
    <div style={{
      backgroundColor: C.bg, minHeight: '100vh', fontFamily: "'Inter', 'Pretendard', sans-serif",
      color: C.text, padding: '0',
    }}>
      {/* 헤더 */}
      <div style={{
        backgroundColor: C.panel, borderBottom: `1px solid ${C.border}`,
        padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: C.text }}>
            크립토 선물 분석 대시보드
          </div>
          <div style={{ fontSize: '12px', color: C.sub, marginTop: '2px' }}>
            2026-04-10 · EW + ICT/SMC · TradingView 캡처 기반
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {PAIRS.map((p) => {
            const pd = market[p];
            const isActive = activePair === p;
            const bc = biasColor(pd.bias);
            return (
              <button
                key={p}
                onClick={() => { setActivePair(p); setActiveTab('Overview'); }}
                style={{
                  padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
                  backgroundColor: isActive ? `${pairColors[p]}22` : C.card,
                  border: `1px solid ${isActive ? pairColors[p] : C.border}`,
                  color: isActive ? pairColors[p] : C.sub,
                  fontWeight: isActive ? 700 : 400, fontSize: '13px',
                  transition: 'all 0.15s',
                }}
              >
                <div>{p}</div>
                <div style={{ fontSize: '10px', color: bc, marginTop: '2px' }}>{pd.biasLabel}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 탭 */}
      <div style={{
        backgroundColor: C.panel, borderBottom: `1px solid ${C.border}`,
        padding: '0 24px', display: 'flex', gap: '0',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 16px', cursor: 'pointer', border: 'none',
                borderBottom: isActive ? `2px solid ${pairColors[activePair]}` : '2px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? C.text : C.sub,
                fontWeight: isActive ? 600 : 400, fontSize: '13px',
                transition: 'all 0.15s',
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* 컨텐츠 */}
      <div style={{ padding: '20px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        {activeTab === 'Overview' && <OverviewTab pairKey={activePair} d={d} />}
        {activeTab === 'Elliott Wave' && <EWTab d={d} />}
        {activeTab === 'ICT' && <ICTTab d={d} />}
        {activeTab === 'Orderflow' && <OrderflowTab />}
        {activeTab === 'Scenarios' && <ScenariosTab d={d} />}
        {activeTab === 'Risk' && <RiskTab allData={market} />}
      </div>
    </div>
  );
}
