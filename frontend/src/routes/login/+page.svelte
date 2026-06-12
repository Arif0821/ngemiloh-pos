<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { slide } from 'svelte/transition';

	let loginMode: 'kasir' | 'superadmin' = $state('kasir');

	// Kasir Form
	let kasirUsername: string = $state('');
	let pin: string = $state('');

	// Superadmin Form
	let adminEmail: string = $state('');
	let adminPassword: string = $state('');

	let error: string = $state('');
	let isLoading: boolean = $state(false);

	function handlePinInput(num: string) {
		if (pin.length < 4) pin += num;
		error = '';
	}

	function deletePin() {
		pin = pin.slice(0, -1);
		error = '';
	}

	async function login() {
		if (loginMode === 'kasir' && (pin.length !== 4 || !kasirUsername)) {
			error = 'Masukkan username dan 4 digit PIN';
			return;
		}
		if (loginMode === 'superadmin' && (!adminEmail || !adminPassword)) {
			error = 'Masukkan email dan password';
			return;
		}

		isLoading = true;
		error = '';

		try {
			const payload =
				loginMode === 'kasir'
					? { username: kasirUsername, pin }
					: { email: adminEmail, password: adminPassword }; // Ensure backend supports reading email/password

			const res = await api.request(`/api/v1/auth/login`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await res.json();

			if (data.success || data.accessToken) {
				window.location.href = loginMode === 'kasir' ? '/pos' : '/admin/dashboard';
			} else {
				error = data.message || 'Kredensial salah. Silakan coba lagi.';
				if (loginMode === 'kasir') pin = '';
			}
		} catch (err) {
			error = 'Gagal terhubung ke server.';
			if (loginMode === 'kasir') pin = '';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-100 p-4 font-sans">
	<div
		class="flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
	>
		<!-- Header -->
		<div class="p-8 pb-4 text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/30"
			>
				<svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 10V3L4 14h7v7l9-11h-7z"
					></path></svg
				>
			</div>
			<h1 class="mb-1 text-2xl font-black tracking-tight text-slate-900">Ngemiloh System</h1>
			<p class="text-sm font-medium text-slate-500">Selamat Datang Kembali</p>
		</div>

		<div class="px-8 pb-4">
			<h2 class="text-center font-bold text-slate-700">LOGIN KASIR</h2>
		</div>

		<div class="flex-1 px-8 pb-8">
			<div transition:slide={{ duration: 200 }} class="flex flex-col items-center">
				<input
					type="text"
					bind:value={kasirUsername}
					placeholder="Username Kasir"
					class="mb-6 w-full rounded-xl border border-slate-300 bg-slate-50 p-4 text-center text-lg font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
				/>

				<div class="mb-6">
					<div class="flex justify-center gap-4">
						{#each Array(4) as _, i}
							<div
								class="flex h-14 w-12 items-center justify-center rounded-xl border-2 text-3xl font-black transition-all {pin.length >
								i
									? 'border-indigo-600 bg-indigo-50 text-indigo-600'
									: 'border-slate-200 bg-slate-50 text-transparent'}"
							>
								{pin.length > i ? '•' : ''}
							</div>
						{/each}
					</div>
					{#if error}
						<p class="mt-4 text-center text-sm font-bold text-red-500">{error}</p>
					{:else}
						<p class="mt-4 text-center text-xs font-medium text-slate-400">
							Masukkan 4 digit PIN Anda
						</p>
					{/if}
				</div>

				<div class="grid w-full max-w-70 grid-cols-3 gap-3">
					{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as num}
						<button
							class="h-14 rounded-2xl bg-slate-50 text-2xl font-black text-slate-800 transition-colors hover:bg-slate-200 active:scale-95"
							onclick={() => handlePinInput(num)}
						>
							{num}
						</button>
					{/each}
					<div class="h-14"></div>
					<button
						class="h-14 rounded-2xl bg-slate-50 text-2xl font-black text-slate-800 transition-colors hover:bg-slate-200 active:scale-95"
						onclick={() => handlePinInput('0')}
					>
						0
					</button>
					<button
						class="flex h-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 transition-colors hover:bg-slate-200 hover:text-red-500 active:scale-95"
						onclick={deletePin}
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

				<button
					class="mt-6 h-14 w-full rounded-xl font-black tracking-wide transition-all {pin.length ===
						4 &&
					kasirUsername &&
					!isLoading
						? 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700'
						: 'cursor-not-allowed bg-slate-200 text-slate-400'}"
					disabled={pin.length !== 4 || !kasirUsername || isLoading}
					onclick={login}
				>
					{isLoading ? 'MEMPROSES...' : 'MASUK KE POS'}
				</button>
			</div>
		</div>
	</div>
</div>
