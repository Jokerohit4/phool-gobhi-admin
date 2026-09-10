'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { gatewayJson } from '@/lib/api';
import type { ActionState } from '@/components/ui/ActionForm';

// Must match auth-service's own DEFAULT_FEATURES and Settings' copy exactly.
// healthPersonalisation and recapSharing are additive on top of healthMetrics
// — see the page for why they are separate gates.
interface FeatureFlags {
  buddy: { enabled: boolean };
  badges: { enabled: boolean };
  streaksCoins: { enabled: boolean };
  challenges: { enabled: boolean };
  buddyPairedStreaks: { enabled: boolean };
  healthMetrics: { enabled: boolean };
  healthPersonalisation: { enabled: boolean };
  recapSharing: { enabled: boolean };
}

const DEFAULT_FEATURES: FeatureFlags = {
  buddy: { enabled: true },
  badges: { enabled: false },
  streaksCoins: { enabled: false },
  challenges: { enabled: false },
  buddyPairedStreaks: { enabled: false },
  healthMetrics: { enabled: false },
  healthPersonalisation: { enabled: false },
  recapSharing: { enabled: false },
};

// PUT /app-config/admin replaces the config wholesale, so the whole blob
// (versions + maintenance + every other feature) has to be read and
// resubmitted together. Same read-modify-write requirement as Settings' and
// Coins' equivalents — writing only the health keys would silently wipe the
// app-version and maintenance settings.
async function loadCurrentAppConfig(): Promise<{
  versions: Record<string, Record<string, unknown>>;
  features: FeatureFlags;
  maintenance: Record<string, unknown>;
}> {
  const { data } = await gatewayJson<{ data: Record<string, unknown> }>('/api/auth/app-config/admin');
  const { features, maintenance, ...versions } = data;
  return {
    versions: versions as Record<string, Record<string, unknown>>,
    features: { ...DEFAULT_FEATURES, ...((features as Partial<FeatureFlags>) || {}) },
    maintenance: (maintenance as Record<string, unknown>) || {},
  };
}

export async function setHealthFeatureFlagsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  const healthMetrics = formData.get('healthMetricsEnabled') === 'on';
  const healthPersonalisation = formData.get('healthPersonalisationEnabled') === 'on';
  const recapSharing = formData.get('recapSharingEnabled') === 'on';

  // Both sub-features sit behind healthMetrics server-side (health-service
  // stacks requireFeatureFlag on both), so leaving one on while the parent is
  // off would show an admin an "enabled" switch for a route that returns 403.
  // Corrected here rather than rejected — the intent is unambiguous.
  const corrected = !healthMetrics && (healthPersonalisation || recapSharing);

  try {
    const current = await loadCurrentAppConfig();
    const features: FeatureFlags = {
      ...current.features,
      healthMetrics: { enabled: healthMetrics },
      healthPersonalisation: { enabled: healthMetrics && healthPersonalisation },
      recapSharing: { enabled: healthMetrics && recapSharing },
    };
    await gatewayJson('/api/auth/app-config/admin', {
      method: 'PUT',
      body: JSON.stringify({ config: { ...current.versions, maintenance: current.maintenance, features } }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to update flags' };
  }

  revalidatePath('/health');
  return {
    ok: true,
    message: corrected
      ? 'Saved. Personalisation and recap sharing were switched off too — both require Health metrics to be on.'
      : 'Health switches updated',
  };
}

export async function updateRetentionPolicyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  const suggestionFeedbackDays = Number(formData.get('suggestionFeedbackDays'));
  // health-service enforces the same 30-day floor and rejects anything
  // outside it. Checked here too so the admin gets a sentence instead of a
  // raw gateway error, and so the reason is visible at the point of edit.
  if (!Number.isInteger(suggestionFeedbackDays) || suggestionFeedbackDays < 30 || suggestionFeedbackDays > 3650) {
    return { ok: false, message: 'Must be a whole number of days between 30 and 3650' };
  }

  try {
    await gatewayJson('/api/health/admin/retention-policy', {
      method: 'PUT',
      body: JSON.stringify({ suggestionFeedbackDays }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to save retention policy' };
  }

  revalidatePath('/health');
  return { ok: true, message: `Telemetry now expires after ${suggestionFeedbackDays} days` };
}
