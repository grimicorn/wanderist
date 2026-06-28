# Wanderist

A travel planning and exploration app.

## Requirements

- Node.js >= 24 (see [.nvmrc](.nvmrc))
- npm

## Setup

Install dependencies:

```bash
npm install
```

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

See `.env.example` for descriptions of each variable and where to obtain them.

## Database

The app uses [Drizzle ORM](https://orm.drizzle.team) with a [Neon](https://neon.tech) serverless Postgres database.

Push the schema to Neon (useful for initial setup):

```bash
npm run db:push
```

Generate a migration from schema changes:

```bash
npm run db:generate
```

Apply pending migrations:

```bash
npm run db:migrate
```

Open Drizzle Studio (visual database browser):

```bash
npm run db:studio
```

## Media storage

File uploads (photos, cover images) are stored in [Netlify Blobs](https://docs.netlify.com/blobs/overview/) under the `media` store. Blobs are keyed as `<userId>/<mediaId>` and served back through the proxy route `GET /api/media/[id]`, which sets long-lived `Cache-Control` headers.

### Local development

The recommended approach is to run the app via the [Netlify CLI](https://docs.netlify.com/cli/overview/):

```bash
netlify dev
```

`netlify dev` injects `NETLIFY_SITE_ID` and an auth token automatically, so Blobs works with no extra configuration. The local store is sandboxed and does not read from production.

If you run `npm run dev` directly (without `netlify dev`), set the following variables in your `.env`:

```
NETLIFY_SITE_ID=<your-project-id>   # Project settings → General
NETLIFY_AUTH_TOKEN=<token>          # User settings → OAuth → Personal access tokens
```

### Production

On Netlify, no extra configuration is needed. The runtime injects credentials automatically.

---

## Authentication

Authentication is handled by [Clerk](https://clerk.com) via the `@clerk/nuxt` module. Server middleware at `server/middleware/auth.ts` verifies the session on every request and makes the user available at `event.context.userId` in API route handlers.

### Clerk webhook setup

Clerk webhooks keep the `users` table in sync with Clerk's user directory. The webhook handler lives at `server/api/webhooks/clerk.post.ts` and listens for `user.created`, `user.updated`, and `user.deleted` events.

To configure the webhook in the Clerk Dashboard:

1. Go to **Clerk Dashboard → Webhooks → Add Endpoint**.
2. Set the endpoint URL to `https://<your-domain>/api/webhooks/clerk`.
3. Subscribe to the `user.created`, `user.updated`, and `user.deleted` events.
4. Copy the **Signing Secret** (starts with `whsec_`) and set it as `NUXT_CLERK_WEBHOOK_SECRET` in your environment.

## Connected accounts

### Instagram (photo import)

Wanderist connects to Instagram via the **Instagram Graph API** (not the deprecated Basic Display API). This requires a Facebook App linked to a Business or Creator Instagram account.

**Setup:**

1. Go to [Meta for Developers](https://developers.facebook.com) → Create App → Business type.
2. Add the **Instagram** product to the app.
3. Under Instagram → Settings, add `https://<your-domain>/api/connections/instagram/callback` as a valid OAuth redirect URI.
4. Copy the **App ID** and **App Secret** and set them as `INSTAGRAM_CLIENT_ID` and `INSTAGRAM_CLIENT_SECRET` in your environment.

**How it works:**

- `GET /api/connections/instagram/start` — sets a CSRF state cookie and redirects the user to Instagram's OAuth authorization page.
- `GET /api/connections/instagram/callback` — exchanges the authorization code for a long-lived token (60-day expiry), stores the encrypted token in `connected_accounts`, then redirects to `/settings#connections`.
- `DELETE /api/connections/instagram` — removes the row from `connected_accounts`, revoking access.
- `POST /api/connections/instagram/import` — pulls recent geotagged media, stores images in Netlify Blobs, and creates journal entries with linked places.

Access tokens are encrypted at rest using AES-256-GCM. Generate a key with `openssl rand -hex 32` and set it as `TOKEN_ENCRYPTION_KEY`.

### Google (via Clerk)

Google sign-in is managed by Clerk's hosted OAuth flow — users connect Google through Clerk's sign-in UI. The Settings → Connections section reads the real connection state from Clerk's API rather than maintaining a separate database row.

- `GET /api/connections/google` — returns `{ connected, emailAddress, identificationId }` from Clerk.
- `DELETE /api/connections/google` — removes the Google external account from the user's Clerk record via the Clerk Backend API.

No additional app registration is required for Google; Clerk handles it. Configure Google OAuth in the [Clerk Dashboard](https://dashboard.clerk.com) → Social Connections → Google.

---

## Development

Start the dev server at `http://localhost:3000`:

```bash
npm run dev
```

## Testing

Run unit tests in watch mode:

```bash
npm test
```

Run once (CI mode):

```bash
npm run test:ci
```

Run end-to-end tests (requires `.env.e2e`):

```bash
npm run e2e
```

## Linting

Check for issues:

```bash
npm run lint
```

Auto-fix:

```bash
npm run lint:fix
```

## Security scanning

A deterministic scanner layer runs both locally and in CI.

### Secret detection (gitleaks)

[gitleaks](https://github.com/gitleaks/gitleaks) scans for committed secrets. The
rules live in [.gitleaks.toml](.gitleaks.toml): the built-in default ruleset plus
custom rules for Clerk secret keys (`sk_live_` / `sk_test_`) and Postgres
connection strings with embedded credentials. Example env files and test fixtures
are allowlisted.

A husky `pre-commit` hook scans staged changes and blocks the commit on any
finding. Install it (and all other hooks) with:

```bash
npm install
```

To run the same staged scan manually:

```bash
gitleaks git --staged --redact --no-banner --config .gitleaks.toml
```

Install the gitleaks binary locally with `brew install gitleaks` (macOS) or from the
[releases page](https://github.com/gitleaks/gitleaks/releases). In CI the pinned
binary is downloaded (and checksum-verified) before it runs — pull requests scan
the PR commit range, pushes scan full history, and any finding fails the build.

### Dependency vulnerabilities

CI runs `npm audit` and fails the build only on **high** or **critical**
advisories; moderate and low are printed as a summary but do not fail.
[Dependabot](.github/dependabot.yml) opens grouped minor/patch update PRs weekly.

## Build & Preview

```bash
npm run build
npm run preview
```

## Deployment

The app deploys to Netlify automatically on push to `main`. CI runs lint and unit tests before the build. E2e tests run as a separate job after CI passes.

Required repository secrets (Settings → Secrets → Actions):

- `E2E_DATABASE_URL`
- `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NUXT_CLERK_SECRET_KEY`
- `NUXT_CLERK_WEBHOOK_SECRET`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
