# 자동화 설정 가이드

## 개요

```
cron (매일 08:00) → run-pipeline.sh → capture.js (캡처) → claude --print (분석) → reports/
```

---

## 1단계: 실행 권한 부여

```bash
chmod +x scripts/run-pipeline.sh
```

---

## 2단계: 수동 테스트

자동화 설정 전에 반드시 수동으로 한 번 실행해서 정상 동작을 확인하세요.

```bash
# 전체 파이프라인 (캡처 + 분석)
./scripts/run-pipeline.sh

# 캡처만
./scripts/run-pipeline.sh --capture

# 분석만 (이미 캡처된 오늘자 스크린샷 기준)
./scripts/run-pipeline.sh --analyze
```

실행 후 확인할 것:
- `screenshots/오늘날짜/` 폴더에 PNG 파일들이 있는지
- `reports/오늘날짜_dashboard.jsx` 파일이 생성되었는지
- `logs/오늘날짜_pipeline.log` 에 에러가 없는지

---

## 3단계: cron 등록

### macOS (launchd 대신 cron 사용)

```bash
# crontab 편집기 열기
crontab -e
```

아래 내용을 추가하세요:

```cron
# ─── Trading Analysis 자동 실행 ─────────────────────────
# 평일 매일 오전 8시 실행 (월~금)
0 8 * * 1-5 /Users/theo/workspace_tokamak/trading-analysis/scripts/run-pipeline.sh >> /Users/theo/workspace_tokamak/trading-analysis/logs/cron.log 2>&1

# 주말 포함 매일 실행하려면 아래로 교체:
# 0 8 * * * /Users/theo/workspace_tokamak/trading-analysis/scripts/run-pipeline.sh >> /Users/theo/workspace_tokamak/trading-analysis/logs/cron.log 2>&1
```

저장 후 등록 확인:

```bash
crontab -l
```

### cron 시간 변경 예시

```
0 8 * * 1-5    # 평일 08:00
0 7 * * *      # 매일 07:00
30 8 * * 1-5   # 평일 08:30
0 8,20 * * *   # 매일 08:00 + 20:00 (하루 2회)
```

---

## 4단계: macOS cron 권한 설정 (중요)

macOS는 cron에 디스크 접근 권한을 별도로 부여해야 합니다.

1. **시스템 설정** → **개인정보 보호 및 보안** → **전체 디스크 접근 권한**
2. `+` 클릭 → `/usr/sbin/cron` 추가
   - Finder에서 `Cmd+Shift+G` → `/usr/sbin/cron` 입력
3. 토글 활성화

> 이 단계를 건너뛰면 cron이 파일 시스템에 접근하지 못해 캡처가 실패할 수 있습니다.

---

## 5단계: Claude Code CLI 확인

분석 자동화에는 `claude` CLI가 터미널에서 실행 가능해야 합니다.

```bash
# claude CLI가 설치되어 있는지 확인
which claude

# 버전 확인
claude --version
```

설치되어 있지 않다면:

```bash
npm install -g @anthropic-ai/claude-code
```

> Claude Max 구독이 활성화된 상태여야 `claude --print` 명령이 동작합니다.

---

## 로그 확인

```bash
# 오늘 파이프라인 로그
cat logs/$(date +%Y%m%d)_pipeline.log

# cron 실행 로그
tail -50 logs/cron.log

# 최근 로그 실시간 모니터링
tail -f logs/cron.log
```

---

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| cron이 실행 안 됨 | macOS 디스크 권한 미부여 | 4단계 권한 설정 |
| `node: command not found` | cron PATH에 node 없음 | run-pipeline.sh가 자동 처리 (NVM 로드) |
| `claude: command not found` | claude CLI 미설치 또는 PATH 누락 | 5단계 확인 |
| 빈 스크린샷 | 세션 만료 | `npm run save-session:tv` 재실행 |
| 분석 미생성 | Claude Max 미구독 | 구독 상태 확인 |
| headless 캡처 불안정 | Chromium 렌더링 이슈 | capture.js에서 headless: false로 테스트 |

---

## npm 명령어 요약

```bash
npm run capture           # 전체 캡처
npm run capture:tv        # TradingView만
npm run capture:orderflow # 오더플로우 플랫폼만
npm run analyze           # Claude 분석만
npm run pipeline          # 전체 파이프라인 (캡처+분석)
npm run pipeline:capture  # 캡처만 (셸 스크립트 경유)
npm run pipeline:analyze  # 분석만 (셸 스크립트 경유)
```
