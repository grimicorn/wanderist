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

## Authentication

Authentication is handled by [Clerk](https://clerk.com) via the `@clerk/nuxt` module. Server middleware at `server/middleware/auth.ts` verifies the session on every request and makes the user available at `event.context.userId` in API route handlers.

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
- `SENTRY_AUTH_TOKEN`
- `SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
