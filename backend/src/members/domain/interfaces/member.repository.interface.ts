import { Prisma } from '@prisma/client';

export interface MemberWithTier {
  id: string;
  member_code: string;
  phone: string;
  name: string;
  email: string | null;
  loyalty_points: number;
  current_tier_id: string | null;
  registered_at: Date;
  registered_via: string;
  is_active: boolean;
  tier: {
    id: string;
    name: string;
    min_points: number;
    free_item_id: string | null;
    sort_order: number;
  } | null;
}

export interface IMemberRepository {
  create(data: Prisma.MemberUncheckedCreateInput): Promise<MemberWithTier>;
  findById(id: string): Promise<MemberWithTier | null>;
  findByPhone(phone: string): Promise<MemberWithTier | null>;
  findByMemberCode(code: string): Promise<MemberWithTier | null>;
  updatePoints(id: string, newBalance: number): Promise<MemberWithTier>;
  updateTier(id: string, tierId: string): Promise<MemberWithTier>;
  deactivate(id: string): Promise<void>;
  findAll(options?: {
    page?: number;
    limit?: number;
    tier?: string;
    search?: string;
  }): Promise<{ data: MemberWithTier[]; total: number }>;
  createTransaction(
    data: Prisma.MemberTransactionUncheckedCreateInput,
  ): Promise<void>;
  getTransactionHistory(memberId: string, limit?: number): Promise<any[]>;
}
