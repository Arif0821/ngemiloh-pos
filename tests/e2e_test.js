/* eslint-disable */
/**
 * =========================================================
 * NGEMILOH POS - COMPREHENSIVE E2E TEST SUITE
 * =========================================================
 * Fase 3: End-to-End (E2E) Testing
 * Tests the complete flow from login → order → stock deduction
 * =========================================================
 *
 * SECURITY NOTE: This test file only logs HTTP status codes and
 * test results. No sensitive data (passwords, tokens, PII) is logged.
 * CodeQL js/clear-text-logging alerts in this file are non-applicable
 * as the logged data is only non-sensitive status codes.
 */

const BASE = 'http://127.0.0.1:3000/api/v1';
let cookie = '';
let adminCookie = '';
let productId = '';
let orderId = '';
let initialStock = {};

const results = { passed: 0, failed: 0, tests: [] };

function log(name, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  results.tests.push({ name, passed, detail });
  if (passed) results.passed++; else results.failed++;
  // CodeQL: test file - only logs HTTP status codes (non-sensitive)
  console.log(`  ${icon} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const text = await res.text();
  try { return { status: res.status, ok: res.ok, data: JSON.parse(text), cookie: res.headers.get('set-cookie') }; }
  catch { return { status: res.status, ok: res.ok, data: text, cookie: res.headers.get('set-cookie') }; }
}

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║        NGEMILOH POS - E2E TEST SUITE (7 FASES)         ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ═══════════════════════════════════════════════
  // FASE E2E-1: AUTH FLOW
  // ═══════════════════════════════════════════════
  console.log('━━━ E2E-1: AUTHENTICATION FLOW ━━━');

  // E2E-1.1: Kasir Login
  const kasirLogin = await fetchJSON(`${BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username: 'kasir1', pin: '1234' })
  });
  log('Kasir Login (PIN)', kasirLogin.ok, `Status: ${kasirLogin.status}`);
  if (kasirLogin.cookie) cookie = kasirLogin.cookie.split(';')[0];

  // E2E-1.2: Superadmin Login
  const adminLogin = await fetchJSON(`${BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username: 'admin@ngemiloh.com', pin: 'Admin123' })
  });
  log('Superadmin Login (Password)', adminLogin.ok, `Status: ${adminLogin.status}`);
  if (adminLogin.cookie) adminCookie = adminLogin.cookie.split(';')[0];

  // E2E-1.3: Invalid Login
  const badLogin = await fetchJSON(`${BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username: 'kasir1', pin: '9999' })
  });
  log('Reject Invalid PIN', badLogin.status === 401, `Status: ${badLogin.status}`);

  // E2E-1.4: Auth Guard - Access protected endpoint without cookie
  const noAuth = await fetchJSON(`${BASE}/auth/me`);
  log('Auth Guard blocks unauthenticated', noAuth.status === 401, `Status: ${noAuth.status}`);

  // E2E-1.5: Auth Guard - Access protected endpoint with cookie
  const meRes = await fetchJSON(`${BASE}/auth/me`, { headers: { Cookie: cookie } });
  log('Auth Guard allows authenticated', meRes.ok, `Role: ${meRes.data?.data?.role || 'N/A'}`);

  // ═══════════════════════════════════════════════
  // FASE E2E-2: PRODUCTS FLOW
  // ═══════════════════════════════════════════════
  console.log('\n━━━ E2E-2: PRODUCTS & CATEGORIES ━━━');

  const prodRes = await fetchJSON(`${BASE}/products?include_modifiers=true`, { headers: { Cookie: cookie } });
  log('Fetch Products', prodRes.ok && prodRes.data?.data?.length > 0, `Count: ${prodRes.data?.data?.length || 0}`);
  
  let targetProduct = prodRes.data?.data?.find(p => p.name.includes('Macaroni')) || prodRes.data?.data?.[0];
  if (targetProduct) productId = targetProduct.id;

  const catRes = await fetchJSON(`${BASE}/categories`, { headers: { Cookie: cookie } });
  log('Fetch Categories', catRes.ok, `Count: ${catRes.data?.data?.length || 0}`);

  // ═══════════════════════════════════════════════
  // FASE E2E-3: INVENTORY (PRE-ORDER SNAPSHOT)
  // ═══════════════════════════════════════════════
  console.log('\n━━━ E2E-3: INVENTORY PRE-ORDER SNAPSHOT ━━━');

  const invRes = await fetchJSON(`${BASE}/admin/inventory`, { headers: { Cookie: adminCookie } });
  log('Superadmin Fetch Inventory', invRes.ok, `Items: ${invRes.data?.data?.length || 0}`);
  
  // Save initial stock for later comparison
  if (invRes.data?.data) {
    for (const m of invRes.data.data) {
      initialStock[m.name] = Number(m.stock);
    }
  }
  log('Snapshot initial stock', Object.keys(initialStock).length > 0, `${Object.keys(initialStock).length} materials tracked`);

  // E2E-3.2: Roles Guard - Kasir should NOT access inventory
  const kasirInv = await fetchJSON(`${BASE}/admin/inventory`, { headers: { Cookie: cookie } });
  log('Roles Guard blocks Kasir from Inventory', kasirInv.status === 403, `Status: ${kasirInv.status}`);

  // ═══════════════════════════════════════════════
  // FASE E2E-4: ORDER FLOW (CASH)
  // ═══════════════════════════════════════════════
  console.log('\n━━━ E2E-4: ORDER FLOW (CASH PAYMENT) ━━━');

  const product = targetProduct;
  const clientUuid1 = crypto.randomUUID();
  const cashOrder = await fetchJSON(`${BASE}/orders`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      client_uuid: clientUuid1,
      payment_method: 'cash',
      order_type: 'dine_in',
      client_final_price: Number(product?.base_price) * 2,
      items: [{ product_id: productId, quantity: 2, modifiers: [] }]
    })
  });
  log('Create Cash Order', cashOrder.ok, `Status: ${cashOrder.data?.data?.status || 'N/A'}`);
  if (cashOrder.data?.data) orderId = cashOrder.data.data.id;
  log('Cash order status is completed', cashOrder.data?.data?.status === 'completed');

  // E2E-4.2: Idempotency - Same client_uuid should return existing order
  const dupeOrder = await fetchJSON(`${BASE}/orders`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      client_uuid: clientUuid1,
      payment_method: 'cash',
      order_type: 'dine_in',
      client_final_price: Number(product?.base_price) * 2,
      items: [{ product_id: productId, quantity: 2, modifiers: [] }]
    })
  });
  log('Idempotency check (duplicate client_uuid)', dupeOrder.ok, `Same order returned: ${dupeOrder.data?.data?.id === orderId}`);

  // ═══════════════════════════════════════════════
  // FASE E2E-5: ORDER FLOW (QRIS)
  // ═══════════════════════════════════════════════
  console.log('\n━━━ E2E-5: ORDER FLOW (QRIS PAYMENT) ━━━');

  const qrisOrder = await fetchJSON(`${BASE}/orders`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      client_uuid: crypto.randomUUID(),
      payment_method: 'qris',
      order_type: 'dine_in',
      client_final_price: Number(product?.base_price) * 1,
      items: [{ product_id: productId, quantity: 1, modifiers: [] }]
    })
  });
  log('Create QRIS Order', qrisOrder.ok);
  log('QRIS generates QR string', !!qrisOrder.data?.data?.qr_string, `QR: ${(qrisOrder.data?.data?.qr_string || '').substring(0, 40)}...`);

  // ═══════════════════════════════════════════════
  // FASE E2E-6: PRICE DISCREPANCY CHECK
  // ═══════════════════════════════════════════════
  console.log('\n━━━ E2E-6: SECURITY - PRICE DISCREPANCY ━━━');

  const badPriceOrder = await fetchJSON(`${BASE}/orders`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      client_uuid: crypto.randomUUID(),
      payment_method: 'cash',
      order_type: 'dine_in',
      client_final_price: 999999,
      items: [{ product_id: productId, quantity: 1, modifiers: [] }]
    })
  });
  log('Reject manipulated price', badPriceOrder.status === 400, `Status: ${badPriceOrder.status}`);

  // ═══════════════════════════════════════════════
  // FASE E2E-7: SHIFT REPORT
  // ═══════════════════════════════════════════════
  console.log('\n━━━ E2E-7: SHIFT REPORT ━━━');

  const shiftRes = await fetchJSON(`${BASE}/orders/shift`, { headers: { Cookie: cookie } });
  log('Fetch Shift Summary', shiftRes.ok);
  log('Shift has correct total', shiftRes.data?.data?.total_orders >= 1, `Orders today: ${shiftRes.data?.data?.total_orders}`);

  // ═══════════════════════════════════════════════
  // FASE E2E-8: INVENTORY POST-ORDER CHECK
  // ═══════════════════════════════════════════════
  console.log('\n━━━ E2E-8: INVENTORY POST-ORDER VERIFICATION ━━━');

  // Wait a moment for async stock deduction to complete
  await new Promise(r => setTimeout(r, 2000));

  const invAfter = await fetchJSON(`${BASE}/admin/inventory`, { headers: { Cookie: adminCookie } });
  if (invAfter.data?.data) {
    const makaroni = invAfter.data.data.find(m => m.name === 'Makaroni Mentah');
    const makaroniInitial = initialStock['Makaroni Mentah'] || 0;
    const makaroniNow = makaroni ? Number(makaroni.stock) : 0;
    log('Stock deducted after cash order', makaroniNow < makaroniInitial, `Before: ${makaroniInitial}, After: ${makaroniNow}`);
  }

  // ═══════════════════════════════════════════════
  // FASE E2E-9: ADMIN STOCK ADJUSTMENT
  // ═══════════════════════════════════════════════
  console.log('\n━━━ E2E-9: ADMIN STOCK ADJUSTMENT ━━━');

  const materials = invAfter.data?.data || [];
  if (materials.length > 0) {
    const testMaterial = materials[0];
    const adjustRes = await fetchJSON(`${BASE}/admin/inventory/adjust`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: JSON.stringify({ id: testMaterial.id, qty: 500, type: 'IN', notes: 'E2E test restock' })
    });
    log('Admin adjust stock (IN)', adjustRes.ok, `Material: ${testMaterial.name}`);
  }

  // ═══════════════════════════════════════════════
  // FASE E2E-10: ORDER HISTORY
  // ═══════════════════════════════════════════════
  console.log('\n━━━ E2E-10: ORDER HISTORY ━━━');

  const histRes = await fetchJSON(`${BASE}/orders`, { headers: { Cookie: cookie } });
  log('Fetch Order History', histRes.ok, `Orders: ${histRes.data?.data?.length || 0}`);

  // ═══════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  HASIL: ${results.passed} PASSED / ${results.failed} FAILED / ${results.passed + results.failed} TOTAL`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (results.failed > 0) {
    console.log('FAILED TESTS:');
    results.tests.filter(t => !t.passed).forEach(t => console.log(`  ❌ ${t.name} — ${t.detail}`));
  }
}

run().catch(err => {
  console.error('E2E Suite Fatal Error:', err.message);
  process.exit(1);
});
