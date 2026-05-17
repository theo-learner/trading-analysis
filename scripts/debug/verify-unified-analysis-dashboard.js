const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

const targetArg = process.argv[2] || 'reports/20260418_dashboard.html';
const targetPath = path.resolve(process.cwd(), targetArg);

if (!fs.existsSync(targetPath)) {
  fail(`Dashboard file not found: ${targetPath}`);
  process.exit(process.exitCode || 1);
}

const source = fs.readFileSync(targetPath, 'utf8');

const requiredPatterns = [
  {
    label: 'unified tab label',
    pattern: /['"]분석['"]/,
  },
  {
    label: 'AnalysisTab component',
    pattern: /function\s+AnalysisTab\s*\(/,
  },
  {
    label: 'dashboard routes unified analysis tab',
    pattern: /activeTab\s*===\s*['"]분석['"]/,
  },
];

const forbiddenPatterns = [
  {
    label: 'legacy Elliott Wave tab route',
    pattern: /activeTab\s*===\s*['"]Elliott Wave['"]/,
  },
  {
    label: 'legacy ICT tab route',
    pattern: /activeTab\s*===\s*['"]ICT['"]/,
  },
  {
    label: 'legacy EWTab component',
    pattern: /function\s+EWTab\s*\(/,
  },
  {
    label: 'legacy ICTTab component',
    pattern: /function\s+ICTTab\s*\(/,
  },
  {
    label: 'legacy tab array items',
    pattern: /TABS?\s*=\s*\[[^\]]*['"]Elliott Wave['"][\s\S]*['"]ICT['"][\s\S]*\]/,
  },
];

for (const check of requiredPatterns) {
  if (check.pattern.test(source)) {
    pass(`Found ${check.label}`);
  } else {
    fail(`Missing ${check.label}`);
  }
}

for (const check of forbiddenPatterns) {
  if (check.pattern.test(source)) {
    fail(`Found ${check.label}`);
  } else {
    pass(`Did not find ${check.label}`);
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
