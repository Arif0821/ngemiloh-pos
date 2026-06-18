/**
 * Cookie options interface for express Response
 */
export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | 'strict' | 'lax' | 'none';
  maxAge?: number;
  path?: string;
  domain?: string;
}

/**
 * Set a cookie on Express Response object
 * Uses res.cookie() method from express
 */
export function set_cookie(
  res: {
    cookie: (name: string, value: string, options?: CookieOptions) => void;
  },
  name: string,
  value: string,
  options: CookieOptions = {},
): void {
  const {
    httpOnly = true,
    secure = process.env.NODE_ENV === 'production',
    sameSite = 'strict',
    maxAge,
    path = '/',
    domain,
  } = options;

  res.cookie(name, value, {
    httpOnly,
    secure,
    sameSite,
    maxAge,
    path,
    domain,
  });
}

/**
 * Clear a cookie via Express Response
 */
export function clear_cookie(
  res: {
    cookie: (name: string, value: string, options?: CookieOptions) => void;
  },
  name: string,
  path = '/',
): void {
  res.cookie(name, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path,
  });
}
