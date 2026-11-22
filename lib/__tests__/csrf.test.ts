import { describe, it, expect } from 'vitest';
import { isCrossOrigin, rejectCrossOrigin, requireJsonContentType, guardJsonPost } from '../csrf';

function req(headers: Record<string, string> = {}, url = 'https://admin.example.com/api/x') {
  return new Request(url, { method: 'POST', headers });
}

describe('isCrossOrigin', () => {
  it('allows requests with neither Origin nor Sec-Fetch-Site', () => {
    expect(isCrossOrigin(req())).toBe(false);
  });

  it('allows a same-origin Origin header', () => {
    expect(isCrossOrigin(req({ origin: 'https://admin.example.com', host: 'admin.example.com' }))).toBe(false);
  });

  it('rejects a different Origin', () => {
    expect(isCrossOrigin(req({ origin: 'https://evil.example', host: 'admin.example.com' }))).toBe(true);
  });

  it('rejects the opaque "null" Origin', () => {
    expect(isCrossOrigin(req({ origin: 'null', host: 'admin.example.com' }))).toBe(true);
  });

  it('rejects Sec-Fetch-Site: cross-site even without Origin', () => {
    expect(isCrossOrigin(req({ 'sec-fetch-site': 'cross-site' }))).toBe(true);
  });

  it('allows same-origin / none Sec-Fetch-Site values', () => {
    expect(isCrossOrigin(req({ 'sec-fetch-site': 'same-origin' }))).toBe(false);
    expect(isCrossOrigin(req({ 'sec-fetch-site': 'none' }))).toBe(false);
  });

  it('prefers X-Forwarded-Host when behind a proxy', () => {
    expect(
      isCrossOrigin(req({ origin: 'https://admin.example.com', host: 'internal:3000', 'x-forwarded-host': 'admin.example.com' })),
    ).toBe(false);
  });
});

describe('guards', () => {
  it('rejectCrossOrigin returns 403 for cross-origin and null otherwise', async () => {
    const bad = rejectCrossOrigin(req({ 'sec-fetch-site': 'cross-site' }));
    expect(bad?.status).toBe(403);
    expect(rejectCrossOrigin(req())).toBeNull();
  });

  it('requireJsonContentType returns 415 for non-JSON bodies', () => {
    expect(requireJsonContentType(req({ 'content-type': 'text/plain' }))?.status).toBe(415);
    expect(requireJsonContentType(req({ 'content-type': 'application/x-www-form-urlencoded' }))?.status).toBe(415);
    expect(requireJsonContentType(req())?.status).toBe(415);
    expect(requireJsonContentType(req({ 'content-type': 'application/json; charset=utf-8' }))).toBeNull();
  });

  it('guardJsonPost checks origin first, then content type', () => {
    expect(guardJsonPost(req({ 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' }))?.status).toBe(403);
    expect(guardJsonPost(req({ 'content-type': 'text/plain' }))?.status).toBe(415);
    expect(guardJsonPost(req({ 'content-type': 'application/json' }))).toBeNull();
  });
});
