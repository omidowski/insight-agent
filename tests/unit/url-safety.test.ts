import { describe, expect, it } from 'vitest';
import { assertUrlAllowed, canonicalizeUrl, isPrivateAddress, domainOf } from '@/lib/util/url-safety';

describe('Spec 39/20 — SSRF-Guard und URL-Normalisierung', () => {
  it('AC-39-01 / AC-20-01: Metadata-Endpunkt wird blockiert', async () => {
    await expect(assertUrlAllowed('http://169.254.169.254/latest/meta-data')).rejects.toMatchObject({
      appError: { code: 'FETCH_BLOCKED' },
    });
  });

  it('AC-47-03: Loopback ist nur mit Demo-Ausnahme erlaubt', async () => {
    await expect(assertUrlAllowed('http://127.0.0.1:3000/x')).rejects.toMatchObject({
      appError: { code: 'FETCH_BLOCKED' },
    });
    await expect(assertUrlAllowed('http://127.0.0.1:3000/x', { allowLoopback: true })).resolves.toBeInstanceOf(URL);
  });

  it('blockiert private Bereiche und interne Hostnamen', async () => {
    for (const url of ['http://10.0.0.5/', 'http://192.168.1.1/', 'http://172.16.4.4/', 'http://intranet.local/']) {
      await expect(assertUrlAllowed(url)).rejects.toMatchObject({ appError: { code: 'FETCH_BLOCKED' } });
    }
  });

  it('lehnt nicht-http(s)-Schemata ab', async () => {
    await expect(assertUrlAllowed('file:///etc/passwd')).rejects.toMatchObject({
      appError: { code: 'FETCH_BLOCKED' },
    });
  });

  it('erkennt private Adressen korrekt', () => {
    expect(isPrivateAddress('169.254.169.254', 4)).toBe(true);
    expect(isPrivateAddress('::1', 6)).toBe(true);
    expect(isPrivateAddress('93.184.216.34', 4)).toBe(false);
  });

  it('AC-19-01: Kanonisierung entfernt www, Tracking-Parameter und Fragment', () => {
    expect(canonicalizeUrl('https://WWW.Example.com/a/b/?utm_source=x&q=1#top'))
      .toBe('https://example.com/a/b?q=1');
    expect(canonicalizeUrl('https://example.com/a')).toBe(canonicalizeUrl('https://www.example.com/a'));
    expect(domainOf('https://www.bundesliga.example/x')).toBe('bundesliga.example');
  });
});
