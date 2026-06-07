import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 run load_test.js
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 Virtual Users over 30s
    { duration: '5m', target: 20 },   // Stay at 20 VUs for 5 minutes (Concurrency test)
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<200'], // P95 GET must be < 200ms
    'http_req_duration{method:POST}': ['p(95)<500'], // P95 POST must be < 500ms
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

export default function () {
  // Simulate Cashier Flow
  
  // 1. Fetch Products (GET)
  let getRes = http.get(`${BASE_URL}/products`);
  check(getRes, {
    'GET /products is status 200': (r) => r.status === 200,
    'GET /products time < 200ms': (r) => r.timings.duration < 200,
  });

  // Small delay thinking time
  sleep(1);

  // 2. Submit Order (POST)
  const payload = JSON.stringify({
    payment_method: 'cash',
    total_amount: 50000,
    cash_amount: 100000,
    items: [
      { product_id: 'fake-uuid', quantity: 2, subtotal: 50000, modifiers: [] }
    ]
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      // 'Authorization': 'Bearer YOUR_TOKEN_HERE' 
    },
  };

  // Note: This will fail 401 without auth, but we test response time envelope. 
  // In a real test, you'd add auth token generation in setup().
  let postRes = http.post(`${BASE_URL}/orders`, payload, params);
  
  check(postRes, {
    'POST /orders time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(2);
}
