<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/services/api.client';

	let otp: string = $state('');
	let error: string = $state('');
	let is_loading: boolean = $state(false);
	let admin_email: string = $state('');

	$effect(() => {
		const email = sessionStorage.getItem('admin_email');
		if (!email) {
			goto('/login-admin');
			return;
		}
		admin_email = email;
	});

	function handle_otp_input(num: string) {
		if (otp.length < 6) {
			otp += num;
		}
		error = '';
	}

	function delete_otp() {
		otp = otp.slice(0, -1);
		error = '';
	}

	function clear_otp() {
		otp = '';
		error = '';
	}

	async function verify_otp() {
		if (otp.length !== 6) {
			error = 'Masukkan 6 digit kode OTP';
			return;
		}

		is_loading = true;
		error = '';

		try {
			const res = await api.request(`/auth/verify-otp`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: admin_email, otp })
			});
			const data = await res.json();

			if (data.success) {
				sessionStorage.removeItem('admin_email');
				// User data is stored in sessionStorage (non-sensitive, ephemeral)
				// Access token should be httpOnly cookie from backend
				// CSRF protection handled via SameSite cookies by backend
				goto('/admin/dashboard');
			} else {
				error = data.message || 'Kode OTP salah. Periksa email Anda.';
				clear_otp();
			}
		} catch {
			error = 'Gagal verifikasi OTP. Pastikan koneksi internet stabil.';
			clear_otp();
		} finally {
			is_loading = false;
		}
	}

	async function resend_otp() {
		is_loading = true;
		error = '';
		try {
			const res = await api.request(`/auth/resend-otp`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: admin_email })
			});
			const data = await res.json();
			if (data.success) {
				error = '';
				// Show success message briefly
				const msgEl = document.getElementById('resend-msg');
				if (msgEl) {
					msgEl.textContent = 'Kode OTP baru telah dikirim!';
					msgEl.className = 'text-sm font-medium text-green-400';
					setTimeout(() => {
						if (msgEl) {
							msgEl.textContent = `Tidak menerima kode?`;
							msgEl.className = 'text-sm font-medium text-slate-400';
						}
					}, 3000);
				}
			} else {
				error = data.message || 'Gagal mengirim ulang OTP';
			}
		} catch {
			error = 'Gagal mengirim ulang OTP';
		} finally {
			is_loading = false;
		}
	}
</script>

<div
	class="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-900 via-indigo-900 to-purple-900 p-4"
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
						d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
					></path></svg
				>
			</div>
			<h1 class="mb-2 text-3xl font-black tracking-tight text-white">Verifikasi OTP</h1>
			<p class="text-sm font-medium text-slate-400">
				Kode telah dikirim ke<br />
				<span class="font-bold text-indigo-300">{admin_email}</span>
			</p>
		</div>

		<!-- OTP Form -->
		<div class="flex-1 px-8 pb-4">
			<div class="flex flex-col items-center">
				<!-- OTP dots -->
				<div class="mb-8 flex justify-center gap-4">
					{#each Array(6) as _, i}
						<div
							class="flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-150 {otp.length >
							i
								? 'scale-110 border-indigo-400 bg-indigo-500'
								: 'scale-100 border-slate-600 bg-slate-800'}"
						>
							{#if otp.length > i}
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
				{/if}

				<!-- Number pad -->
				<div class="grid w-full max-w-xs grid-cols-3 gap-3">
					{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as num}
						<button
							class="h-16 rounded-2xl bg-slate-800/80 text-2xl font-bold text-white transition-all hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
							onclick={() => handle_otp_input(num)}
							disabled={is_loading || otp.length >= 6}
						>
							{num}
						</button>
					{/each}
					<button
						class="flex h-16 items-center justify-center rounded-2xl bg-slate-800/80 text-xl text-slate-400 transition-all hover:bg-red-500/20 hover:text-red-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
						onclick={clear_otp}
						disabled={is_loading || otp.length === 0}
						aria-label="Hapus semua input OTP"
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
						onclick={() => handle_otp_input('0')}
						disabled={is_loading || otp.length >= 6}
					>
						0
					</button>
					<button
						class="flex h-16 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-400 transition-all hover:bg-slate-700 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
						onclick={delete_otp}
						disabled={is_loading || otp.length === 0}
						aria-label="Hapus digit terakhir OTP"
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

				<!-- Resend OTP -->
				<div class="mt-6 text-center">
					<button
						onclick={resend_otp}
						disabled={is_loading}
						class="text-sm font-medium text-slate-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
					>
						<span id="resend-msg">Tidak menerima kode?</span>
					</button>
				</div>

				<!-- Submit -->
				<button
					class="mt-8 h-14 w-full max-w-xs rounded-xl font-bold tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-50 {otp.length ===
						6 && !is_loading
						? 'bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-500 hover:to-purple-500 active:scale-98'
						: 'bg-slate-700 text-slate-500'}"
					disabled={otp.length < 6 || is_loading}
					onclick={verify_otp}
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
						VERIFIKASI
					{/if}
				</button>
			</div>
		</div>

		<!-- Back -->
		<div class="border-t border-slate-700/50 p-6 text-center">
			<button
				onclick={() => {
					sessionStorage.removeItem('admin_email');
					goto('/login-admin');
				}}
				class="text-sm font-medium text-slate-400 transition-colors hover:text-white"
			>
				← Kembali ke Login Admin
			</button>
		</div>
	</div>
</div>
