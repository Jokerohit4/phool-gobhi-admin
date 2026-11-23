import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Pages fetch gateway data on the server; each must authenticate itself in
// addition to proxy.ts. The push dashboard has no Server Actions (read-only),
// so this guards its page the same way serverActionAuth guards actions.
const APP_DIR = path.resolve(__dirname, '..');

describe('read-only dashboard pages require a session', () => {
  for (const rel of ['push/page.tsx', 'analytics/page.tsx']) {
    it(`${rel} awaits requireSession() before fetching`, () => {
      const src = readFileSync(path.join(APP_DIR, rel), 'utf8');
      const auth = src.indexOf('await requireSession()');
      expect(auth).toBeGreaterThan(-1);
      expect(auth).toBeLessThan(src.indexOf('gatewayJson<'));
    });
  }

  it('the push page reads only the two push endpoints via the gateway helper (no raw fetch)', () => {
    const src = readFileSync(path.join(APP_DIR, 'push/page.tsx'), 'utf8');
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).toContain('/api/bookings/admin/analytics/push-funnel?');
    expect(src).toContain('/api/bookings/admin/analytics/push-types?days=');
  });

  it('the push dashboard is in the sidebar', () => {
    const src = readFileSync(path.join(APP_DIR, 'sidebar.tsx'), 'utf8');
    expect(src).toContain("href: '/push'");
  });
});
