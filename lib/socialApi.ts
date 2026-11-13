import { gatewayJson } from './api';

// Server-only: the platform-wide social switch (`config.social.enabled`) that
// mutes the Buddy tab, leaderboards and League together. It lives in the same
// app-config blob as the app versions, maintenance windows and feature flags
// (auth-service's appVersionSetting row), and PUT /api/auth/app-config/admin
// REPLACES that blob - so every write here is read-modify-write: fetch the
// stored blob, change social.enabled only, and send the rest back untouched.
//
// Defaults to off: anything other than a stored `true` reads as off, matching
// auth-service's socialConfigService.get().

export type AppConfigBlob = Record<string, unknown>;

const ADMIN_CONFIG_PATH = '/api/auth/app-config/admin';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function socialEnabledFrom(config: unknown): boolean {
  if (!isPlainObject(config)) return false;
  const social = config.social;
  return isPlainObject(social) && social.enabled === true;
}

/// The stored blob with only social.enabled changed. Every other top-level key
/// (features, maintenance, app versions, anything added later) and every other
/// key inside `social` is carried over as-is.
export function withSocialEnabled(config: AppConfigBlob, enabled: boolean): AppConfigBlob {
  const social = isPlainObject(config.social) ? config.social : {};
  return { ...config, social: { ...social, enabled } };
}

async function loadStoredConfig(): Promise<AppConfigBlob> {
  const body = await gatewayJson<{ data?: unknown }>(ADMIN_CONFIG_PATH);
  const data = body?.data;
  // Refuse rather than write a blob built from nothing: a PUT of just
  // {social} would wipe the flags and app versions for every install.
  if (!isPlainObject(data)) {
    throw new Error('Could not read the current app config — not saving, so nothing else is overwritten');
  }
  return data;
}

export async function loadSocialEnabled(): Promise<boolean> {
  return socialEnabledFrom(await loadStoredConfig());
}

export async function setSocialEnabled(enabled: boolean): Promise<void> {
  const current = await loadStoredConfig();
  await gatewayJson(ADMIN_CONFIG_PATH, {
    method: 'PUT',
    body: JSON.stringify({ config: withSocialEnabled(current, enabled) }),
  });
}
