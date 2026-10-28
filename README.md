# ReviewTap — Dynamic QR management

ReviewTap generates reusable QR codes that point to this application's
`/r/:qrId` review-assistant page. Admins can create unique unassigned codes,
program them to categorized businesses, update review destinations without
reprinting, and manage inventory from an authenticated dashboard. Customers can
use category-specific prompts to reflect on their own experience, write their
own review, and continue to Google Reviews themselves.

## Stack and persistence

- Vite + React 19 (JavaScript)
- Node.js API and local `node:sqlite` database for development
- Neon Postgres in Vercel, with migrations in `server/migrations/postgres/`
- `qrcode` for PNG, SVG, preview, and print output
- Vitest, Testing Library, and oxlint

Use Node.js 22.13.0 or newer. The server requires an admin password of at
least 12 characters. Configure it through the environment; do not commit it
to the repository.

## Local development

Install dependencies once:

```powershell
npm ci
```

Copy the environment example and replace the nonfunctional placeholders:

```powershell
Copy-Item .env.example .env
# Edit .env and replace ADMIN_PASSWORD and ADMIN_SESSION_SECRET.
# The password must be 12+ characters; the secret must be 32+ characters.
# Set PUBLIC_BASE_URL to http://localhost:5173 for local development.
npm run dev
```

`.env.example` contains placeholders only and is not ready to run or deploy
unchanged. The placeholder password and session secret intentionally fail
minimum-length validation. Use real local-only values in `.env`; never commit
that file.

Open the Vite URL printed in the terminal and choose **QR dashboard** or visit
`/admin`. During development, generated QR links use
`http://localhost:5173/r/:qrId`; Vite serves the review-assistant page directly and
proxies its API requests to a local Node API that Vite starts automatically. Keep the terminal open
while using the app. If port 3001 is already in use, stop the other process or
set `$env:API_PORT` to a free port before `npm run dev`.

`npm run dev:server` is available when running only the backend separately.
Do not run it alongside Vite, which starts its own development API.

The default database is `data/reviewtap.sqlite`. The server creates it and
applies unapplied SQL migrations on startup. Stop the server before backing up
this file. `DATABASE_URL` in `.env.example` is only for Vercel/Neon; local
development uses SQLite. Migration `003-business-category-id.sql` adds the
stable category ID column and assigns existing businesses to **Other / General
Business** without changing their business IDs, QR assignments, or legacy
category values. Migration `004-qr-inventory-codes.sql` adds a unique,
backfilled inventory code to each existing QR without changing its permanent
QR ID, assignment, or public URL. It also initializes the server-side inventory
sequence and batch idempotency records. The equivalent Postgres migrations run
automatically with the first API request after deployment. Back up the database
before deployment and verify the applied migration names before using the
inventory workflow.

## Build and run

Build the frontend, then run the application server (which serves both the
frontend and the redirect/API routes):

```powershell
npm run build
# For a local standalone run only; replace this placeholder before running.
$env:ADMIN_PASSWORD = 'REPLACE_ME'
$env:PUBLIC_BASE_URL = 'https://your-public-domain.example'
npm start
```

Set `PUBLIC_BASE_URL` to the public HTTPS origin before deployment. QR images
encode that origin, so it must resolve to this server (or to a reverse proxy
that forwards `/api/*` and `/r/*` to it). `PORT` defaults to `3001`; set it
when the hosting environment provides another port. HTTPS is required except
for localhost development. Production admin cookies are `HttpOnly`, `Secure`,
and `SameSite=Strict`; terminate TLS at a trusted reverse proxy.

`npm run preview` builds and starts the full application server. Both
`npm run preview` and `npm start` require `ADMIN_PASSWORD`; production also
requires `PUBLIC_BASE_URL`.

## Deploy to Vercel with Neon

The Vercel deployment uses serverless API functions and Neon Postgres. It
does **not** use the local SQLite file: data entered in local development
does not automatically transfer to the deployed database.

1. Push this project to a GitHub repository and import that repository in
   Vercel. Keep the build command as `npm run build` and the output directory
   as `dist` (both are also set in `vercel.json`). Set the Root Directory to
   the repository root and select Node.js 22.x in the Vercel project settings.
2. Create a Neon Postgres database, either directly in Neon or through the
   Vercel Marketplace integration. Copy its pooled Postgres connection string.
3. In **Vercel → Project → Settings → Environment Variables**, add:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon Postgres pooled connection string |
   | `ADMIN_PASSWORD` | Unique admin password, at least 12 characters |
   | `ADMIN_SESSION_SECRET` | Random secret of at least 32 characters |
   | `PUBLIC_BASE_URL` | Your stable public HTTPS origin, e.g. `https://your-project.vercel.app` |

   Generate a session secret locally with
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`.
   Add the variables to **Production** (and Preview if you want preview
   deployments to use the same Neon database). Replace every example value
   with the intended value before deployment; the `.example` domain and
   `USER:PASSWORD@HOST/DATABASE` connection string are nonfunctional. Configure
   production secrets only in Vercel's Environment Variables (or the hosting
   provider's secret settings), never in `.env.example`, source files, or Git.
4. Redeploy. The Postgres schema migrations run automatically on the first
   API request. Open `https://your-project.vercel.app/admin` and sign in.
5. Generate and assign a test QR, then visit its `/r/:qrId` URL. Confirm the
   review assistant loads and its Google Reviews link opens the saved destination.

Vercel routes `/api/*` and `/r/:qrId` through explicit Node.js function
entrypoints using `vercel.json` rewrites. After changing these routes, trigger
a fresh deployment and check its **Functions** build output includes
`api/index.js` and `api/redirect.js`. If `/api/auth/session` still returns a
Vercel-branded 404, verify that the deployment uses this repository's latest
commit, the repository root as its Root Directory, and the Vite project
settings above; that response means the request did not reach the app handler.

The dynamic redirect always uses `PUBLIC_BASE_URL`; set it to the permanent
public domain before generating printed codes. If you later change domains,
old printed codes still point at the old origin, so keep that domain serving
the app or configure it to forward `/r/*` to the new deployment.

This repository is now configured for Vercel. Netlify is not configured:
deploying there needs a Netlify Functions adapter and its routing configuration.
The SQLite + Node server is for local development or a persistent Node host,
not a static-only Vercel/Netlify deployment.

## Admin workflow

1. Generate one QR or a batch of up to 500. Each record retains its permanent
   `rt-…` QR ID and receives a unique, stable inventory code such as `RT-0001`.
   New stands are initially **Unassigned**. Batch requests use an idempotency
   key so retrying the same request returns the original batch.
2. Search or filter by inventory code and status. Select stands for printing,
   print the visible page, or print the last generated batch. A4 print sheets
   use the ReviewTap logo, the permanent public QR URL, a QR with its quiet
   zone, the short code, and “Scan to leave a review.” Reprinting uses the same
   stored QR record and URL.
3. Choose **Program** on an unassigned code, then select an existing business
   or add one with a Google review URL. A successful assignment cannot be
   repeated without an explicit reset. The confirmation shows the stand code
   and selected business. The existing QR-to-business relationship is updated;
   the QR ID and printed URL do not change.
4. An unassigned printed stand displays an activation message and does not
   expose business or destination data. Disabled stands display an unavailable
   message. Assigned stands load the saved business category and validated
   destination.
5. Use **Test redirect** to verify the saved destination and open the QR
   redirect endpoint. Use the PNG/SVG actions for individual print-ready codes
   (business name, QR ID, and short inventory code are printed beneath each
   code), **Print last batch** or **Print visible page**
   for printing, and **Export CSV** for
   the filtered inventory.
6. Set a business category when adding or editing a business. The review
   assistant uses that category to show relevant prompts. Edit a business's name,
   category, or Google review URL on the **Businesses** tab; existing QR codes
   keep working without being regenerated.
7. **Reset assignment** requires an explicit confirmation and is recorded in
   the audit log. Admins can also disable or re-enable codes.

Only secure HTTPS Google review/Maps URL forms are accepted (including
`g.page`, Google Maps short links, Google Maps URLs, and
`search.google.com/local/writereview`). Non-Google destinations and insecure
HTTP URLs are rejected. The public review assistant uses only the validated destination saved for the
QR's assigned business. It does not choose a star rating or submit reviews.

Admin login uses `ADMIN_PASSWORD`; failed attempts are rate-limited per client
address. Secure, HttpOnly sessions are stored in the database and expire after
12 hours, so they work across Vercel function instances. The
`audit_logs` table records QR generation, assignment, reset, disable/enable,
and business edit actions. The admin can retrieve the most recent entries
through the authenticated `GET /api/audit` endpoint.

## Commands and tests

```powershell
npm test
npm run lint
npm run build
```

Tests cover URL validation, QR image generation, the existing public page,
unique bulk generation, authentication, safe assignment, reassignment/reset
protection, business destination updates, business categories, public review-assistant lookup,
audit records, disabled QR codes, and review-assistant routing.

## Existing public content

The public landing page and its contact, policy, and informational sections
remain available at `/`. Brand and contact details can still be changed in
`src/content/siteContent.js`. The former browser-only direct-to-Google QR
generator now links to the admin dashboard so new QR codes always use the
dynamic redirect workflow.
