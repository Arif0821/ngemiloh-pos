import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { PaymentMethod } from '@prisma/client';

// Helper: build a valid JWT for a kasir user
function buildToken(jwtService: JwtService, userId: string, role = 'kasir'): string {
  return jwtService.sign(
    { sub: userId, id: userId, role, email: `${userId}@test.com` },
    { secret: process.env.JWT_ACCESS_SECRET || 'test-secret' },
  );
}

describe('OrdersController E2E (Trust but Verify)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let kasirToken: string;

  // Real product UUIDs — these must exist in the seeded test database.
  // If the test DB schema has these products, the tests will pass.
  // If not, adjust the product IDs to match your seed data.
  const KNOWN_PRODUCT_ID = '00000000-0000-0000-0000-000000000001';
  const KNOWN_PRODUCT_ID_2 = '00000000-0000-0000-0000-000000000002';

  const KASIR_ID = '00000000-0000-0000-0000-000000000100';

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'e2e-test-secret-min-32-chars!!';
    process.env.PRICE_DELTA_THRESHOLD_PCT = '10';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    kasirToken = buildToken(jwtService, KASIR_ID, 'kasir');
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Cash Order – Happy Path ───────────────────────────────────────────────

  describe('POST /api/v1/orders – cash payment', () => {
    it('should process cash order and return 201 with correct totals', async () => {
      const payload = {
        client_uuid: `e2e-cash-${Date.now()}`,
        payment_method: PaymentMethod.cash,
        client_final_price: 25000,
        cash_received: 50000,
        items: [{ product_id: KNOWN_PRODUCT_ID, quantity: 1, modifiers: [] }],
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${kasirToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        payment_method: PaymentMethod.cash,
        payment_status: 'paid',
        status: 'completed',
      });
      // cash_change = cash_received - client_final_price
      expect(res.body.data.cash_change).toBe(25000);
    });

    it('should reject request without auth token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .send({ client_uuid: 'test', payment_method: PaymentMethod.cash, client_final_price: 1000, items: [] });

      expect(res.status).toBe(401);
    });

    it('should reject cash order with missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${kasirToken}`)
        .send({ client_uuid: 'test' }); // missing payment_method, client_final_price, items

      expect(res.status).toBe(400);
    });
  });

  // ─── Trust but Verify – Price Discrepancy ──────────────────────────────────

  describe('POST /api/v1/orders – Trust but Verify price discrepancy', () => {
    it('should accept offline order with price discrepancy and flag as Perlu Cek', async () => {
      // Client sends 50000 but server calculates 25000 (no active discounts, base price)
      // delta = |50000-25000|/25000 = 100% > 10% threshold → flagged as "Perlu Cek"
      const payload = {
        client_uuid: `e2e-discrepancy-${Date.now()}`,
        payment_method: PaymentMethod.cash,
        client_final_price: 50000, // server will calculate 25000 → 100% delta → flagged
        items: [{ product_id: KNOWN_PRODUCT_ID, quantity: 1, modifiers: [] }],
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${kasirToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      // Trust but Verify: server accepts the order but flags it for review
      expect(res.body.data.verification_status).toBe('Perlu Cek');
      // Server preserves client's price in total_amount
      expect(res.body.data.total_amount).toBe(50000);
    });

    it('should accept order within price threshold and set verification_status to Valid', async () => {
      // Client sends 26000, server calculates 25000 → delta = 4% < 10% threshold → Valid
      const payload = {
        client_uuid: `e2e-valid-${Date.now()}`,
        payment_method: PaymentMethod.cash,
        client_final_price: 26000, // within 10% of server's 25000
        items: [{ product_id: KNOWN_PRODUCT_ID, quantity: 1, modifiers: [] }],
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${kasirToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.verification_status).toBe('Valid');
    });
  });

  // ─── QRIS Offline Sync ─────────────────────────────────────────────────────

  describe('POST /api/v1/orders/sync-batch – QRIS offline sync', () => {
    it('should accept QRIS offline order as pending_sync', async () => {
      const payload = {
        orders: [
          {
            client_uuid: `e2e-qris-offline-${Date.now()}`,
            payment_method: PaymentMethod.qris,
            client_final_price: 25000,
            items: [{ product_id: KNOWN_PRODUCT_ID, quantity: 1, modifiers: [] }],
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders/sync-batch')
        .set('Authorization', `Bearer ${kasirToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('success');
    });

    it('should sync multiple orders and return per-order results', async () => {
      const ts = Date.now();
      const payload = {
        orders: [
          {
            client_uuid: `e2e-batch-1-${ts}`,
            payment_method: PaymentMethod.cash,
            client_final_price: 25000,
            items: [{ product_id: KNOWN_PRODUCT_ID, quantity: 1, modifiers: [] }],
          },
          {
            client_uuid: `e2e-batch-2-${ts}`,
            payment_method: PaymentMethod.cash,
            client_final_price: 25000,
            items: [{ product_id: KNOWN_PRODUCT_ID_2, quantity: 1, modifiers: [] }],
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders/sync-batch')
        .set('Authorization', `Bearer ${kasirToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].status).toBe('success');
      expect(res.body.data[1].status).toBe('success');
    });

    it('should return error for non-existent product in batch', async () => {
      const payload = {
        orders: [
          {
            client_uuid: `e2e-batch-invalid-${Date.now()}`,
            payment_method: PaymentMethod.cash,
            client_final_price: 1000,
            items: [{ product_id: '00000000-0000-0000-9999-000000000000', quantity: 1, modifiers: [] }],
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders/sync-batch')
        .set('Authorization', `Bearer ${kasirToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data[0].status).toBe('error');
      expect(res.body.data[0].message).toContain('not found');
    });

    it('should reject batch with more than 100 orders', async () => {
      const orders = Array.from({ length: 101 }, (_, i) => ({
        client_uuid: `e2e-batch-ovf-${Date.now()}-${i}`,
        payment_method: PaymentMethod.cash as PaymentMethod,
        client_final_price: 1000,
        items: [{ product_id: KNOWN_PRODUCT_ID, quantity: 1, modifiers: [] }],
      }));

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders/sync-batch')
        .set('Authorization', `Bearer ${kasirToken}`)
        .send({ orders });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('100 orders');
    });
  });

  // ─── Order History ─────────────────────────────────────────────────────────

  describe('GET /api/v1/orders – order history', () => {
    it('should return paginated order history', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${kasirToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should accept pagination parameters', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders?page=1&limit=10')
        .set('Authorization', `Bearer ${kasirToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});