import { Request } from 'express';

/**
 * Extract client IP address from request, properly handling X-Forwarded-For header
 * from reverse proxies like Caddy
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (Array.isArray(forwardedFor)) {
    // Take the first IP in the chain (original client)
    return forwardedFor[0].split(',')[0].trim();
  }

  if (typeof forwardedFor === 'string') {
    // Multiple IPs can be comma-separated - take the first one
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback to socket remote address
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Check if an IP address matches any of the allowed IPs/CIDR patterns
 */
export function isIpAllowed(ip: string, allowedIps: string[]): boolean {
  for (const allowedIp of allowedIps) {
    if (!allowedIp.includes('/')) {
      // Simple exact match
      if (ip === allowedIp) return true;
      continue;
    }

    // CIDR notation handling
    const [baseIp, prefixStr] = allowedIp.split('/');
    const prefix = parseInt(prefixStr, 10);

    // Handle IPv4 only (most common case)
    if (!baseIp.includes(':') && baseIp.includes('.')) {
      if (prefix === 32) {
        if (ip === baseIp) return true;
      } else if (prefix === 24) {
        // Compare first 3 octets (e.g., 192.168.1.x)
        const basePrefix = baseIp.substring(0, baseIp.lastIndexOf('.'));
        if (ip.startsWith(basePrefix + '.')) return true;
      } else if (prefix === 16) {
        // Compare first 2 octets (e.g., 192.168.x.x)
        const dotIndex = baseIp.indexOf('.');
        const secondDotIndex = baseIp.indexOf('.', dotIndex + 1);
        const basePrefix = baseIp.substring(0, secondDotIndex);
        if (ip.startsWith(basePrefix + '.')) return true;
      }
      // Other CIDR prefixes not supported
    }
  }

  return false;
}
