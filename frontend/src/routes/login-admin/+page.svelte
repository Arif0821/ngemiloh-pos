<script lang="ts">
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
      const res = await fetch(`/api/v1/auth/login`, {
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

<div class="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
  <div class="sm:mx-auto sm:w-full sm:max-w-md">
    <div class="text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600 mb-4">
        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      </div>
      <h2 class="text-3xl font-extrabold text-white">Superadmin Portal</h2>
      <p class="mt-2 text-sm text-slate-400">Gunakan kredensial admin Anda untuk mengelola inventori.</p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-slate-800 py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-slate-700">
        
        {#if error}
          <div class="bg-red-900/50 border-l-4 border-red-500 p-4 mb-6 rounded-md">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
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
            <div class="mt-1 relative rounded-md shadow-sm">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input 
                id="email" 
                name="email" 
                type="email" 
                bind:value={email}
                required 
                class="block w-full pl-10 pr-3 py-3 border border-slate-600 rounded-xl leading-5 bg-slate-900 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-200" 
                placeholder="admin@ngemiloh.com"
              >
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-slate-300">Kata Sandi</label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input 
                id="password" 
                name="password" 
                type="password" 
                bind:value={password}
                required 
                class="block w-full pl-10 pr-3 py-3 border border-slate-600 rounded-xl leading-5 bg-slate-900 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors duration-200" 
                placeholder="••••••••"
              >
            </div>
          </div>

          <div>
            <button 
              type="submit" 
              disabled={isLoading || !email || !password}
              class="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isLoading}
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
