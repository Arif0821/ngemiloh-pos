import { set_cookie, clear_cookie } from './cookie';

describe('cookie utilities', () => {
  // Create a mock that uses the native Headers API
  const createMockResponse = () => {
    const headers = new Headers();
    return {
      headers,
    } as unknown as Response;
  };

  // Helper to get all Set-Cookie header values (kept for reference)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _getSetCookieHeaders = (res: Response): string[] => {
    const header = res.headers.get('Set-Cookie');
    return header ? [header] : [];
  };

  describe('set_cookie', () => {
    it('should set basic cookie', () => {
      const mock_res = createMockResponse();
      set_cookie(mock_res, 'test', 'value');
      const cookies = mock_res.headers.get('Set-Cookie') || '';
      expect(cookies).toContain('test=value');
    });

    it('should set HttpOnly flag', () => {
      const mock_res = createMockResponse();
      set_cookie(mock_res, 'token', 'abc123');
      const cookies = mock_res.headers.get('Set-Cookie') || '';
      expect(cookies).toContain('HttpOnly');
    });

    it('should set SameSite=Strict', () => {
      const mock_res = createMockResponse();
      set_cookie(mock_res, 'token', 'abc123');
      const cookies = mock_res.headers.get('Set-Cookie') || '';
      expect(cookies).toContain('SameSite=strict');
    });

    it('should set Max-Age for session cookies', () => {
      const mock_res = createMockResponse();
      set_cookie(mock_res, 'token', 'abc123', { maxAge: 7200 });
      const cookies = mock_res.headers.get('Set-Cookie') || '';
      expect(cookies).toContain('Max-Age=7200');
    });

    it('should set Secure flag in production', () => {
      const original_env = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const mock_res = createMockResponse();
      set_cookie(mock_res, 'token', 'abc123');
      const cookies = mock_res.headers.get('Set-Cookie') || '';
      expect(cookies).toContain('Secure');
      process.env.NODE_ENV = original_env;
    });

    it('should not set Secure flag in development', () => {
      const original_env = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const mock_res = createMockResponse();
      set_cookie(mock_res, 'token', 'abc123');
      const cookies = mock_res.headers.get('Set-Cookie') || '';
      expect(cookies).not.toContain('Secure');
      process.env.NODE_ENV = original_env;
    });
  });

  describe('clear_cookie', () => {
    it('should clear cookie by setting Max-Age=0', () => {
      const mock_res = createMockResponse();
      clear_cookie(mock_res, 'token');
      const cookies = mock_res.headers.get('Set-Cookie') || '';
      expect(cookies).toContain('Max-Age=0');
    });

    it('should clear cookie with custom path', () => {
      const mock_res = createMockResponse();
      clear_cookie(mock_res, 'token', '/api');
      const cookies = mock_res.headers.get('Set-Cookie') || '';
      expect(cookies).toContain('Path=/api');
      expect(cookies).toContain('Max-Age=0');
    });

    it('should include security flags when clearing', () => {
      const mock_res = createMockResponse();
      clear_cookie(mock_res, 'token');
      const cookies = mock_res.headers.get('Set-Cookie') || '';
      expect(cookies).toContain('HttpOnly');
      expect(cookies).toContain('SameSite=strict');
    });
  });

  describe('set_cookie with custom domain', () => {
    it('should set cookie with custom domain', () => {
      const mock_res = createMockResponse();
      set_cookie(mock_res, 'session', 'abc123', { domain: '.example.com' });
      const cookies = mock_res.headers.get('Set-Cookie') || '';
      expect(cookies).toContain('Domain=.example.com');
    });
  });
});
