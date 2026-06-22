<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { api } from '$lib/services/api.client';

	let { children } = $props();

	let is_superadmin = $state(false);
	let admin_name = $state('');
	let is_logging_out = $state(false);

	onMount(() => {
		const user_str = localStorage.getItem('user');
		if (!user_str) {
			goto('/login-admin');
			return;
		}

		let user: { role: string; name: string };
		try {
			user = JSON.parse(user_str);
			if (user.role !== 'superadmin') {
				goto('/login-admin');
				return;
			}
		} catch {
			goto('/login-admin');
			return;
		}

		// VERIFIKASI TOKEN KE BACKEND (TINGGI-01)
		api
			.get('/auth/me')
			.then((res) => {
				if (!res.ok) {
					localStorage.removeItem('user');
					goto('/login-admin');
					return;
				}
				is_superadmin = true;
				admin_name = user.name || 'Admin';
			})
			.catch(() => {
				// Jika offline, percayakan localStorage sementara
				console.warn('Cannot verify session — network offline');
				is_superadmin = true;
				admin_name = user.name || 'Admin';
			});
	});

	async function handle_logout() {
		if (is_logging_out) return;
		is_logging_out = true;
		try {
			// Clear local state (no backend logout needed - tokens expire automatically)
			localStorage.removeItem('user');
			localStorage.removeItem('pending_pin_change');
		} finally {
			goto('/login-admin');
		}
	}
</script>

{#if is_superadmin}
	<div class="flex h-screen overflow-hidden bg-slate-100 font-sans">
		<!-- Sidebar -->
		<aside
			class="z-20 flex w-64 flex-col bg-slate-900 text-white shadow-xl transition-all duration-300"
		>
			<div class="flex h-20 items-center justify-center border-b border-slate-800 px-6">
				<div
					class="bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent"
				>
					Ngemiloh<span
						class="ml-2 rounded-md bg-slate-700 px-2 py-1 text-sm font-normal text-white"
						>Admin</span
					>
				</div>
			</div>

			<nav class="flex-1 space-y-2 overflow-y-auto px-4 py-6">
				{#each [{ href: '/admin/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' }, { href: '/admin/transactions', label: 'Transaksi', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' }, { href: '/admin/products', label: 'Produk & Modifier', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z' }, { href: '/admin/categories', label: 'Kategori', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' }, { href: '/admin/inventory', label: 'Bahan Baku', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' }, { href: '/admin/discounts', label: 'Diskon', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }, { href: '/admin/shifts', label: 'Riwayat Shift', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' }, { href: '/admin/cashiers', label: 'Kasir', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' }, { href: '/admin/members', label: 'Members', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' }, { href: '/admin/analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }, { href: '/admin/profit-share', label: 'Bagi Hasil', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' }, { href: '/admin/cash', label: 'Laporan Kas', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' }, { href: '/admin/opex', label: 'Biaya Operasional', icon: 'M13 10V3L4 14h7v7l9-11h-7z' }, { href: '/admin/assets', label: 'Aset & Depresiasi', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' }, { href: '/admin/reports', label: 'Export Laporan', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' }, { href: '/admin/settings/flags', label: 'Feature Flags', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' }, { href: '/admin/settings', label: 'Settings Sistem', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }, { href: '/admin/system-logs', label: 'System Logs', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' }, { href: '/admin/system-health', label: 'System Health', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' }, { href: '/admin/audit-logs', label: 'Audit Log', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' }] as link}
					<a
						href={link.href}
						class="flex items-center rounded-xl px-4 py-3 font-medium transition-colors {$page.url.pathname.startsWith(
							link.href
						)
							? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20'
							: 'text-slate-400 hover:bg-slate-800 hover:text-white'}"
					>
						<svg class="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={link.icon} />
						</svg>
						{link.label}
					</a>
				{/each}
			</nav>

			<div class="border-t border-slate-800 p-4">
				<div class="mb-4 flex items-center px-2">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-tr from-indigo-500 to-purple-500 font-bold text-white shadow-lg"
					>
						{admin_name.charAt(0)}
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-white">{admin_name}</p>
						<p class="text-xs text-slate-400">Superadmin</p>
					</div>
				</div>
				<button
					onclick={handle_logout}
					class="flex w-full items-center justify-center rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 shadow-sm transition-all duration-200 hover:bg-red-600/90 hover:text-white"
				>
					<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
						/>
					</svg>
					Keluar
				</button>
			</div>
		</aside>

		<!-- Main content -->
		<main class="relative flex flex-1 flex-col overflow-hidden bg-slate-50 p-8">
			{@render children()}
		</main>
	</div>
{/if}
