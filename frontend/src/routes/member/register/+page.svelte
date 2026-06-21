<script lang="ts">
	import { page } from '$app/stores';
	import { member_service } from '$lib/services/member.service';
	import { goto } from '$app/navigation';

	let name = $state('');
	let phone = $state('');
	let email = $state('');
	let is_loading = $state(false);
	let error = $state('');
	let success = $state(false);
	let registered_member = $state<any>(null);

	let ref_code = $derived($page.url.searchParams.get('ref'));

	async function handle_submit() {
		if (!name.trim() || !phone.trim()) {
			error = 'Nama dan HP wajib diisi';
			return;
		}

		if (!/^[0-9]{8,15}$/.test(phone)) {
			error = 'No. HP tidak valid';
			return;
		}

		is_loading = true;
		error = '';

		try {
			const result = await member_service.register({
				name: name.trim(),
				phone: phone.trim(),
				email: email.trim() || undefined,
				ref_code: ref_code || undefined,
			});

			if (result.success) {
				success = true;
				registered_member = result.data;
			} else {
				error = result.message || 'Registrasi gagal';
			}
		} catch (e) {
			error = 'Terjadi kesalahan. Silakan coba lagi.';
		} finally {
			is_loading = false;
		}
	}
</script>

<div class="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
	<div class="mx-auto max-w-md px-4 py-12">
		{#if success && registered_member}
			<!-- Success Card -->
			<div class="rounded-2xl bg-white p-8 shadow-xl">
				<div class="mb-6 text-center">
					<div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
						<svg class="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<h1 class="text-2xl font-black text-slate-800">Pendaftaran Berhasil!</h1>
					<p class="mt-2 text-slate-500">Selamat datang di NGEMILOH Members</p>
				</div>

				<!-- Member Card -->
				<div class="rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 p-6">
					<div class="mb-4 text-center">
						<div class="mb-2 text-3xl">🏪 NGEMILOH</div>
						<div class="text-sm font-bold text-amber-700">MEMBERSHIP CARD</div>
					</div>

					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-slate-600">Nama</span>
							<span class="font-bold text-slate-800">{registered_member.name}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-slate-600">Member ID</span>
							<span class="font-mono font-bold text-slate-800">{registered_member.member_code}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-slate-600">Tier</span>
							<span class="font-bold text-amber-600">{registered_member.tier}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-slate-600">Poin</span>
							<span class="font-bold text-blue-600">{registered_member.loyalty_points} pts</span>
						</div>
					</div>
				</div>

				<div class="mt-6 text-center text-sm text-slate-500">
					<p>Tunjukkan kartu ini saat checkout untuk mendapatkan poin!</p>
					<p class="mt-2">5 poin per Rp 1.000 pembelian</p>
				</div>

				<button
					onclick={() => goto('/')}
					class="mt-6 w-full rounded-lg bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700"
				>
					🛒 Mulai Belanja
				</button>
			</div>
		{:else}
			<!-- Registration Form -->
			<div class="rounded-2xl bg-white p-8 shadow-xl">
				<div class="mb-6 text-center">
					<h1 class="text-2xl font-black text-slate-800">📋 Daftar Member</h1>
					<p class="mt-2 text-slate-500">Daftar gratis dan dapatkan poin dari setiap pembelian!</p>
				</div>

				<form onsubmit={(e) => { e.preventDefault(); handle_submit(); }} class="space-y-4">
					<div>
						<label for="name" class="mb-1 block text-sm font-medium text-slate-700">
							Nama Lengkap <span class="text-red-500">*</span>
						</label>
						<input
							id="name"
							type="text"
							bind:value={name}
							placeholder="Masukkan nama lengkap"
							class="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
							required
						/>
					</div>

					<div>
						<label for="phone" class="mb-1 block text-sm font-medium text-slate-700">
							No. HP <span class="text-red-500">*</span>
						</label>
						<input
							id="phone"
							type="tel"
							bind:value={phone}
							placeholder="08xxxxxxxxxx"
							class="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
							required
						/>
					</div>

					<div>
						<label for="email" class="mb-1 block text-sm font-medium text-slate-700">
							Email <span class="text-xs text-slate-400">(opsional)</span>
						</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							placeholder="email@contoh.com"
							class="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
						/>
					</div>

					{#if error}
						<div class="rounded-lg bg-red-50 p-3 text-sm text-red-600">
							{error}
						</div>
					{/if}

					<button
						type="submit"
						disabled={is_loading}
						class="w-full rounded-lg bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
					>
						{is_loading ? 'Mendaftarkan...' : '📝 Daftar Sekarang'}
					</button>
				</form>

				<div class="mt-6 text-center text-xs text-slate-400">
					<p>Dengan mendaftar, Anda menyetujui syarat & ketentuan</p>
					<p class="mt-1">program loyalty NGEMILOH</p>
				</div>
			</div>

			<!-- Benefits -->
			<div class="mt-6 rounded-xl bg-white p-6 shadow">
				<h3 class="mb-4 font-bold text-slate-800">🌟 Keuntungan Member</h3>
				<ul class="space-y-2 text-sm text-slate-600">
					<li class="flex items-center gap-2">
						<span class="text-emerald-500">✓</span>
						<span>Dapatkan 5 poin setiap Rp 1.000 belanja</span>
					</li>
					<li class="flex items-center gap-2">
						<span class="text-emerald-500">✓</span>
						<span>Tukar 100 poin = Rp 1.000 discount</span>
					</li>
					<li class="flex items-center gap-2">
						<span class="text-emerald-500">✓</span>
						<span>Tier Bronze → Silver → Gold → Platinum</span>
					</li>
					<li class="flex items-center gap-2">
						<span class="text-emerald-500">✓</span>
						<span>Benefit tambahan untuk tier tinggi</span>
					</li>
				</ul>
			</div>
		{/if}
	</div>
</div>
