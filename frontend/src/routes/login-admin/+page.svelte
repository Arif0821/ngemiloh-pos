<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let is_loading = $state(false);

	async function handle_login() {
		error = '';
		is_loading = true;

		try {
			// Admin login - sesuai PRD v5.0 AUTH-02/AUTH-03
			// Step 1: Login dengan email + password
			const res = await api.request(`/auth/login`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.message || 'Login gagal');
			}

			const data = await res.json();

			// Cek apakah perlu verifikasi OTP (PRD v5.0 AUTH-03)
			if (data.require_otp) {
				// Simpan state untuk step OTP
				sessionStorage.setItem('admin_email', email);
				goto('/login-admin/verify-otp');
				return;
			}

			// Defense-in-depth: Backend sudah menolak non-superadmin di auth.service.ts
			// Check ini sebagai validasi tambahan di frontend
			if (data.data?.role !== 'superadmin') {
				throw new Error('Akses ditolak: Hanya Superadmin yang diizinkan');
			}

			// SECURITY FIX F-01: CSRF token is now set as httpOnly cookie by backend
			// No need to store in localStorage anymore
			// Store user data in localStorage for layout guards
			localStorage.setItem('user', JSON.stringify(data.data));

			// Redirect to admin dashboard
			goto('/admin/dashboard');
		} catch (err: any) {
			error = err.message;
		} finally {
			is_loading = false;
		}
	}

	onMount(() => {
		const user_str = localStorage.getItem('user');
		if (user_str) {
			const user = JSON.parse(user_str);
			if (user.role === 'superadmin') {
				goto('/admin/dashboard');
			}
		}
	});
</script>

<svelte:head>
	<title>Superadmin Login - Ngemiloh</title>
</svelte:head>

<div
	class="flex min-h-screen flex-col justify-center bg-linear-to-br from-slate-900 via-indigo-900 to-purple-900 px-4 py-12 sm:px-6 lg:px-8"
>
	<div class="sm:mx-auto sm:w-full sm:max-w-md">
		<div class="text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-500/30"
			>
				<svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
					/>
				</svg>
			</div>
			<h2 class="text-3xl font-extrabold text-white">Superadmin Portal</h2>
			<p class="mt-2 text-sm text-slate-400">Kelola inventori dan laporan bisnis Anda</p>
		</div>

		<div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
			<div
				class="border border-slate-700/50 bg-slate-900/80 px-4 py-8 shadow-2xl backdrop-blur-xl sm:rounded-2xl sm:px-10"
			>
				{#if error}
					<div class="mb-6 rounded-xl border border-red-500/50 bg-red-500/20 p-4">
						<div class="flex">
							<div class="shrink-0">
								<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
							<div class="ml-3">
								<p class="text-sm text-red-200">{error}</p>
							</div>
						</div>
					</div>
				{/if}

				<form
					class="space-y-6"
					onsubmit={(e) => {
						e.preventDefault();
						handle_login();
					}}
				>
					<div>
						<label for="email" class="block text-sm font-medium text-slate-300">Email Admin</label>
						<div class="relative mt-1 rounded-xl shadow-sm">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
								<svg
									class="h-5 w-5 text-slate-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
									/>
								</svg>
							</div>
							<input
								id="email"
								name="email"
								type="email"
								autocomplete="email"
								bind:value={email}
								required
								class="block w-full rounded-xl border border-slate-600 bg-slate-800/50 py-3 pr-4 pl-12 text-slate-200 placeholder-slate-400 transition-colors duration-200 focus:border-indigo-500 focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none sm:text-sm"
								placeholder="admin@ngemiloh.com"
							/>
						</div>
					</div>

					<div>
						<label for="password" class="block text-sm font-medium text-slate-300">Kata Sandi</label
						>
						<div class="relative mt-1 rounded-xl shadow-sm">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
								<svg
									class="h-5 w-5 text-slate-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
									/>
								</svg>
							</div>
							<input
								id="password"
								name="password"
								type="password"
								autocomplete="current-password"
								bind:value={password}
								required
								class="block w-full rounded-xl border border-slate-600 bg-slate-800/50 py-3 pr-4 pl-12 text-slate-200 placeholder-slate-400 transition-colors duration-200 focus:border-indigo-500 focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none sm:text-sm"
								placeholder="••••••••"
							/>
						</div>
					</div>

					<div>
						<button
							type="submit"
							disabled={is_loading || !email || !password}
							class="flex w-full justify-center rounded-xl border border-transparent bg-linear-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/30 transition-all duration-200 hover:from-indigo-500 hover:to-purple-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if is_loading}
								<span class="flex items-center gap-2">
									<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle
											class="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											stroke-width="4"
										></circle>
										<path
											class="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										></path>
									</svg>
									Memproses...
								</span>
							{:else}
								Login Superadmin
							{/if}
						</button>
					</div>
				</form>

				<div class="mt-6 text-center">
					<a
						href="/login"
						class="text-sm font-medium text-indigo-400 transition-colors hover:text-indigo-300"
					>
						&larr; Kembali ke Login Kasir
					</a>
				</div>
			</div>
		</div>
	</div>
</div>
