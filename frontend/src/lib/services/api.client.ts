export class ApiClient {
  private static getCookie(name: string) {
    if (typeof document === 'undefined') return undefined;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
  }

  static async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    // Automatically prepend /api/v1 if it's a relative path and doesn't already have it
    let url = endpoint;
    if (!url.startsWith('http')) {
       let path = url.startsWith('/api/v1') ? url : `/api/v1${url.startsWith('/') ? url : '/' + url}`;
       const baseUrl = import.meta.env.VITE_API_URL || '';
       url = baseUrl ? `${baseUrl}${path}` : path;
    }
    
    options.credentials = 'include'; // Always include credentials
    options.headers = options.headers || {};
    
    if (options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method.toUpperCase())) {
      const csrfToken = this.getCookie('csrf_token');
      if (csrfToken) {
        options.headers = {
          ...options.headers,
          'X-CSRF-Token': csrfToken
        };
      }
    }

    // Call native fetch
    let response = await fetch(url, options);

    // Global 401 handling
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      const refreshUrl = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1/auth/refresh` : `/api/v1/auth/refresh`;
      const refreshRes = await fetch(refreshUrl, {
        method: 'POST',
        credentials: 'include'
      });

      if (refreshRes.ok) {
        // Retry the original request (re-fetch CSRF token for new request)
        return this.request(endpoint, options);
      } else {
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }

    return response;
  }

  static async get(endpoint: string, options?: RequestInit) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  static async post(endpoint: string, body?: any, options?: RequestInit) {
    const init = { ...options, method: 'POST' };
    if (body) {
      init.headers = { 'Content-Type': 'application/json', ...init.headers };
      init.body = JSON.stringify(body);
    }
    return this.request(endpoint, init);
  }

  static async put(endpoint: string, body?: any, options?: RequestInit) {
    const init = { ...options, method: 'PUT' };
    if (body) {
      init.headers = { 'Content-Type': 'application/json', ...init.headers };
      init.body = JSON.stringify(body);
    }
    return this.request(endpoint, init);
  }

  static async patch(endpoint: string, body?: any, options?: RequestInit) {
    const init = { ...options, method: 'PATCH' };
    if (body) {
      init.headers = { 'Content-Type': 'application/json', ...init.headers };
      init.body = JSON.stringify(body);
    }
    return this.request(endpoint, init);
  }

  static async delete(endpoint: string, options?: RequestInit) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = ApiClient;
