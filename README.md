# Knewledge

Knewledge turns screenshots, book photos, web pages, and YouTube videos into a searchable private library and a weekly synthesis that connects new ideas to earlier captures.

## Repository layout

- `apps/web` — Responsive Next.js dashboard, mobile-friendly capture flow, and authenticated `/v1` API.
- `apps/extension` — Chromium Manifest V3 single-tab and bulk-tab capture extension.
- `apps/worker` — Trigger.dev processing and weekly digest jobs.
- `packages/contracts` — Zod API and model-output contracts.
- `packages/core` — URL safety, text chunking, schedule, and relationship logic.
- `supabase/migrations` — Postgres, pgvector, RLS, storage, and search functions.

## Local setup

1. Install Node 22+ and pnpm 10+.
2. Create a hosted Supabase project and apply `supabase/migrations/0001_initial.sql`.
3. Copy `apps/web/.env.local.example` to `apps/web/.env.local` and `apps/worker/.env.example` to `apps/worker/.env`, then fill in the credentials.
4. Add your lowercase email to `public.invites` in Supabase.
5. Run `pnpm install`.
6. Authenticate once with `pnpm --filter @knewledge/worker exec trigger login`.
7. In separate terminals, run `pnpm --filter @knewledge/worker dev` and `pnpm --filter @knewledge/web dev`.
8. For the extension, copy `apps/extension/.env.local.example` to `apps/extension/.env.local`, set `VITE_API_URL` to the web app origin, run `pnpm --filter @knewledge/extension build`, and load `apps/extension/build` as an unpacked extension.
9. On a phone, expose port 3000 with `ngrok http 3000`, add the resulting callback URL to Supabase Auth, and open `/capture` through the HTTPS ngrok URL. No App Store or Play Store application is required.

## Invite-only authentication

Add lowercase email addresses to `public.invites` before sending a magic link. The database profile hook rejects accounts without a valid, unused invite. Browser extensions pair from the dashboard using a short-lived, single-use code rather than storing a Supabase refresh token.

## Processing behavior

Captures are accepted quickly and processed asynchronously. Image originals stay private in Supabase Storage. URL workers fetch only public HTTP(S) pages, validate every redirect against SSRF, cap payloads, and never attempt to bypass access controls. YouTube processing uses publicly available captions when present and never downloads video or audio. Captured content is always treated as untrusted data in model prompts.

## Verification

Run `pnpm check` for type checking, unit tests, and production builds. Database/RLS integration tests require a disposable Supabase project and are documented in `supabase/tests/README.md`.
