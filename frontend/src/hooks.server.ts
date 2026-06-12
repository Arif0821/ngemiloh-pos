import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

/**
 * Server-side auth guard for admin API routes.
 * Runs on the server for every request to /api/v1/admin/* endpoints.
 * This provides defense-in-depth even though the SPA handles auth client-side.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;

  // Guard all /api/v1/admin/* routes
  if (path.startsWith('/api/v1/admin')) {
    const authHeader = event.request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Validate JWT presence (structure check — signature verified by NestJS)
    const token = authHeader.slice(7);
    if (!token || token.split('.').length !== 3) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid token format' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  return resolve(event);
};
