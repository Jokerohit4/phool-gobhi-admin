import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// Server Actions are public POST endpoints: proxy.ts does not cover them, so
// every exported action must authenticate itself. This is a cheap static
// guard — each exported async function in a 'use server' actions file must
// call requireSession() directly or go through a helper that does (e.g.
// buddy-reports' mutate()).

const APP_DIR = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/^actions\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const AUTH_CALL = /\b(requireSession|mutate)\(/;

function exportedFunctions(source: string): { name: string; body: string }[] {
  const re = /^export\s+async\s+function\s+(\w+)/gm;
  const starts: { name: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) starts.push({ name: m[1], index: m.index });
  return starts.map((s, i) => ({ name: s.name, body: source.slice(s.index, starts[i + 1]?.index ?? source.length) }));
}

const files = walk(APP_DIR).filter((f) => /^\s*['"]use server['"]/.test(readFileSync(f, 'utf8').replace(/^﻿/, '')));

describe('server actions require a session', () => {
  it('finds the action files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    const rel = path.relative(APP_DIR, file).split(path.sep).join('/');
    it(`${rel}: every exported action authenticates`, () => {
      const fns = exportedFunctions(readFileSync(file, 'utf8'));
      expect(fns.length).toBeGreaterThan(0);
      const unauthenticated = fns.filter((f) => !AUTH_CALL.test(f.body)).map((f) => f.name);
      expect(unauthenticated).toEqual([]);
    });
  }
});

describe('WP6 mutations check the request origin', () => {
  for (const file of ['coaching-plans', 'coupons', 'fulfillment', 'settings/membership-payout']) {
    it(file, () => {
      const actions = exportedFunctions(readFileSync(path.join(APP_DIR, file, 'actions.ts'), 'utf8'));
      expect(actions.length).toBeGreaterThan(0);
      for (const { body } of actions) {
        expect(body).toMatch(/await requireSession\(\);\s+if \(await hasInvalidActionOrigin\(\)\)/);
      }
    });
  }
});
