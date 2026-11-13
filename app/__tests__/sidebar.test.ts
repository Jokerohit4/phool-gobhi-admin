import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('next/link', () => ({ default: () => null }));

const { NAV_ITEMS } = await import('../sidebar');

describe('sidebar entries', () => {
  it('adds Content and Unclaimed gyms', () => {
    expect(NAV_ITEMS).toContainEqual({ href: '/content', label: 'Content' });
    expect(NAV_ITEMS).toContainEqual({ href: '/unclaimed-gyms', label: 'Unclaimed gyms' });
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
    ]) {
      expect(hrefs).toContain(href);
    }
    expect(NAV_ITEMS).toContainEqual({ href: '/buddy-reports', label: 'Buddy reports' });
  });

  it('has unique React keys', () => {
    const keys = NAV_ITEMS.map((i) => `${i.href}-${i.label}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
