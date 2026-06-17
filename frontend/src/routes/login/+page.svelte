<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { goto } from '$app/navigation';

	// Kasir Login - Username + PIN (sesuai backend auth.service.ts)
	// Kasir login dengan username (dari admin) + PIN 4-6 digit
	let username = $state('');
	let pin: string = $state('');
	let error: string = $state('');
	let is_loading: boolean = $state(false);

	function handle_pin_input(num: string) {
		if (pin.length < 6) {
			pin += num;
		}
		error = '';
	}

	function delete_pin() {
		pin = pin.slice(0, -1);
		error = '';
	}

	function clear_pin() {
		pin = '';
		error = '';
	}

	async function login() {
		// Validasi username
		if (!username.trim()) {
			error = 'Masukkan username kasir';
			return;
		}
		// Validasi PIN 4-6 digit
		if (pin.length < 4 || pin.length > 6) {
			error = 'PIN harus 4-6 digit angka';
			return;
		}

		is_loading = true;
		error = '';

		try {
			// Payload sesuai backend: { username, pin }
			const payload = { username: username.trim(), pin };

			const res = await api.request(`/auth/login`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await res.json();

			if (data.success || data.accessToken || data.data) {
				// Login berhasil - cek apakah perlu ganti PIN (AUTH-13)
				const user_data = data.data || data;
				if (user_data.must_change_pin) {
					// Simpan user ke localStorage untuk change-pin page
					localStorage.setItem('pending_pin_change', JSON.stringify(user_data));
					goto('/change-pin');
				} else {
					// Simpan user info ke localStorage (untuk role guard di layout)
					localStorage.setItem('user', JSON.stringify(user_data));
					goto('/pos');
				}
			} else {
				error = data.message || 'Login gagal. Periksa username dan PIN.';
				clear_pin();
			}
		} catch (err) {
			error = 'Gagal terhubung ke server. Pastikan koneksi internet stabil.';
			clear_pin();
		} finally {
			is_loading = false;
		}
	}

	function handle_keydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && pin.length >= 4) {
			login();
		}
	}
</script>

<svelte:window onkeydown={handle_keydown} />

<div
	class="flex min-h-screen items-center justify-center bg-linear-to-br from-indigo-900 via-purple-900 to-slate-900 p-4"
>
	<div
		class="flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-900/80 shadow-2xl backdrop-blur-xl"
	>
		<!-- Header -->
		<div class="p-8 pb-4 text-center">
			<div
				class="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30"
			>
				<svg class="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 10V3L4 14h7v7l9-11h-7z"
					></path></svg
				>
			</div>
			<h1 class="mb-2 text-3xl font-black tracking-tight text-white">Ngemiloh</h1>
			<p class="text-sm font-medium text-slate-400">Masukkan username dan PIN kasir</p>
		</div>

		<!-- Login Form -->
		<div class="flex-1 px-8 pb-4">
			<div class="flex flex-col items-center">
				<!-- Username Input -->
				<div class="mb-6 w-full max-w-xs">
					<input
						type="text"
						bind:value={username}
						placeholder="Username Kasir"
						autocomplete="username"
						disabled={is_loading}
						class="w-full rounded-xl border-2 border-slate-600 bg-slate-800/80 px-4 py-3 text-center text-lg font-bold text-white placeholder-slate-500 transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none disabled:opacity-50"
					/>
				</div>

				<!-- PIN dots -->
				<div class="mb-8 flex justify-center gap-4">
					{#each Array(6) as _, i}
						<div
							class="flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-150 {pin.length >
							i
								? 'scale-110 border-indigo-400 bg-indigo-500'
								: 'scale-100 border-slate-600 bg-slate-800'}"
						>
							{#if pin.length > i}
								<div class="h-2 w-2 rounded-full bg-white"></div>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Error message -->
				{#if error}
					<div
						class="mb-6 rounded-xl border border-red-500/50 bg-red-500/20 px-4 py-3 text-sm font-bold text-red-400"
					>
						{error}
					</div>
				{:else}
					<p class="mb-6 text-center text-xs font-medium text-slate-500">
						Masukkan PIN 4-6 digit Anda
					</p>
				{/if}

				<!-- Number pad -->
				<div class="grid w-full max-w-xs grid-cols-3 gap-3">
					{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as num}
						<button
							class="h-16 rounded-2xl bg-slate-800/80 text-2xl font-bold text-white transition-all hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
							onclick={() => handle_pin_input(num)}
							disabled={is_loading || pin.length >= 6}
						>
							{num}
						</button>
					{/each}
					<button
						class="flex h-16 items-center justify-center rounded-2xl bg-slate-800/80 text-xl text-slate-400 transition-all hover:bg-red-500/20 hover:text-red-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
						onclick={clear_pin}
						disabled={is_loading || pin.length === 0}
						aria-label="Hapus semua input PIN"
					>
						<svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							></path></svg
						>
					</button>
					<button
						class="h-16 rounded-2xl bg-slate-800/80 text-2xl font-bold text-white transition-all hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
						onclick={() => handle_pin_input('0')}
						disabled={is_loading || pin.length >= 6}
					>
						0
					</button>
					<button
						class="flex h-16 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-400 transition-all hover:bg-slate-700 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
						onclick={delete_pin}
						disabled={is_loading || pin.length === 0}
						aria-label="Hapus digit terakhir PIN"
					>
						<svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"
							></path></svg
						>
					</button>
				</div>

				<!-- Login button -->
				<button
					class="mt-8 h-14 w-full max-w-xs rounded-xl font-bold tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-50 {pin.length >=
						4 &&
					username.trim() &&
					!is_loading
						? 'bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-500 hover:to-purple-500 active:scale-98'
						: 'bg-slate-700 text-slate-500'}"
					disabled={pin.length < 4 || !username.trim() || is_loading}
					onclick={login}
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
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path></svg
							>
							Memproses...
						</span>
					{:else}
						MASUK
					{/if}
				</button>
			</div>
		</div>

		<!-- Admin login link -->
		<div class="border-t border-slate-700/50 p-6 text-center">
			<a
				href="/login-admin"
				class="text-sm font-medium text-slate-400 transition-colors hover:text-white"
			>
				Login sebagai Admin
			</a>
		</div>
	</div>
</div>
