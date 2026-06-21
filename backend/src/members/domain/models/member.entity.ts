export interface MemberEntity {
  id: string;
  member_code: string;
  phone: string;
  name: string;
  email: string | null;
  loyalty_points: number;
  tier_id: string | null;
  tier_name: string | null;
  registered_at: Date;
  registered_via: string;
  is_active: boolean;
  can_earn: boolean;
  cooldown_until: Date | null;
}

export interface MemberTransactionEntity {
  id: string;
  member_id: string;
  type: 'earn' | 'redeem' | 'adjust' | 'void_revoke' | 'void_restore';
  points: number;
  balance_after: number;
  description: string | null;
  created_at: Date;
}
