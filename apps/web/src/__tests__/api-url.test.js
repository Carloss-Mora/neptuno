import { resolveApiUrl } from '@/lib/apiUrl';

describe('resolveApiUrl', () => {
  it('uses the page host when .env points to loopback but the page is opened from another device', () => {
    expect(resolveApiUrl({ configured: 'http://127.0.0.1:8090', hostname: '192.168.1.12', isDev: true })).toBe('http://192.168.1.12:8090');
    expect(resolveApiUrl({ configured: 'http://localhost:8090', hostname: 'mi-pc.local', isDev: true })).toBe('http://mi-pc.local:8090');
  });

  it('keeps the configured URL on the same computer', () => {
    expect(resolveApiUrl({ configured: 'http://127.0.0.1:8090', hostname: 'localhost', isDev: true })).toBe('http://127.0.0.1:8090');
  });

  it('keeps a real remote URL and never rewrites production builds', () => {
    expect(resolveApiUrl({ configured: 'https://api.neptuno.co', hostname: '192.168.1.12', isDev: true })).toBe('https://api.neptuno.co');
    expect(resolveApiUrl({ configured: 'http://127.0.0.1:8090', hostname: '192.168.1.12', isDev: false })).toBe('http://127.0.0.1:8090');
  });

  it('falls back to the page host in development and to nothing in production', () => {
    expect(resolveApiUrl({ configured: '', hostname: '192.168.1.12', protocol: 'http:', isDev: true })).toBe('http://192.168.1.12:8090');
    expect(resolveApiUrl({ configured: '', hostname: 'neptuno.co', isDev: false })).toBe('');
  });
});
