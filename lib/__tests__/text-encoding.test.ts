// Fails when a tracked text file contains mojibake: text written in one
// encoding and read back in another, so an em dash or the rupee sign turns
// into junk. Detected, per line:
//   1. U+FFFD (the original bytes are gone).
//   2. UTF-8 read as Windows-1252: a lead character (for the UTF-8 lead bytes
//      C2 C3 C4 C5 CE CF D0 D1 E0 E2 EF F0) followed by a cp1252 continuation
//      character (bytes 80-BF, incl. euro/quotes/dashes and C1 controls).
//   3. UTF-8 read as DOS cp437: box-drawing tee followed by a Latin-1
//      character, or a few specific pairs, or Greek capital gamma followed by
//      a Latin-1 character. Plain box-drawing diagrams do not match.
//   4. Bytes that are not valid UTF-8.
//   5. A UTF-8 byte order mark at the start of a file.
//
// This file is deliberately pure ASCII and builds its character sets from
// numeric code points, so it can never match itself. Keep it that way.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Files that legitimately contain such sequences. Path -> reason. */
const ALLOWLIST: Record<string, string> = {};

const TEXT_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'mjs', 'cjs', 'json', 'md', 'css', 'html', 'yml', 'yaml', 'txt', 'sh',
]);

// Data files that may already carry a BOM; they are not rewritten.
const BOM_ALLOWED_EXTENSIONS = new Set(['json']);

const SELF = 'lib/__tests__/text-encoding.test.ts';

const ch = (code: number): string => String.fromCharCode(code);

/** Characters for a regex class from code points; a two-element array is a range. */
function chars(parts: Array<number | [number, number]>): string {
  return parts
    .map((p) => (typeof p === 'number' ? ch(p) : ch(p[0]) + '-' + ch(p[1])))
    .join('');
}

const LEADS = chars([0xc2, 0xc3, 0xc4, 0xc5, 0xce, 0xcf, 0xd0, 0xd1, 0xe0, 0xe2, 0xef, 0xf0]);

const CONTINUATIONS = chars([
  [0x80, 0xbf],
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

const BOX_LEADS = chars([0x251c, 0x252c]);
const LATIN1 = chars([[0xa0, 0xff]]);
const GAMMA_LATIN1 = chars([[0xa1, 0xff]]);
const BOX_E_ACUTE = ch(0x251c) + ch(0x2310);
const BOX_MIDDLE_DOT = ch(0x252c) + ch(0x2556);
const GAMMA = ch(0x0393);

const PATTERNS: Array<[string, RegExp]> = [
  ['replacement character (original bytes lost)', new RegExp(ch(0xfffd))],
  ['UTF-8 read as Windows-1252', new RegExp('[' + LEADS + '][' + CONTINUATIONS + ']')],
  [
    'UTF-8 read as code page 437',
    new RegExp(
      '[' + BOX_LEADS + '][' + LATIN1 + ']|' + BOX_E_ACUTE + '|' + BOX_MIDDLE_DOT +
        '|' + GAMMA + '[' + GAMMA_LATIN1 + ']',
    ),
  ],
];

function trackedFiles(): string[] {
  const out = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split(ch(10)).map((s) => s.trim()).filter(Boolean);
}

export function scanText(file: string, bytes: Buffer): string[] {
  const problems: string[] = [];
  const dot = file.lastIndexOf('.');
  const ext = dot < 0 ? '' : file.slice(dot + 1).toLowerCase();
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  if (hasBom && !BOM_ALLOWED_EXTENSIONS.has(ext)) {
    problems.push(file + ': starts with a UTF-8 byte order mark (BOM)');
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    problems.push(file + ': not valid UTF-8');
    return problems;
  }
  const lines = text.split(ch(10));
  lines.forEach((line, i) => {
    for (const [name, re] of PATTERNS) {
      if (!re.test(line)) continue;
      const t = line.trim();
      problems.push(file + ':' + (i + 1) + ': ' + name + ' -> ' + (t.length > 90 ? t.slice(0, 90) + '...' : t));
      break;
    }
  });
  return problems;
}

describe('text encoding guard', () => {
  it('has no mojibake, invalid UTF-8 or BOM in tracked text files', () => {
    const problems: string[] = [];
    for (const file of trackedFiles()) {
      if (file === SELF || file in ALLOWLIST) continue;
      if (file.endsWith('package-lock.json') || file.endsWith('.lock')) continue;
      const dot = file.lastIndexOf('.');
      if (dot < 0 || !TEXT_EXTENSIONS.has(file.slice(dot + 1).toLowerCase())) continue;
      if (!existsSync(file)) continue;
      problems.push(...scanText(file, readFileSync(file)));
    }
    expect(problems, 'Text encoding problems:' + ch(10) + problems.join(ch(10))).toEqual([]);
  });

  it('detects each class of damage and passes legitimate text', () => {
    const bad = (s: string) => scanText('x.ts', Buffer.from(s, 'utf8')).length;
    expect(bad('a' + ch(0xfffd) + 'b')).toBe(1);
    expect(bad(ch(0xe2) + ch(0x20ac) + ch(0x201d))).toBe(1);
    expect(bad(ch(0xc3) + ch(0xa9))).toBe(1);
    expect(bad(ch(0x251c) + ch(0xa9))).toBe(1);
    expect(bad(ch(0x252c) + ch(0x2556))).toBe(1);
    expect(bad(ch(0x0393) + ch(0xc7))).toBe(1);
    expect(scanText('x.ts', Buffer.from([0x61, 0xff, 0x62])).length).toBe(1);
    expect(scanText('x.ts', Buffer.from([0xef, 0xbb, 0xbf, 0x61])).length).toBe(1);
    expect(scanText('x.json', Buffer.from([0xef, 0xbb, 0xbf, 0x61])).length).toBe(0);
    // Legitimate: accents, rupee, em dash, Devanagari, box-drawing diagrams.
    expect(bad(ch(0xe9) + ch(0xc3) + ' ' + ch(0x20b9) + '5 ' + ch(0x2014) + ' ' + ch(0x0928) + ch(0x092e))).toBe(0);
    expect(bad(ch(0x251c) + ch(0x2500) + ch(0x2500) + ' ' + ch(0x2514) + ch(0x2500) + ch(0x252c) + ch(0x2500))).toBe(0);
  });
});
