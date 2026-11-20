import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('next/link', () => ({ default: () => null }));

const { NAV_ITEMS, NAV_GROUPS } = await import('../sidebar');

describe('sidebar entries', () => {
  it('adds Content and Unclaimed gyms', () => {
    expect(NAV_ITEMS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: '/content', label: 'Content' }),
        expect.objectContaining({ href: '/unclaimed-gyms', label: 'Unclaimed gyms' }),
      ]),
    );
  });

  it('keeps the existing entries, including Buddy reports', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    for (const href of [
      '/gyms',
      '/edit-requests',
      '/analytics',
      '/buddy-reports',
      '/food-requests',
      '/health',
      '/settings',
      '/staff',
      '/payouts',
      '/fulfillment',
    ]) {
      expect(hrefs).toContain(href);
    }
    expect(NAV_ITEMS).toEqual(expect.arrayContaining([expect.objectContaining({ href: '/buddy-reports', label: 'Buddy reports' })]));
  });

  it('has unique routes and no duplicate /health entries', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.filter((h) => h === '/health')).toHaveLength(1);
  });

  it('exposes grouped navigation with icons and badge hook keys', () => {
    expect(Array.isArray(NAV_GROUPS)).toBe(true);
    expect(NAV_GROUPS.length).toBeGreaterThan(0);
    expect(NAV_GROUPS.flatMap((g) => g.items).length).toBe(NAV_ITEMS.length);
    expect(NAV_GROUPS.some((g) => g.items.some((i) => i.icon))).toBe(true);
    expect(NAV_ITEMS.some((i) => i.badgeKey)).toBe(true);
  });
});
