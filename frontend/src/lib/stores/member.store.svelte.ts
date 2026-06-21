import { member_service } from '$lib/services/member.service';
import type { MemberData } from '$lib/domain/models/types';

class MemberStore {
	current_member: MemberData | null = $state(null);
	is_loading = $state(false);
	error: string | null = $state(null);
	show_lookup_modal = $state(false);
	redeem_pending = $state(false);
	selected_for_redeem = $state(false);

	async lookup(identifier: { phone?: string; code?: string; qr?: string }) {
		this.is_loading = true;
		this.error = null;
		try {
			const result = await member_service.pos_lookup(identifier);
			if (result.success) {
				this.current_member = result.data;
			} else {
				this.error = result.message || 'Member tidak ditemukan';
				this.current_member = null;
			}
		} catch {
			this.error = 'Gagal mencari member';
			this.current_member = null;
		} finally {
			this.is_loading = false;
		}
	}

	async process_points(data: {
		order_id?: string;
		transaction_subtotal: number;
		redeem_requested: boolean;
	}) {
		if (!this.current_member) return null;

		this.redeem_pending = true;
		try {
			const result = await member_service.process_points({
				member_id: this.current_member.id,
				...data
			});

			if (result.success) {
				if (this.current_member) {
					this.current_member = {
						...this.current_member,
						loyalty_points: result.data.new_balance,
						points_value: Math.floor(result.data.new_balance / 5) * 1000,
						tier: result.data.tier
					};
				}
			}

			return result;
		} finally {
			this.redeem_pending = false;
		}
	}

	clear() {
		this.current_member = null;
		this.error = null;
		this.show_lookup_modal = false;
		this.selected_for_redeem = false;
	}

	get format_points_value() {
		if (!this.current_member) return 'Rp 0';
		const value = Math.floor(this.current_member.loyalty_points / 5) * 1000;
		return `Rp ${value.toLocaleString('id-ID')}`;
	}

	get can_earn() {
		if (!this.current_member) return false;
		if (!this.current_member.can_earn) return false;
		if (this.current_member.cooldown_until) {
			return new Date(this.current_member.cooldown_until) < new Date();
		}
		return true;
	}
}

export const member_store = new MemberStore();
