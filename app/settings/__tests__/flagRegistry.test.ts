import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { EXPECTED_FLAGS, registryDrift } from '../flagRegistry';

// Parity between this portal's expected flag list and auth-service's registry
// (services/auth-service/config/featureFlagRegistry.js). The pinned checks run
// everywhere; the live comparison runs when the backend repo is checked out
// beside this one (the repos/ and wt/ layouts on the founder's machine) and is
// skipped in CI, where only this repo exists.

const REGISTRY_REL = path.join('phool-gobhi-backend', 'services', 'auth-service', 'config', 'featureFlagRegistry.js');
const BACKEND_REGISTRY = [
  path.resolve(__dirname, '..', '..', '..', '..', REGISTRY_REL), // repos/phool-gobhi-admin
  path.resolve(__dirname, '..', '..', '..', '..', '..', 'repos', REGISTRY_REL), // wt/<task>
].find((p) => existsSync(p));

const project = (flags: ReadonlyArray<{ name: string; defaultEnabled: boolean; deps: string[]; clientKey: string | null; group: string }>) =>
  flags.map(({ name, defaultEnabled, deps, clientKey, group }) => ({ name, defaultEnabled, deps, clientKey, group }));

describe('expected flag registry', () => {
  it('registers the five coach flags exactly as auth-service declares them', () => {
    const coach = EXPECTED_FLAGS.filter((f) => f.group === 'coach');
    expect(project(coach)).toEqual([
      { name: 'homeIntroduction', defaultEnabled: false, deps: ['coachJourney'], clientKey: 'homeIntroductionEnabled', group: 'coach' },
      { name: 'coachJourney', defaultEnabled: false, deps: ['workoutTracking', 'nonPartnerAttendance'], clientKey: 'coachJourneyEnabled', group: 'coach' },
      { name: 'selfLinkGym', defaultEnabled: false, deps: [], clientKey: 'selfLinkGymEnabled', group: 'coach' },
      { name: 'personaSwitch', defaultEnabled: false, deps: [], clientKey: 'personaSwitchEnabled', group: 'coach' },
      { name: 'referralHomeTrigger', defaultEnabled: false, deps: ['coachJourney'], clientKey: 'referralHomeTriggerEnabled', group: 'coach' },
      { name: 'coachAssistant', defaultEnabled: false, deps: ['coachJourney'], clientKey: 'coachAssistantEnabled', group: 'coach' },
    ]);
  });

  it('has 27 flags, unique names, and every dep names a known flag', () => {
    const names = EXPECTED_FLAGS.map((f) => f.name);
    expect(names).toHaveLength(27);
    expect(new Set(names).size).toBe(names.length);
    for (const flag of EXPECTED_FLAGS) {
      for (const dep of flag.deps) expect(names, `${flag.name} depends on unknown ${dep}`).toContain(dep);
    }
  });

  it('only referral defaults on', () => {
    expect(EXPECTED_FLAGS.filter((f) => f.defaultEnabled).map((f) => f.name)).toEqual(['referral']);
  });

  it.skipIf(!BACKEND_REGISTRY)('matches the backend registry file flag for flag, in order', async () => {
    const mod = await import(/* @vite-ignore */ pathToFileURL(BACKEND_REGISTRY as string).href);
    expect(project(EXPECTED_FLAGS)).toEqual(project(mod.FEATURE_FLAGS));
  });
});

describe('registryDrift', () => {
  it('reports nothing when the live registry matches', () => {
    expect(registryDrift(EXPECTED_FLAGS)).toEqual({ missing: [], unexpected: [] });
  });

  it('reports flags an older auth-service does not serve yet', () => {
    const live = EXPECTED_FLAGS.filter((f) => f.group !== 'coach');
    expect(registryDrift(live).missing).toEqual(['homeIntroduction', 'coachJourney', 'selfLinkGym', 'personaSwitch', 'referralHomeTrigger', 'coachAssistant']);
  });

  it('reports flags a newer auth-service serves that this portal does not know', () => {
    expect(registryDrift([...EXPECTED_FLAGS, { name: 'brandNewFlag' }]).unexpected).toEqual(['brandNewFlag']);
  });
});
