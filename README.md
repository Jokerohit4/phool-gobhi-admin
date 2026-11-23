# Phool Gobhi Admin

Internal staff (gobhi-role) admin portal for the Phool Gobhi platform. Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, and Recharts.

## Requirements

- Node.js 20+
- npm
- Access to a Phool Gobhi API gateway and matching auth/Firebase configuration

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local` from `.env.local.example` and set values:
   - `GATEWAY_URL` — backend gateway base URL (dev by default; do not point at prod until proven)
   - `JWT_SECRET` — must match auth-service `JWT_SECRET` (access tokens are verified in `proxy.ts`)
   - `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` — Firebase web app config for Google sign-in

## Scripts

```bash
npm run dev        # start dev server
npm run build      # production build
npm run start      # start production server
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run test       # vitest run
```

## Auth and access

- Supports email/password and Firebase Google sign-in (proxied through app routes).
- Only active `gobhi` accounts can access the portal; non-gobhi users are rejected.
- Sessions use host-only cookies `pg_admin_at` / `pg_admin_rt` (not shared with customer/partner web domains).
- Access is enforced in `proxy.ts` and server-side session checks.

## Key areas

- **Dashboard** (`/`) — overview counts and quick links
- **Gyms** — approval queue, gym detail/docs/reviews, approve/reject
- **Users / Attendance / Fulfillment / Payouts** — operational views and actions
- **Analytics** — funnels, trends, cohorts, journey lookup, and related views
- **Content / Reports / Notifications / Coaching plans** — content and ops tooling
- **Settings** (`/settings`) — launch gate & maintenance, policy & billing, feature flags & social switch, OTP & auth, app versions

## Notes

- Server-side requests go to the gateway via `GATEWAY_URL`; browser-facing behavior should follow existing BFF/API-route patterns in this repo.
- Deployed via Vercel git integration (follow platform branch/deploy conventions for this repo).
