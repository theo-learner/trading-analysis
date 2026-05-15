# 구조 일지 마크다운 렌더링 개선 Design

## Goal

`renderDiary(md)`가 현재 `<pre>` raw 텍스트를 출력해 가독성이 떨어지는 문제를 해결한다.
marked.js CDN을 추가해 완전한 HTML 마크다운 렌더링으로 교체한다.

## Scope

변경 파일: `scripts/dashboard/index.html` 한 파일만.

## Architecture

### CDN 추가
```html
<script src="https://cdn.jsdelivr.net/npm/marked@9/marked.min.js"></script>
```
`lightweight-charts` 스크립트 다음에 삽입.

### renderDiary 교체

**Before:**
```js
const pre = document.createElement('pre');
pre.className = 'diary-content';
pre.textContent = md;
el.innerHTML = '';
el.appendChild(pre);
```

**After:**
```js
const clean = md.replace(/^---[\s\S]*?---\n*/, '');  // strip YAML frontmatter
const div = document.createElement('div');
div.className = 'diary-rendered';
div.innerHTML = marked.parse(clean, { breaks: true });
el.innerHTML = '';
el.appendChild(div);
```

### CSS

`.diary-content` 규칙 삭제. `.diary-rendered` 추가:

| 요소 | 스타일 |
|------|--------|
| `h1` | 14px, bold, `var(--primary)`, 하단 border |
| `h2` | 13px, bold, `var(--text)` |
| `strong` | `var(--primary)` |
| `ul > li` | 들여쓰기, 불릿 |
| `table` | 전체 너비, collapse border |
| `th` | `var(--card)` 배경, `var(--muted)` 색상 |
| `td` | `var(--border)` 보더 |
| `hr` | `var(--border)` 색상 |
| `p` | 행간 1.5 |

## Out of Scope

- 섹션 접기/펼치기 (collapsible)
- Syntax highlighting
- 단위 테스트 변경 (순수 UI 변경)
