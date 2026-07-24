# Knewledge

Knewledge turns screenshots, book photos, PDFs, web pages, and YouTube videos into a searchable private library and a weekly synthesis that connects new ideas to earlier captures.

## Repository layout

- `apps/web` — Responsive Next.js dashboard, mobile-friendly capture flow, and authenticated `/v1` API.
- `apps/extension` — Chromium Manifest V3 single-tab and bulk-tab capture extension.
- `apps/worker` — Trigger.dev processing and weekly digest jobs.
- `packages/contracts` — Zod API and model-output contracts.
- `packages/core` — URL safety, text chunking, schedule, and relationship logic.
- `supabase/migrations` — Postgres, pgvector, RLS, storage, and search functions.

## Local setup

1. Install Node 22+ and pnpm 10+.
2. Create a hosted Supabase project and apply every SQL file in `supabase/migrations` in filename order. For an existing project, apply only migrations that have not run yet.
3. Copy `apps/web/.env.local.example` to `apps/web/.env.local` and `apps/worker/.env.example` to `apps/worker/.env`, then fill in the credentials.
4. Add your lowercase email to `public.invites` in Supabase.
5. Run `pnpm install`.
6. Authenticate once with `pnpm --filter @knewledge/worker exec trigger login`.
7. In separate terminals, run `pnpm --filter @knewledge/worker dev` and `pnpm --filter @knewledge/web dev`.
8. For the extension, copy `apps/extension/.env.local.example` to `apps/extension/.env.local`, set `VITE_API_URL` to the web app origin, run `pnpm --filter @knewledge/extension build`, and load `apps/extension/build` as an unpacked extension.
9. On a phone, expose port 3000 with `ngrok http 3000`, add the resulting callback URL to Supabase Auth, and open `/capture` through the HTTPS ngrok URL. No App Store or Play Store application is required.

## Invite-only authentication

Add lowercase email addresses to `public.invites` before creating an account with Google or email/password, or before sending a magic link. The database profile hook rejects accounts without a valid, unused invite. Browser extensions pair from the dashboard using a short-lived, single-use code rather than storing a Supabase refresh token.

The web UI continues to use Supabase Auth so its user IDs remain compatible with the existing foreign keys and row-level security policies. To enable **Continue with Google**, configure the Google provider under Supabase Authentication → Providers and add both the local and production `/auth/callback` URLs to the redirect allow list. Email/password and magic-link sign-in work without a separate identity provider. For production email delivery, configure custom SMTP in Supabase rather than relying on the built-in development mailer.

## Processing behavior

Captures are accepted quickly and processed asynchronously. Image and PDF originals stay private in Supabase Storage. PDFs up to 25 MB are analyzed as both extracted text and page imagery, so scanned pages, tables, charts, and diagrams remain useful. URL workers fetch only public HTTP(S) pages, validate every redirect against SSRF, cap payloads, and never attempt to bypass access controls. YouTube processing first tries public caption tracks directly. When `SUPADATA_API_KEY` is configured in the Trigger.dev worker environment, it falls back to Supadata `auto` mode, which retrieves another available caption track or generates a transcript when necessary. Knewledge itself never downloads YouTube video or audio. Captured content is always treated as untrusted data in model prompts.

Create a Supadata key at `https://dash.supadata.ai`, add it as `SUPADATA_API_KEY` in the Trigger.dev production environment, and redeploy the worker from the repository root with `pnpm worker:deploy`. The root-level Trigger configuration ensures the native builder can bundle the shared pnpm workspace packages. Without this optional key, YouTube processing still uses the free direct-caption path but cloud-side YouTube blocking can produce false negatives.

The capture screen accepts up to 50 links in one paste. Commas, whitespace, newlines, and numbered-list text are accepted as separators, and every detected URL becomes its own capture occurrence.

Deleting a capture hides it immediately. The `cleanup-deleted-captures` scheduled task removes its private assets and cascaded derived data on the next hourly cleanup run.

## Verification

Run `pnpm check` for type checking, unit tests, and production builds. Database/RLS integration tests require a disposable Supabase project and are documented in `supabase/tests/README.md`.
