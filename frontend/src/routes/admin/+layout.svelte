<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  
  let { children } = $props();
  
  let isSuperadmin = $state(false);
  let adminName = $state('');

  onMount(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      goto('/login-admin');
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (user.role !== 'superadmin') {
        goto('/login-admin');
        return;
      }
      isSuperadmin = true;
      adminName = user.name || 'Admin';
    } catch (e) {
      goto('/login-admin');
    }
  });

  function handleLogout() {
    localStorage.removeItem('user');
    goto('/login-admin');
  }
</script>

{#if isSuperadmin}
<div class="flex h-screen bg-slate-100 overflow-hidden font-sans">
  <!-- Sidebar -->
  <aside class="w-64 bg-slate-900 text-white flex flex-col transition-all duration-300 shadow-xl z-20">
    <div class="h-20 flex items-center justify-center border-b border-slate-800 px-6">
      <div class="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-indigo-400 to-purple-400 tracking-tight">Ngemiloh<span class="text-white text-sm font-normal ml-2 bg-slate-700 px-2 py-1 rounded-md">Admin</span></div>
    </div>
    
    <nav class="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
      {#each [
        { href: '/admin/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { href: '/admin/transactions', label: 'Transaksi', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
        { href: '/admin/products', label: 'Produk & Modifier', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z' },
        { href: '/admin/inventory', label: 'Bahan Baku (Opname)', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
        { href: '/admin/discounts', label: 'Diskon', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
        { href: '/admin/analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
        { href: '/admin/profit-share', label: 'Bagi Hasil', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        { href: '/admin/cash', label: 'Laporan Kas', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
        { href: '/admin/opex', label: 'Biaya Operasional', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
        { href: '/admin/assets', label: 'Aset & Depresiasi', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
        { href: '/admin/reports', label: 'Export Laporan', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
        { href: '/admin/users', label: 'Manajemen Kasir', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
        { href: '/admin/settings/flags', label: 'Feature Flags', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
        { href: '/admin/settings', label: 'Settings Sistem', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
        { href: '/admin/audit-logs', label: 'Audit Log', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' }
      ] as link}
        <a href={link.href} class="flex items-center px-4 py-3 rounded-xl font-medium transition-colors {$page.url.pathname.startsWith(link.href) ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}">
          <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={link.icon} />
          </svg>
          {link.label}
        </a>
      {/each}
    </nav>
    
    <div class="p-4 border-t border-slate-800">
      <div class="flex items-center mb-4 px-2">
        <div class="w-10 h-10 rounded-full bg-linear-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg">
          {adminName.charAt(0)}
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium text-white">{adminName}</p>
          <p class="text-xs text-slate-400">Superadmin</p>
        </div>
      </div>
      <button 
        onclick={handleLogout}
        class="w-full flex items-center justify-center py-2.5 px-4 bg-slate-800 hover:bg-red-600/90 text-slate-300 hover:text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-sm"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Keluar
      </button>
    </div>
  </aside>

  <!-- Main content -->
  <main class="flex-1 flex flex-col overflow-hidden bg-slate-50 relative p-8">
    {@render children()}
  </main>
</div>
{/if}
