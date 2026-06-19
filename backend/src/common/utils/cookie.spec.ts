import { set_cookie, clear_cookie } from './cookie';

describe('cookie utilities', () => {
  // Create a mock that simulates express Response
  const createMockResponse = () => {
    const cookies: Array<{
      name: string;
      value: string;
      options: Record<string, unknown>;
    }> = [];
    return {
      cookie: (
        name: string,
        value: string,
        options: Record<string, unknown> = {},
      ) => {
        cookies.push({ name, value, options });
      },
      _getCookies: () => cookies,
      _getLastCookie: () => cookies[cookies.length - 1],
    };
  };

  describe('set_cookie', () => {
    it('should set basic cookie', () => {
      const mock_res = createMockResponse();
      set_cookie(mock_res, 'test', 'value');
      expect(mock_res._getLastCookie()).toMatchObject({
        name: 'test',
        value: 'value',
      });
    });

    it('should set HttpOnly flag', () => {
      const mock_res = createMockResponse();
      set_cookie(mock_res, 'token', 'abc123');
      expect(mock_res._getLastCookie().options).toHaveProperty(
        'httpOnly',
        true,
      );
    });

    it('should set SameSite=Strict', () => {
      const mock_res = createMockResponse();
      set_cookie(mock_res, 'token', 'abc123');
      expect(mock_res._getLastCookie().options).toHaveProperty(
        'sameSite',
        'strict',
      );
    });

    it('should set Max-Age for session cookies', () => {
      const mock_res = createMockResponse();
      set_cookie(mock_res, 'token', 'abc123', { maxAge: 7200 });
      expect(mock_res._getLastCookie().options).toHaveProperty('maxAge', 7200);
    });

    it('should set Secure flag in production', () => {
      const original_env = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const mock_res = createMockResponse();
      set_cookie(mock_res, 'token', 'abc123');
      expect(mock_res._getLastCookie().options).toHaveProperty('secure', true);
      process.env.NODE_ENV = original_env;
    });

    it('should not set Secure flag in development', () => {
      const original_env = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const mock_res = createMockResponse();
      set_cookie(mock_res, 'token', 'abc123');
      expect(mock_res._getLastCookie().options).toHaveProperty('secure', false);
      process.env.NODE_ENV = original_env;
    });

    it('should set cookie with custom domain', () => {
      const mock_res = createMockResponse();
      set_cookie(mock_res, 'session', 'abc123', { domain: '.example.com' });
      expect(mock_res._getLastCookie().options).toHaveProperty(
        'domain',
        '.example.com',
      );
    });
  });

  describe('clear_cookie', () => {
    it('should clear cookie by setting Max-Age=0', () => {
      const mock_res = createMockResponse();
      clear_cookie(mock_res, 'token');
      expect(mock_res._getLastCookie().options).toHaveProperty('maxAge', 0);
    });

    it('should clear cookie with custom path', () => {
      const mock_res = createMockResponse();
      clear_cookie(mock_res, 'token', '/api');
      expect(mock_res._getLastCookie()).toMatchObject({
        name: 'token',
        value: '',
        options: expect.objectContaining({ path: '/api' }),
      });
    });

    it('should include security flags when clearing', () => {
      const mock_res = createMockResponse();
      clear_cookie(mock_res, 'token');
      expect(mock_res._getLastCookie().options).toHaveProperty(
        'httpOnly',
        true,
      );
      expect(mock_res._getLastCookie().options).toHaveProperty(
        'sameSite',
        'strict',
      );
    });
  });
});
