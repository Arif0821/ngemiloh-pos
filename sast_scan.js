/**
 * =========================================================
 * NGEMILOH POS - SAST (Static Application Security Testing)
 * =========================================================
 * Fase 4: Analisis keamanan statis terhadap source code
 * =========================================================
 */

const fs = require('fs');
const path = require('path');

const BACKEND_SRC = path.join(__dirname, 'backend', 'src');
const BACKEND_ROOT = path.join(__dirname, 'backend');

const findings = [];
let fileCount = 0;

function addFinding(severity, category, file, line, description, recommendation) {
  findings.push({ severity, category, file: path.relative(__dirname, file), line, description, recommendation });
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = path.relative(__dirname, filePath);
  fileCount++;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // ── CRITICAL: Hardcoded Secrets ──
    if (/(?:password|secret|key|token)\s*[:=]\s*['"][^'"]{8,}['"]/.test(trimmed) && 
        !/process\.env|mock|test|spec|example|placeholder|YOUR_|DEV_/.test(trimmed)) {
      addFinding('CRITICAL', 'Hardcoded Secret', filePath, lineNum,
        `Possible hardcoded secret found: ${trimmed.substring(0, 80)}...`,
        'Use environment variables (process.env) for all secrets.');
    }

    // ── HIGH: SQL Injection via raw queries ──
    if (/\$queryRaw|\.query\(|\.exec\(/.test(trimmed) && /\$\{/.test(trimmed)) {
      addFinding('HIGH', 'SQL Injection', filePath, lineNum,
        'Template literal used in raw SQL query — potential SQL injection.',
        'Use parameterized queries: $queryRaw`SELECT * FROM ... WHERE id = ${Prisma.sql``}`');
    }

    // ── HIGH: No input validation ──
    if (/body:\s*any|@Body\(\)\s*body:\s*any/.test(trimmed)) {
      addFinding('MEDIUM', 'Missing Input Validation', filePath, lineNum,
        'Request body typed as `any` — no DTO validation.',
        'Create DTOs with class-validator decorators and use ValidationPipe.');
    }

    // ── HIGH: Missing rate limiting ──
    if (/@Post\('login'\)/.test(trimmed)) {
      // Check if Throttle decorator is nearby
      const surroundingLines = lines.slice(Math.max(0, idx - 5), idx).join('\n');
      if (!/Throttle|ThrottlerGuard|RateLimit/.test(surroundingLines)) {
        addFinding('HIGH', 'Missing Rate Limiting', filePath, lineNum,
          'Login endpoint has no rate-limiting decorator.',
          'Add @UseGuards(ThrottlerGuard) or @Throttle() to prevent brute-force attacks.');
      }
    }

    // ── MEDIUM: console.log in production code ──
    if (/console\.(log|debug)\(/.test(trimmed) && !/spec\.ts|test\.ts|seed\.ts/.test(filePath)) {
      addFinding('LOW', 'Console Log in Production', filePath, lineNum,
        'console.log/debug found in production code.',
        'Use NestJS Logger instead of console.log for proper log management.');
    }

    // ── MEDIUM: Sensitive data exposure in responses ──
    if (/password_hash|pin_hash|secret/.test(trimmed) && /return|response|res\.json/.test(lines.slice(Math.max(0, idx - 3), idx + 3).join(' '))) {
      addFinding('HIGH', 'Sensitive Data Exposure', filePath, lineNum,
        'Sensitive field (password_hash, pin_hash) may be exposed in API response.',
        'Always select specific fields and exclude sensitive data from responses.');
    }

    // ── MEDIUM: Missing CORS configuration ──
    if (/origin:\s*true/.test(trimmed)) {
      addFinding('MEDIUM', 'Permissive CORS', filePath, lineNum,
        'CORS origin set to `true` (allows all origins).',
        'Restrict CORS to specific allowed origins in production.');
    }

    // ── MEDIUM: JWT Secret from env without fallback validation ──
    if (/JWT_ACCESS_SECRET/.test(trimmed) && /process\.env/.test(trimmed)) {
      const surroundingLines = lines.slice(idx, Math.min(lines.length, idx + 3)).join('\n');
      if (!/if\s*\(!|throw|required/.test(surroundingLines)) {
        addFinding('MEDIUM', 'Unchecked JWT Secret', filePath, lineNum,
          'JWT_ACCESS_SECRET loaded from env without validation — may be undefined.',
          'Validate that JWT_ACCESS_SECRET exists at startup; throw if missing.');
      }
    }

    // ── LOW: TODO/FIXME/HACK comments ──
    if (/TODO|FIXME|HACK|XXX/.test(trimmed) && !filePath.includes('sast_scan')) {
      addFinding('INFO', 'Technical Debt', filePath, lineNum,
        `Found: ${trimmed.substring(0, 100)}`,
        'Address or track technical debt items.');
    }

    // ── HIGH: Missing error handling ──
    if (/\.catch\(err\s*=>/.test(trimmed) && /\{\s*\}/.test(lines.slice(idx, Math.min(lines.length, idx + 2)).join(''))) {
      addFinding('HIGH', 'Empty Error Handler', filePath, lineNum,
        'Empty catch block swallows errors silently.',
        'Always log or handle errors properly.');
    }

    // ── MEDIUM: Unsafe type assertion ──
    if (/as\s+any/.test(trimmed)) {
      addFinding('LOW', 'Unsafe Type Assertion', filePath, lineNum,
        '`as any` type assertion bypasses TypeScript safety.',
        'Use proper types or `unknown` with type guards instead of `as any`.');
    }
  });
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.prisma', 'coverage'].includes(entry.name)) continue;
      walkDir(fullPath);
    } else if (/\.(ts|js)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      scanFile(fullPath);
    }
  }
}

// ── Scan .env for secrets ──
function scanEnv() {
  const envPath = path.join(BACKEND_ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (/^[A-Z_]+=.+$/.test(line.trim()) && !/^#/.test(line.trim())) {
        const [key, val] = line.split('=');
        if (/(SECRET|KEY|PASSWORD|TOKEN)/.test(key) && val && val.length > 5 && !/YOUR_|changeme|example/i.test(val)) {
          addFinding('INFO', 'Env Secret Detected', envPath, idx + 1,
            `Secret "${key}" is set in .env — ensure .env is in .gitignore.`,
            'Verify .env is in .gitignore and use secrets management in production.');
        }
      }
    });
  }
}

// ── Check .gitignore ──
function checkGitignore() {
  const gitignorePath = path.join(BACKEND_ROOT, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (!content.includes('.env')) {
      addFinding('CRITICAL', 'Missing Gitignore Rule', gitignorePath, 0,
        '.env file is NOT listed in .gitignore — secrets may be committed to git.',
        'Add .env to .gitignore immediately.');
    }
  } else {
    addFinding('HIGH', 'Missing .gitignore', BACKEND_ROOT, 0,
      'No .gitignore file found in backend directory.',
      'Create .gitignore with node_modules, dist, .env entries.');
  }
}

// ── Main ──
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║     NGEMILOH POS — SAST (Static Security Analysis)     ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

walkDir(BACKEND_SRC);
scanEnv();
checkGitignore();

console.log(`Scanned ${fileCount} source files.\n`);

// Group by severity
const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
for (const sev of severities) {
  const items = findings.filter(f => f.severity === sev);
  if (items.length === 0) continue;
  console.log(`\n━━━ ${sev} (${items.length}) ━━━`);
  items.forEach(f => {
    const icon = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🔵', INFO: 'ℹ️' }[f.severity];
    console.log(`  ${icon} [${f.category}] ${f.file}:${f.line}`);
    console.log(`     ${f.description}`);
    console.log(`     → ${f.recommendation}`);
  });
}

// Summary
const critCount = findings.filter(f => f.severity === 'CRITICAL').length;
const highCount = findings.filter(f => f.severity === 'HIGH').length;
const medCount = findings.filter(f => f.severity === 'MEDIUM').length;
const lowCount = findings.filter(f => f.severity === 'LOW').length;
const infoCount = findings.filter(f => f.severity === 'INFO').length;

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log(`║  SAST SUMMARY: ${findings.length} findings`);
console.log(`║  🔴 Critical: ${critCount}  🟠 High: ${highCount}  🟡 Medium: ${medCount}  🔵 Low: ${lowCount}  ℹ️  Info: ${infoCount}`);
console.log('╚══════════════════════════════════════════════════════════╝\n');
