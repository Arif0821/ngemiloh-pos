<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/services/api.client';

	let current_pin: string = $state('');
	let new_pin: string = $state('');
	let confirm_pin: string = $state('');
	let error: string = $state('');
	let is_loading: boolean = $state(false);

	// Ambil user dari localStorage (disimpan saat login dengan must_change_pin=true)
	let pending_user = $state<{ id: string; name: string; role: string } | null>(null);

	$effect(() => {
		const stored = localStorage.getItem('pending_pin_change');
		if (stored) {
			try {
				pending_user = JSON.parse(stored);
			} catch {
				goto('/login');
			}
		} else {
			// Tidak ada pending change — redirect ke login
			goto('/login');
		}
	});

	function handle_pin_input(target: 'current' | 'new' | 'confirm', num: string) {
		if (target === 'current' && current_pin.length < 6) current_pin += num;
		if (target === 'new' && new_pin.length < 6) new_pin += num;
		if (target === 'confirm' && confirm_pin.length < 6) confirm_pin += num;
		error = '';
	}

	function delete_pin(target: 'current' | 'new' | 'confirm') {
		if (target === 'current') current_pin = current_pin.slice(0, -1);
		if (target === 'new') new_pin = new_pin.slice(0, -1);
		if (target === 'confirm') confirm_pin = confirm_pin.slice(0, -1);
		error = '';
	}

	function clear_all() {
		current_pin = '';
		new_pin = '';
		confirm_pin = '';
		error = '';
	}

	async function changePin() {
		// Validasi
		if (current_pin.length < 4 || current_pin.length > 6) {
			error = 'PIN saat ini harus 4-6 digit';
			return;
		}
		if (new_pin.length < 4 || new_pin.length > 6) {
			error = 'PIN baru harus 4-6 digit';
			return;
		}
		if (new_pin !== confirm_pin) {
			error = 'PIN baru dan konfirmasi PIN tidak cocok';
			return;
		}
		if (new_pin === current_pin) {
			error = 'PIN baru tidak boleh sama dengan PIN saat ini';
			return;
		}

		is_loading = true;
		error = '';

		try {
			const res = await api.request(`/auth/change-pin`, {
				method: 'PATCH',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ current_pin, new_pin })
			});
			const data = await res.json();

			if (data.success) {
				// Simpan user info
				localStorage.setItem('user', JSON.stringify(data.data));
				localStorage.removeItem('pending_pin_change');
				goto('/pos');
			} else {
				error = data.message || 'Gagal mengganti PIN. Periksa PIN saat ini.';
				clear_all();
			}
		} catch (err) {
			error = 'Gagal terhubung ke server.';
			clear_all();
		} finally {
			is_loading = false;
		}
	}

	function render_dots(value: string) {
		return Array(6)
			.fill(0)
			.map((_, i) => i < value.length);
	}
</script>

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 p-4"
>
	<div
		class="flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-900/80 shadow-2xl backdrop-blur-xl"
	>
		<!-- Header -->
		<div class="p-8 pb-4 text-center">
			<div
				class="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30"
			>
				<svg class="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
					></path></svg
				>
			</div>
			<h1 class="mb-2 text-3xl font-black tracking-tight text-white">Ganti PIN</h1>
			<p class="text-sm font-medium text-slate-400">
				{pending_user ? `Halo, ${pending_user.name}` : ''} — Silakan ganti PIN baru Anda
			</p>
		</div>

		<!-- PIN Forms -->
		<div class="flex-1 px-8 pb-4">
			<div class="flex flex-col items-center gap-6">
				<!-- Error message -->
				{#if error}
					<div
						class="w-full max-w-xs rounded-xl border border-red-500/50 bg-red-500/20 px-4 py-3 text-sm font-bold text-red-400"
					>
						{error}
					</div>
				{/if}

				<!-- PIN saat ini -->
				<div class="w-full max-w-xs text-center">
					<p class="mb-3 text-xs font-medium tracking-wider text-slate-500 uppercase">
						PIN Saat Ini
					</p>
					<div class="mb-3 flex justify-center gap-3">
						{#each render_dots(current_pin) as filled}
							<div
								class="flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all {filled
									? 'scale-110 border-amber-400 bg-amber-500'
									: 'scale-100 border-slate-600 bg-slate-800'}"
							>
								{#if filled}<div class="h-1.5 w-1.5 rounded-full bg-white"></div>{/if}
							</div>
						{/each}
					</div>
					<div class="grid w-full grid-cols-3 gap-2">
						{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as key}
							<button
								class="h-12 rounded-xl text-lg font-bold transition-all active:scale-95 {key === 'C'
									? 'bg-slate-800/80 text-slate-400 hover:bg-red-500/20 hover:text-red-400'
									: key === '⌫'
										? 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white'
										: 'bg-slate-800/80 text-white hover:bg-slate-700'}"
								onclick={() => {
									if (key === 'C') clear_all();
									else if (key === '⌫') delete_pin('current');
									else handle_pin_input('current', key);
								}}
								disabled={is_loading}
							>
								{key}
							</button>
						{/each}
					</div>
				</div>

				<!-- PIN baru -->
				<div class="w-full max-w-xs text-center">
					<p class="mb-3 text-xs font-medium tracking-wider text-slate-500 uppercase">PIN Baru</p>
					<div class="mb-3 flex justify-center gap-3">
						{#each render_dots(new_pin) as filled}
							<div
								class="flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all {filled
									? 'scale-110 border-green-400 bg-green-500'
									: 'scale-100 border-slate-600 bg-slate-800'}"
							>
								{#if filled}<div class="h-1.5 w-1.5 rounded-full bg-white"></div>{/if}
							</div>
						{/each}
					</div>
					<div class="grid w-full grid-cols-3 gap-2">
						{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as key}
							<button
								class="h-12 rounded-xl text-lg font-bold transition-all active:scale-95 {key === 'C'
									? 'bg-slate-800/80 text-slate-400 hover:bg-red-500/20 hover:text-red-400'
									: key === '⌫'
										? 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white'
										: 'bg-slate-800/80 text-white hover:bg-slate-700'}"
								onclick={() => {
									if (key === 'C') clear_all();
									else if (key === '⌫') delete_pin('new');
									else handle_pin_input('new', key);
								}}
								disabled={is_loading}
							>
								{key}
							</button>
						{/each}
					</div>
				</div>

				<!-- Konfirmasi PIN baru -->
				<div class="w-full max-w-xs text-center">
					<p class="mb-3 text-xs font-medium tracking-wider text-slate-500 uppercase">
						Konfirmasi PIN Baru
					</p>
					<div class="mb-3 flex justify-center gap-3">
						{#each render_dots(confirm_pin) as filled}
							<div
								class="flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all {filled
									? 'scale-110 border-indigo-400 bg-indigo-500'
									: 'scale-100 border-slate-600 bg-slate-800'}"
							>
								{#if filled}<div class="h-1.5 w-1.5 rounded-full bg-white"></div>{/if}
							</div>
						{/each}
					</div>
					<div class="grid w-full grid-cols-3 gap-2">
						{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as key}
							<button
								class="h-12 rounded-xl text-lg font-bold transition-all active:scale-95 {key === 'C'
									? 'bg-slate-800/80 text-slate-400 hover:bg-red-500/20 hover:text-red-400'
									: key === '⌫'
										? 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white'
										: 'bg-slate-800/80 text-white hover:bg-slate-700'}"
								onclick={() => {
									if (key === 'C') clear_all();
									else if (key === '⌫') delete_pin('confirm');
									else handle_pin_input('confirm', key);
								}}
								disabled={is_loading}
							>
								{key}
							</button>
						{/each}
					</div>
				</div>

				<!-- Submit -->
				<button
					class="mt-2 h-14 w-full max-w-xs rounded-xl font-bold tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-50 {current_pin.length >=
						4 &&
					new_pin.length >= 4 &&
					confirm_pin.length >= 4 &&
					!is_loading
						? 'bg-linear-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/30 hover:from-amber-500 hover:to-orange-500 active:scale-98'
						: 'bg-slate-700 text-slate-500'}"
					disabled={current_pin.length < 4 ||
						new_pin.length < 4 ||
						confirm_pin.length < 4 ||
						is_loading}
					onclick={changePin}
				>
					{#if is_loading}
						<span class="flex items-center justify-center gap-2">
							<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"
								><circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle><path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
								></path></svg
							>
							Memproses...
						</span>
					{:else}
						SIMPAN PIN BARU
					{/if}
				</button>
			</div>
		</div>

		<!-- Back to login -->
		<div class="border-t border-slate-700/50 p-6 text-center">
			<a
				href="/login"
				class="text-sm font-medium text-slate-400 transition-colors hover:text-white"
			>
				← Kembali ke Login
			</a>
		</div>
	</div>
</div>
