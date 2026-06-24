import { api } from './api.client';
import type {
	ApiResponse,
	MemberData,
	MemberTransactionData,
	ProcessPointsResponse,
	MemberStats
} from '../domain/models/types';

export class MemberService {
	async register(data: { name: string; phone: string; email?: string; ref_code?: string }) {
		const res = await api.post('/member/register', data);
		const json: ApiResponse<MemberData> = await res.json();
		return json;
	}

	async lookup(identifier: { phone?: string; code?: string; qr?: string }) {
		const params = new URLSearchParams();
		if (identifier.phone) params.append('phone', identifier.phone);
		if (identifier.code) params.append('code', identifier.code);
		if (identifier.qr) params.append('qr', identifier.qr);

		const res = await api.get(`/member/lookup?${params.toString()}`);
		const json: ApiResponse<MemberData> = await res.json();
		return json;
	}

	async pos_lookup(identifier: { phone?: string; code?: string; qr?: string }) {
		const params = new URLSearchParams();
		if (identifier.phone) params.append('phone', identifier.phone);
		if (identifier.code) params.append('code', identifier.code);
		if (identifier.qr) params.append('qr', identifier.qr);

		const res = await api.get(`/pos/member/lookup?${params.toString()}`, {
			credentials: 'include'
		});
		const json: ApiResponse<MemberData> = await res.json();
		return json;
	}

	async process_points(data: {
		member_id: string;
		order_id?: string;
		transaction_subtotal: number;
		redeem_requested: boolean;
	}) {
		const res = await api.post('/pos/member/process', data, {
			credentials: 'include'
		});
		const json: ApiResponse<ProcessPointsResponse> = await res.json();
		return json;
	}

	async get_members(options?: { page?: number; limit?: number; tier?: string; search?: string }) {
		const params = new URLSearchParams();
		if (options?.page) params.append('page', String(options.page));
		if (options?.limit) params.append('limit', String(options.limit));
		if (options?.tier) params.append('tier', options.tier);
		if (options?.search) params.append('search', options.search);

		const res = await api.get(`/admin/members?${params.toString()}`, {
			credentials: 'include'
		});
		const json: ApiResponse<{ data: MemberData[]; total: number }> = await res.json();
		return json;
	}

	async get_member_detail(id: string) {
		const res = await api.get(`/admin/members/${id}`, {
			credentials: 'include'
		});
		const json: ApiResponse<MemberData & { transactions: MemberTransactionData[] }> =
			await res.json();
		return json;
	}

	async get_stats() {
		const res = await api.get('/admin/members/stats', {
			credentials: 'include'
		});
		const json: ApiResponse<MemberStats> = await res.json();
		return json;
	}
}

export const member_service = new MemberService();
