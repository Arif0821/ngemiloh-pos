<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let isLoading = $state(false);

	async function handleLogin() {
		error = '';
		isLoading = true;

		try {
			const hostname = window.location.hostname;
			const res = await api.request(`/api/v1/auth/login`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: email, pin: password }) // API uses 'username' and 'pin' internally for both types
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.message || 'Login gagal');
			}

			const data = await res.json();

			if (data.data.role !== 'superadmin') {
				throw new Error('Akses ditolak: Hanya Superadmin yang diizinkan');
			}

			// Store in localStorage for layout guards
			localStorage.setItem('user', JSON.stringify(data.data));

			// Redirect to admin dashboard
			goto('/admin/dashboard');
		} catch (err: any) {
			error = err.message;
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		const userStr = localStorage.getItem('user');
		if (userStr) {
			const user = JSON.parse(userStr);
			if (user.role === 'superadmin') {
				goto('/admin/dashboard');
			}
		}
	});
</script>

<svelte:head>
	<title>Superadmin Login - Ngemiloh</title>
</svelte:head>

<div class="flex min-h-screen flex-col justify-center bg-slate-900 py-12 sm:px-6 lg:px-8">
	<div class="sm:mx-auto sm:w-full sm:max-w-md">
		<div class="text-center">
			<div
				class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600"
			>
				<svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
					/>
				</svg>
			</div>
			<h2 class="text-3xl font-extrabold text-white">Superadmin Portal</h2>
			<p class="mt-2 text-sm text-slate-400">
				Gunakan kredensial admin Anda untuk mengelola inventori.
			</p>
		</div>

		<div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
			<div
				class="border border-slate-700 bg-slate-800 px-4 py-8 shadow-2xl sm:rounded-2xl sm:px-10"
			>
				{#if error}
					<div class="mb-6 rounded-md border-l-4 border-red-500 bg-red-900/50 p-4">
						<div class="flex">
							<div class="flex-shrink-0">
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

				<form class="space-y-6" on:submit|preventDefault={handleLogin}>
					<div>
						<label for="email" class="block text-sm font-medium text-slate-300">Email Admin</label>
						<div class="relative mt-1 rounded-md shadow-sm">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
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
										d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
									/>
								</svg>
							</div>
							<input
								id="email"
								name="email"
								type="email"
								bind:value={email}
								required
								class="block w-full rounded-xl border border-slate-600 bg-slate-900 py-3 pr-3 pl-10 leading-5 text-slate-200 placeholder-slate-400 transition-colors duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none sm:text-sm"
								placeholder="admin@ngemiloh.com"
							/>
						</div>
					</div>

					<div>
						<label for="password" class="block text-sm font-medium text-slate-300">Kata Sandi</label
						>
						<div class="relative mt-1 rounded-md shadow-sm">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
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
								bind:value={password}
								required
								class="block w-full rounded-xl border border-slate-600 bg-slate-900 py-3 pr-3 pl-10 leading-5 text-slate-200 placeholder-slate-400 transition-colors duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none sm:text-sm"
								placeholder="••••••••"
							/>
						</div>
					</div>

					<div>
						<button
							type="submit"
							disabled={isLoading || !email || !password}
							class="flex w-full justify-center rounded-xl border border-transparent bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if isLoading}
								<svg
									class="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
									fill="none"
									viewBox="0 0 24 24"
								>
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
								Masuk...
							{:else}
								Login Superadmin
							{/if}
						</button>
					</div>
				</form>

				<div class="mt-6 text-center">
					<a href="/login" class="text-sm font-medium text-indigo-400 hover:text-indigo-300">
						&larr; Kembali ke Login Kasir
					</a>
				</div>
			</div>
		</div>
	</div>
</div>
