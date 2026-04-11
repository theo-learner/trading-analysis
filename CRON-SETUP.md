# 자동화 설정 (Cron + Cowork 스케줄)

## 전체 구조

```
08:00 AM  macOS launchd  →  run-pipeline.sh --capture  →  screenshots/YYYYMMDD/ 저장
08:30 AM  Cowork 스케줄   →  분석 + 대시보드 생성       →  reports/YYYYMMDD_dashboard.jsx
```

---

## PART 1: macOS 캡처 자동화 (launchd)

### 방법 A — launchd (권장, macOS 표준)

```bash
# 1. plist 파일을 LaunchAgents 폴더로 복사
cp /Users/theo/workspace_tokamak/trading-analysis/scripts/com.trading.capture.plist \
   ~/Library/LaunchAgents/com.trading.capture.plist

# 2. 로드 (즉시 등록)
launchctl load ~/Library/LaunchAgents/com.trading.capture.plist

# 3. 등록 확인
launchctl list | grep trading
```

등록 해제:
```bash
launchctl unload ~/Library/LaunchAgents/com.trading.capture.plist
```

로그 확인:
```bash
tail -f /Users/theo/workspace_tokamak/trading-analysis/logs/launchd_capture.log
```

---

### 방법 B — crontab (간단)

```bash
# 편집기 열기
crontab -e
```

아래 내용 추가:
```
# 크립토 선물 차트 캡처 — 평일 오전 8시
0 8 * * 1-5 /bin/bash /Users/theo/workspace_tokamak/trading-analysis/scripts/run-pipeline.sh --capture >> /Users/theo/workspace_tokamak/trading-analysis/logs/cron.log 2>&1
```

확인:
```bash
crontab -l
```

### macOS 디스크 접근 권한 (필수)

cron/launchd가 파일 시스템에 접근하려면 권한을 부여해야 합니다.

1. **시스템 설정** → **개인정보 보호 및 보안** → **전체 디스크 접근 권한**
2. `+` 클릭 → Finder에서 `Cmd+Shift+G` → `/usr/sbin/cron` 입력 → 추가
3. 토글 **ON**

---

## PART 2: Cowork 분석 스케줄 설정

> ⚠️ 스케줄 작업 세션 내에서는 새 스케줄 작업을 생성할 수 없습니다.
> **새 Cowork 세션**을 열고 아래 단계를 따르세요.

### 방법: Claude에게 직접 요청

새 Cowork 세션에서:

```
scripts/cowork-analysis-task-prompt.md 파일의 내용을 프롬프트로 사용해서
매일 오전 8시 30분 (평일 Mon-Fri)에 실행되는 스케줄 작업을 만들어줘.
작업 이름: trading-analysis-pipeline
```

또는 수동으로:
1. Cowork 사이드바 → **Scheduled Tasks**
2. **New Task** 클릭
3. Task ID: `trading-analysis-pipeline`
4. Cron: `30 8 * * 1-5` (평일 08:30)
5. Prompt: `scripts/cowork-analysis-task-prompt.md` 내용 붙여넣기

---

## 타이밍 커스터마이징

| 원하는 스케줄 | launchd/cron 시간 | Cowork 스케줄 |
|---|---|---|
| 평일 08:00 캡처 / 08:30 분석 (기본) | `0 8 * * 1-5` | `30 8 * * 1-5` |
| 매일 07:00 캡처 / 07:30 분석 | `0 7 * * *` | `30 7 * * *` |
| 평일 06:00 캡처 / 06:30 분석 | `0 6 * * 1-5` | `30 6 * * 1-5` |
| 하루 2회 (08:00 + 20:00) | `0 8,20 * * 1-5` | `30 8,20 * * 1-5` |

---

## 수동 테스트

```bash
cd /Users/theo/workspace_tokamak/trading-analysis

# 캡처만 테스트
./scripts/run-pipeline.sh --capture

# 스크린샷 확인
ls screenshots/$(date +%Y%m%d)/tradingview/

# 분석은 Cowork에서 새 세션 열고:
# "오늘 스크린샷 분석해서 대시보드 만들어줘" 라고 요청
```

---

## 세션 갱신 (4주마다)

TradingView 로그인 세션이 만료되면 캡처 품질이 저하됩니다:

```bash
cd /Users/theo/workspace_tokamak/trading-analysis
node scripts/save-session.js tradingview
node scripts/save-session.js exocharts
```

---

## 파일 위치 요약

| 파일 | 역할 |
|---|---|
| `scripts/com.trading.capture.plist` | macOS launchd 설정 파일 |
| `scripts/run-pipeline.sh` | 캡처 실행 스크립트 |
| `scripts/cowork-analysis-task-prompt.md` | Cowork 스케줄 작업 프롬프트 |
| `logs/YYYYMMDD_pipeline.log` | 일별 파이프라인 로그 |
| `logs/launchd_capture.log` | launchd 실행 로그 |
| `screenshots/YYYYMMDD/` | 캡처된 차트 이미지 |
| `reports/YYYYMMDD_dashboard.jsx` | 생성된 분석 대시보드 |
