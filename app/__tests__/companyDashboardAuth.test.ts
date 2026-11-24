import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// The company dashboard, HR report and CSV export read other people's activity
// aggregates. Each must authenticate before fetching, and the two that produce
// something handed to a company must stay aggregate-only.
const APP_DIR = path.resolve(__dirname, '..');
const read = (rel: string) => readFileSync(path.join(APP_DIR, rel), 'utf8');

describe('company dashboard surfaces require a session', () => {
  for (const rel of [
    'organizations/[id]/dashboard/page.tsx',
    'organizations/[id]/report/page.tsx',
    'organizations/[id]/report.csv/route.ts',
  ]) {
    it(`${rel} awaits requireSession() before fetching`, () => {
      const src = read(rel);
      const auth = src.indexOf('await requireSession()');
      expect(auth).toBeGreaterThan(-1);
      expect(auth).toBeLessThan(src.indexOf('gatewayJson<'));
    });
  }

  it('the CSV route rejects cross-origin requests before doing anything else', () => {
    const src = read('organizations/[id]/report.csv/route.ts');
    expect(src).toContain('rejectCrossOrigin(request)');
    expect(src.indexOf('rejectCrossOrigin(request)')).toBeLessThan(src.indexOf('requireSession()'));
  });

  it('the CSV route refuses to export when activity could not be read', () => {
    expect(read('organizations/[id]/report.csv/route.ts')).toContain('!data.complete');
  });

  it('ids are validated before they reach a gateway path', () => {
    for (const rel of ['organizations/[id]/dashboard/page.tsx', 'organizations/[id]/report/page.tsx', 'organizations/[id]/report.csv/route.ts']) {
      expect(read(rel)).toContain('parsePositiveId');
    }
  });
});

describe('the report handed to a company never touches the staff follow-up lists', () => {
  it('neither the print page nor the CSV route reads `actions` (names and phones)', () => {
    for (const rel of ['organizations/[id]/report/page.tsx', 'organizations/[id]/report.csv/route.ts']) {
      expect(read(rel)).not.toMatch(/\.actions\b|notSignedIn|needsConsent/);
    }
  });
});
