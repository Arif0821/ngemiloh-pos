export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  path?: string;
  domain?: string;
}

/**
 * Set a cookie on the Response object
 */
export function set_cookie(
  res: Response,
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

  let cookie_str = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  cookie_str += `; Path=${path}`;

  if (domain) cookie_str += `; Domain=${domain}`;
  if (httpOnly) cookie_str += '; HttpOnly';
  if (secure) cookie_str += '; Secure';
  cookie_str += `; SameSite=${sameSite}`;
  if (maxAge !== undefined) cookie_str += `; Max-Age=${maxAge}`;

  res.headers.append('Set-Cookie', cookie_str);
}

/**
 * Clear a cookie
 */
export function clear_cookie(res: Response, name: string, path = '/'): void {
  set_cookie(res, name, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path,
  });
}
