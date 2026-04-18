#!/bin/bash
# =============================================================================
# run-pipeline.sh — Trading Analysis Pipeline Orchestrator
# =============================================================================
# Usage:
#   ./scripts/run-pipeline.sh              # capture + analyze (both)
#   ./scripts/run-pipeline.sh --capture    # capture only
#   ./scripts/run-pipeline.sh --analyze    # analyze only
#
# cron/launchd 환경에서도 동작하도록 NVM 및 PATH를 명시적으로 설정
# =============================================================================

set -euo pipefail

# ── 경로 설정 ──────────────────────────────────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y%m%d)_pipeline.log"

# ── 로그 함수 (stdout + 파일 동시 출력) ────────────────────────────────────
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_sep() {
  echo "──────────────────────────────────────────" | tee -a "$LOG_FILE"
}

# ── Node / NVM 환경 로드 ────────────────────────────────────────────────────
load_node_env() {
  # 1순위: NVM (가장 흔한 개발 환경)
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck source=/dev/null
    source "$HOME/.nvm/nvm.sh" --no-use 2>/dev/null || true
    # 기본 NVM 버전 활성화
    nvm use default 2>/dev/null || nvm use node 2>/dev/null || true
  fi

  # 2순위: Homebrew (Apple Silicon)
  if [ -d "/opt/homebrew/bin" ]; then
    export PATH="/opt/homebrew/bin:$PATH"
  fi

  # 3순위: 시스템 node
  export PATH="/usr/local/bin:$HOME/.local/bin:$PATH"

  # claude CLI 경로 명시
  if [ -f "$HOME/.local/bin/claude" ]; then
    CLAUDE_BIN="$HOME/.local/bin/claude"
  elif command -v claude &>/dev/null; then
    CLAUDE_BIN="$(command -v claude)"
  else
    log "ERROR: claude CLI를 찾을 수 없습니다. ~/.local/bin/claude 또는 PATH를 확인하세요."
    exit 1
  fi

  # node 확인
  if ! command -v node &>/dev/null; then
    log "ERROR: node를 찾을 수 없습니다. NVM 또는 Node.js 설치를 확인하세요."
    exit 1
  fi

  log "node: $(command -v node) ($(node --version))"
  log "npm:  $(command -v npm)"
  log "claude: $CLAUDE_BIN"
}

# ── 캡처 실행 ──────────────────────────────────────────────────────────────
run_capture() {
  log_sep
  log "▶ 캡처 시작 (node scripts/capture.js)"
  log_sep

  if node scripts/capture.js 2>&1 | tee -a "$LOG_FILE"; then
    log "✓ 캡처 완료"
  else
    log "✗ 캡처 실패 (exit code: $?)"
    return 1
  fi
}

# ── view.html 재생성 (날짜 목록 하드코딩 → file:// 직접 열기 가능) ─────────
generate_index() {
  local reports_dir="$PROJECT_ROOT/reports"
  local view_file="$reports_dir/index.html"

  # YYYYMMDD_dashboard.html 파일을 최신순으로 수집
  local files
  files=$(ls "$reports_dir"/*_dashboard.html 2>/dev/null | sort -r) || true

  if [ -z "$files" ]; then
    log "view.html: 대시보드 파일 없음, 생성 건너뜀"
    return
  fi

  # JS 배열 문자열 생성
  local js_array="["
  local first=true
  while IFS= read -r filepath; do
    local fname
    fname="$(basename "$filepath")"
    local date="${fname%_dashboard.html}"
    local y="${date:0:4}" m="${date:4:2}" d="${date:6:2}"
    if [ "$first" = true ]; then first=false; else js_array+=","; fi
    js_array+="{\"date\":\"${y}-${m}-${d}\",\"file\":\"${fname}\"}"
  done <<< "$files"
  js_array+="]"

  # index.html 생성 (iframe으로 대시보드 임베드 — Vercel/file:// 모두 동작)
  cat > "$view_file" <<HTMLEOF
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Trading Analysis Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0b0e14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e8eaed; overflow: hidden; }
    button { font-family: inherit; cursor: pointer; }
    #nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: #131720; border-bottom: 1px solid #1e2535;
      padding: 10px 20px; display: flex; align-items: center; gap: 12px; height: 49px;
    }
    .logo { font-size: 13px; color: #9ca3af; white-space: nowrap; }
    select {
      background: #1a1f2e; color: #e8eaed;
      border: 1px solid #2a3147; border-radius: 6px;
      padding: 6px 10px; font-size: 13px; cursor: pointer; outline: none;
    }
    select:hover { border-color: #4ade80; }
    .nav-btn {
      background: #1a1f2e; color: #9ca3af;
      border: 1px solid #2a3147; border-radius: 6px;
      padding: 6px 12px; font-size: 13px; transition: all 0.15s;
    }
    .nav-btn:hover:not(:disabled) { background: #2a3147; color: #e8eaed; }
    .nav-btn:disabled { opacity: 0.3; cursor: default; }
    .spacer { flex: 1; }
    .count { font-size: 12px; color: #9ca3af; }
    #frame {
      position: fixed; top: 49px; left: 0; bottom: 0;
      width: 100vw; height: calc(100vh - 49px); border: none; background: #0b0e14;
    }
  </style>
</head>
<body>
  <div id="nav">
    <span class="logo">Trading Analysis</span>
    <button class="nav-btn" id="btn-prev" onclick="navigate(1)">&#9664;</button>
    <select id="date-select" onchange="go(Number(this.value))"></select>
    <button class="nav-btn" id="btn-next" onclick="navigate(-1)">&#9654;</button>
    <span class="spacer"></span>
    <span class="count" id="count-label"></span>
    <button class="nav-btn" onclick="openCurrent()" style="color:#4ade80;border-color:#4ade80">새 탭으로 열기</button>
  </div>
  <iframe id="frame" src=""></iframe>

  <script>
    const dashboards = ${js_array};
    let current = 0;

    const sel = document.getElementById('date-select');
    dashboards.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = d.date;
      sel.appendChild(opt);
    });

    function updateNav() {
      sel.value = current;
      document.getElementById('btn-prev').disabled = current === dashboards.length - 1;
      document.getElementById('btn-next').disabled = current === 0;
      document.getElementById('count-label').textContent = (current + 1) + ' / ' + dashboards.length;
    }

    function go(index) {
      current = index;
      updateNav();
      document.getElementById('frame').src = dashboards[current].file;
    }

    function navigate(dir) {
      const next = current + dir;
      if (next >= 0 && next < dashboards.length) go(next);
    }

    function openCurrent() {
      window.open(dashboards[current].file, '_blank');
    }

    go(0); // 최신 대시보드 자동 로드
  </script>
</body>
</html>
HTMLEOF

  local count
  count=$(echo "$files" | wc -l | tr -d ' ')
  log "✓ index.html 재생성 완료 (총 ${count}개 대시보드)"
}

# ── GitHub push (Vercel 자동 재배포 트리거) ────────────────────────────────
push_to_github() {
  log_sep
  log "▶ GitHub push 시작"
  git add reports/ || { log "✗ git add 실패"; return 0; }
  if git diff-index --quiet HEAD --; then
    log "ℹ git: 변경사항 없음, push 건너뜀"
    return 0
  fi
  local date_str; date_str=$(date +%Y%m%d)
  git commit -m "feat: dashboard ${date_str}" \
    && git push origin main \
    && log "✓ GitHub push 완료 → Vercel 자동 배포 트리거" \
    || log "✗ git push 실패 (네트워크/권한 확인 필요)"
}

# ── 분석 실행 ──────────────────────────────────────────────────────────────
run_analyze() {
  log_sep
  log "▶ 분석 시작 (claude --print)"
  log_sep

  # 가장 최근 스크린샷 폴더 탐색 (YYYYMMDD 형식만)
  local latest_date
  latest_date=$(ls -d "$PROJECT_ROOT/screenshots"/[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9] 2>/dev/null \
    | sort | tail -1 | xargs basename 2>/dev/null || true)

  if [ -z "$latest_date" ]; then
    log "✗ screenshots/ 하위에 날짜 폴더가 없습니다. 캡처를 먼저 실행하세요."
    return 1
  fi

  # 캡처 폴더 날짜 = 대시보드 날짜 (capture.js가 KST 기준으로 오늘 날짜 사용)
  local report_file="$PROJECT_ROOT/reports/${latest_date}_dashboard.html"
  if [ -f "$report_file" ]; then
    log "ℹ 이미 대시보드 존재: reports/${latest_date}_dashboard.html — 분석 건너뜀"
    return 0
  fi

  log "📅 분석 대상: screenshots/${latest_date}/"

  # shell alias는 cron 환경에서 동작하지 않으므로 --dangerously-skip-permissions 명시
  # 대시보드 HTML 생성량이 많아 기본 32000 토큰 한도 초과 방지
  export CLAUDE_CODE_MAX_OUTPUT_TOKENS=60000
  if "$CLAUDE_BIN" --dangerously-skip-permissions --print \
    "오늘 날짜는 ${latest_date}입니다.
screenshots/${latest_date}/ 폴더의 캡처 데이터를 사용하여
run-analysis.md 에 정의된 절차대로 전체 분석을 실행하고
reports/${latest_date}_dashboard.html 을 생성하세요.
대시보드 생성이 완료되면 파일 경로를 출력하세요." \
    2>&1 | tee -a "$LOG_FILE"; then
    log "✓ 분석 완료"
    if [ -f "$report_file" ]; then
      generate_index
      push_to_github
    else
      log "✗ 대시보드 파일이 생성되지 않았습니다: reports/${latest_date}_dashboard.html"
      return 1
    fi
  else
    log "✗ 분석 실패 (exit code: $?)"
    return 1
  fi
}

# ── 플래그 파싱 ─────────────────────────────────────────────────────────────
MODE="both"
for arg in "$@"; do
  case "$arg" in
    --capture) MODE="capture" ;;
    --analyze) MODE="analyze" ;;
    --both)    MODE="both"    ;;
    *)
      echo "Usage: $0 [--capture|--analyze|--both]"
      exit 1
      ;;
  esac
done

# ── 메인 실행 ──────────────────────────────────────────────────────────────
log_sep
log "Trading Analysis Pipeline 시작 (mode: $MODE)"
log "Project root: $PROJECT_ROOT"
log_sep

load_node_env

case "$MODE" in
  capture)
    run_capture
    ;;
  analyze)
    run_analyze
    ;;
  both)
    run_capture
    run_analyze
    ;;
esac

log_sep
log "Pipeline 완료"
log_sep
