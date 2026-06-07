<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  let { children } = $props();

  onMount(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
      };
      
      const csrfToken = getCookie('csrf_token');
      
      init = init || {};
      if (csrfToken && init.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(init.method.toUpperCase())) {
        init.headers = {
          ...init.headers,
          'X-CSRF-Token': csrfToken
        };
      }

      let response = await originalFetch(input, init);

      if (response.status === 401 && !input.toString().includes('/auth/login') && !input.toString().includes('/auth/refresh')) {
        const refreshRes = await originalFetch(`/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include'
        });

        if (refreshRes.ok) {
          response = await originalFetch(input, init);
        } else {
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
      }

      return response;
    };
  });
</script>

<svelte:head>
  <title>Ngemiloh POS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0">
  <meta name="theme-color" content="#f43f5e">
</svelte:head>

{@render children()}
