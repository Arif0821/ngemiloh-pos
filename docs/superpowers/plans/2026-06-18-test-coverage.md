# Test Coverage Improvement Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task with TDD.

**Goal:** Add comprehensive test coverage for 62 missing test cases across 5 services.

**Architecture:** Write unit tests following existing patterns in the codebase. Use `@nestjs/testing` for backend services with proper mocking.

---

## Services Needing Tests

### 1. InventoryService (backend/src/inventory/)
- `reduceStockForOrder` - reduces raw material stock when order is placed
- `restoreStockForOrder` - restores stock when order is voided
- `adjustStock` - manual stock adjustment
- `submitOpname` - stock opname reconciliation
- `getLowStockMaterials` - low stock alert

### 2. UsersService (backend/src/users/)
- `createCashier` - create new cashier account
- `resetCashierPin` - reset cashier PIN
- `updateUser` - update user details
- `deactivateUser` - deactivate user

### 3. MidtransGatewayService (backend/src/payment/)
- `createQris` - create QRIS payment
- `verifyWebhookSignature` - verify Midtrans webhook authenticity
- `getPaymentStatus` - check payment status
- `cancelPayment` - cancel pending payment

### 4. AuthService (backend/src/auth/)
- `validateKasirCredentials` - PIN login validation
- `validateAdminCredentials` - email + password login
- `otpRateLimit` - OTP rate limiting (5 per 10 min)
- `ipLockout` - IP lockout after 5 failed attempts
- `verifyOtp` - OTP verification

### 5. FinanceService (backend/src/finance/) - ADDITIONAL
- `closeShift` - close cash register shift
- `payProfitShare` - pay profit share to cashiers
- `getDashboardKpi` - dashboard KPI metrics
- `createOpex` - create operational expense

---

## Test Patterns

### Backend Tests (Jest + @nestjs/testing)

```typescript
describe('InventoryService', () => {
  let service: InventoryService;
  let mockRepo: jest.Mocked<IInventoryRepository>;

  beforeEach(async () => {
    mockRepo = {
      findOrderWithIngredients: jest.fn(),
      executeInTransaction: jest.fn(),
      // ... other methods
    };
    
    const module = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: INVENTORY_REPOSITORY, useValue: mockRepo },
      ],
    }).compile();
    
    service = module.get<InventoryService>(InventoryService);
  });
  
  describe('reduceStockForOrder', () => {
    it('should reduce stock for order items with BOM recipes', async () => {
      // Arrange
      const orderId = 'order-123';
      mockRepo.findOrderWithIngredients.mockResolvedValue({
        items: [{
          quantity: 2,
          product: {
            bom_recipes: [{
              raw_material_id: 'rm-1',
              quantity_per_serving: { toNumber: () => 100 },
            }],
          },
        }],
      });
      
      // Act
      await service.reduceStockForOrder(orderId);
      
      // Assert
      expect(mockRepo.executeInTransaction).toHaveBeenCalled();
    });
    
    it('should handle order not found', async () => {
      mockRepo.findOrderWithIngredients.mockResolvedValue(null);
      await expect(service.reduceStockForOrder('invalid')).resolves.not.toThrow();
    });
  });
});
```

---

## Task List

### Task 1: InventoryService Tests
- Create: `backend/src/inventory/inventory.service.spec.ts`
- Tests: reduceStockForOrder, restoreStockForOrder, adjustStock, submitOpname

### Task 2: UsersService Tests  
- Create: `backend/src/users/users.service.spec.ts`
- Tests: createCashier, resetCashierPin, updateUser, deactivateUser

### Task 3: MidtransGatewayService Tests
- Create: `backend/src/payment/midtrans-gateway.service.spec.ts`
- Tests: createQris, verifyWebhookSignature, getPaymentStatus, cancelPayment

### Task 4: AuthService Tests
- Create: `backend/src/auth/auth.service.spec.ts` (add to existing)
- Tests: validateKasirCredentials, validateAdminCredentials, otpRateLimit, ipLockout

### Task 5: FinanceService Additional Tests
- Add to: `backend/src/finance/finance.service.spec.ts`
- Tests: closeShift, payProfitShare, getDashboardKpi, createOpex

---

## Success Criteria

- All new tests pass
- Total backend tests: 85 → 147+ (target)
- No regression in existing tests
