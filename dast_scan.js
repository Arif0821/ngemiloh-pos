/**
 * =========================================================
 * NGEMILOH POS - DAST (Dynamic Application Security Testing)
 * =========================================================
 * Fase 5: Pengujian keamanan terhadap server yang sedang berjalan
 * =========================================================
 */

const BASE = 'http://127.0.0.1:3000';
const API = `${BASE}/api/v1`;

const findings = [];
let passed = 0;
let failed = 0;

function log(name, safe, detail = '') {
  const icon = safe ? '🛡️' : '⚠️';
  findings.push({ name, safe, detail });
  if (safe) passed++; else failed++;
  console.log(`  ${icon} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function fetchRaw(url, opts = {}) {
  try {
    const res = await fetch(url, { ...opts, redirect: 'manual' });
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body: await res.text() };
  } catch (e) {
    return { status: 0, headers: {}, body: e.message, error: true };
  }
}

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     NGEMILOH POS — DAST (Dynamic Security Testing)     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ══════════════════════════════════
  // 1. SECURITY HEADERS
  // ══════════════════════════════════
  console.log('━━━ 1. HTTP Security Headers ━━━');
  const root = await fetchRaw(BASE);
  
  log('X-Powered-By header hidden', !root.headers['x-powered-by'], 
    root.headers['x-powered-by'] ? `Exposed: ${root.headers['x-powered-by']}` : 'Header not present');
  log('Content-Type-Options (nosniff)', 
    root.headers['x-content-type-options'] === 'nosniff', root.headers['x-content-type-options'] || 'Missing');
  log('X-Frame-Options (clickjacking)', 
    !!root.headers['x-frame-options'], root.headers['x-frame-options'] || 'Missing');
  log('Strict-Transport-Security', 
    !!root.headers['strict-transport-security'], root.headers['strict-transport-security'] || 'Missing (OK for dev)');

  // ══════════════════════════════════
  // 2. INJECTION ATTACKS
  // ══════════════════════════════════
  console.log('\n━━━ 2. Injection Attacks ━━━');
  
  // SQL Injection via login
  const sqli = await fetchRaw(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: "' OR 1=1 --", pin: "' OR 1=1 --" })
  });
  log('SQL Injection on login', sqli.status === 401 || sqli.status === 500, `Status: ${sqli.status}`);
  
  // NoSQL Injection
  const nosql = await fetchRaw(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: {"$gt": ""}, pin: {"$gt": ""} })
  });
  log('NoSQL Injection on login', nosql.status === 401 || nosql.status === 400 || nosql.status === 500, `Status: ${nosql.status}`);

  // XSS in body fields
  const xss = await fetchRaw(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: '<script>alert("XSS")</script>', pin: '1234' })
  });
  log('XSS payload rejected/escaped', !xss.body.includes('<script>alert("XSS")</script>'), `Status: ${xss.status}`);

  // ══════════════════════════════════
  // 3. AUTHENTICATION BYPASS
  // ══════════════════════════════════
  console.log('\n━━━ 3. Authentication Bypass ━━━');

  // Access protected routes without token
  const noToken = await fetchRaw(`${API}/orders`);
  log('Orders endpoint requires auth', noToken.status === 401, `Status: ${noToken.status}`);

  const noTokenAdmin = await fetchRaw(`${API}/admin/inventory`);
  log('Admin inventory requires auth', noTokenAdmin.status === 401, `Status: ${noTokenAdmin.status}`);

  // Forged JWT token
  const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlLWlkIiwicm9sZSI6InN1cGVyYWRtaW4ifQ.fakesignature';
  const forgedRes = await fetchRaw(`${API}/admin/inventory`, {
    headers: { Cookie: `access_token=${forgedToken}` }
  });
  log('Reject forged JWT', forgedRes.status === 401, `Status: ${forgedRes.status}`);

  // Tampered JWT (modified payload)
  const tamperedRes = await fetchRaw(`${API}/auth/me`, {
    headers: { Cookie: `access_token=invalid.token.value` }
  });
  log('Reject tampered JWT', tamperedRes.status === 401, `Status: ${tamperedRes.status}`);

  // ══════════════════════════════════
  // 4. AUTHORIZATION (RBAC)
  // ══════════════════════════════════
  console.log('\n━━━ 4. Role-Based Access Control ━━━');
  
  // Login as Kasir
  const kasirLogin = await fetchRaw(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'kasir1', pin: '1234' })
  });
  const kasirCookie = (kasirLogin.headers['set-cookie'] || '').split(';')[0];

  // Kasir tries to access admin routes
  const kasirAdmin = await fetchRaw(`${API}/admin/inventory`, {
    headers: { Cookie: kasirCookie }
  });
  log('Kasir cannot access /admin/inventory', kasirAdmin.status === 403, `Status: ${kasirAdmin.status}`);

  const kasirAdjust = await fetchRaw(`${API}/admin/inventory/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: kasirCookie },
    body: JSON.stringify({ id: 'fake-id', qty: 100, type: 'IN', notes: 'hack' })
  });
  log('Kasir cannot adjust inventory', kasirAdjust.status === 403, `Status: ${kasirAdjust.status}`);

  // ══════════════════════════════════
  // 5. BUSINESS LOGIC ATTACKS
  // ══════════════════════════════════
  console.log('\n━━━ 5. Business Logic Attacks ━━━');

  // Negative quantity
  const negQty = await fetchRaw(`${API}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: kasirCookie },
    body: JSON.stringify({
      client_uuid: crypto.randomUUID(),
      payment_method: 'cash',
      client_final_price: -5000,
      items: [{ product_id: 'fake', quantity: -5, modifiers: [] }]
    })
  });
  log('Reject negative quantity/price', negQty.status >= 400, `Status: ${negQty.status}`);

  // Price tampering (zero price)
  const zeroPrice = await fetchRaw(`${API}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: kasirCookie },
    body: JSON.stringify({
      client_uuid: crypto.randomUUID(),
      payment_method: 'cash',
      client_final_price: 0,
      items: [{ product_id: 'fake', quantity: 1, modifiers: [] }]
    })
  });
  log('Reject zero-price order', zeroPrice.status >= 400, `Status: ${zeroPrice.status}`);

  // ══════════════════════════════════
  // 6. INFORMATION DISCLOSURE
  // ══════════════════════════════════
  console.log('\n━━━ 6. Information Disclosure ━━━');

  // Check if error messages reveal stack traces
  const errRes = await fetchRaw(`${API}/nonexistent`);
  log('No stack trace in 404', !errRes.body.includes('at ') && !errRes.body.includes('node_modules'), `Length: ${errRes.body.length}`);

  // Check /api/v1 doesn't expose internal info
  const apiRoot = await fetchRaw(`${API}`);
  log('API root does not expose internal info', !apiRoot.body.includes('node_modules') && !apiRoot.body.includes('stack'), `Status: ${apiRoot.status}`);

  // ══════════════════════════════════
  // 7. COOKIE SECURITY
  // ══════════════════════════════════
  console.log('\n━━━ 7. Cookie Security ━━━');

  const loginRes = await fetchRaw(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'kasir1', pin: '1234' })
  });
  const setCookie = loginRes.headers['set-cookie'] || '';
  log('Cookie has HttpOnly flag', /httponly/i.test(setCookie), setCookie.substring(0, 60) + '...');
  log('Cookie has SameSite flag', /samesite/i.test(setCookie));

  // ══════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  DAST SUMMARY: ${passed} SAFE / ${failed} VULNERABLE / ${passed + failed} TOTAL`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (failed > 0) {
    console.log('⚠️  VULNERABILITIES FOUND:');
    findings.filter(f => !f.safe).forEach(f => console.log(`  ⚠️  ${f.name} — ${f.detail}`));
  }
}

run().catch(err => {
  console.error('DAST Fatal Error:', err.message);
  process.exit(1);
});
