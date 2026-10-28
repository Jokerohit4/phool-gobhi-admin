# First-run Home settings, 26 October 2026

Settings > Feature flags > Coach journey includes **Home introduction (FRE)**.
The live auth-service registry still owns rendering, current values, dependencies
and saves. The admin's parity mirror and fixtures now include all 26 flags,
including Food Finds and Home Introduction. Exploration has its own named group.

The FRE setting explains new-account enrolment, its Coach dependency, device-local
progress, the user's All tools escape, and that it does not reset individual
accounts. No remote per-account reset is exposed for device-local preferences.

## Dev deployment

- Admin preview: https://phool-gobhi-admin-3cmlplzkb-rohitashwa-singh-s-projects.vercel.app/settings
- Vercel deployment: `dpl_9x5FdAUiXuBaFgMKUXzxzyBRNgW9`, READY.
- Backend: `auth-service-dev-00112-7jv`, 100% of dev traffic.
- Registry: schema version 5, 26 flags, both Coach Journey and FRE enabled.

The preview explicitly uses the dev gateway and matching dev session signing key.
Vercel deployment protection and the existing staff login remain in place.
The public admin domain and production backend/configuration were not changed.

## Verification

- Admin: all 235 tests passed; type checking, lint and Next.js build passed.
- Auth service: 903 tests passed, eight skipped, no failures.
- Analytics event drift check passed.
- Live registry: unauthenticated request rejected with 401; authenticated read
  returned all 26 flags and the FRE dependency on Coach Journey.
- Deployed Settings: authenticated GET returned 200, both toggles checked, FRE
  explanation rendered, no registry drift warning.
- Live checks were read-only. Tests cover FRE changes in either direction and
  preservation of unrelated flags, version settings and maintenance windows.

The deployments used the local working trees; changes have not been committed
or pushed as part of this task.


## Pending local revision: water-first FRE

The local settings explanation now describes the two saved-activity gate, optional
reminders, 7/10/15 elapsed-day unlocks, and small rewards tapering over 14 days.
This revision has not been redeployed. See the customer app's
`docs/fre-implementation.md` for the exact activity amounts and migration.
