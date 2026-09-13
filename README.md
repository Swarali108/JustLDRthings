# JustLDRthings ♡

_Little things, big feelings._

A private creative web app for long-distance couples. Make little digital
gestures — notes, letters, songs, love coupons, photos, videos and voice notes —
collect them onto one scrapbook page, and share a single private link.

Built from the Complete Product Blueprint. This repository implements the
**core end-to-end loop** (the blueprint's "First Milestone"): sign up → create →
compose a page → preview → publish a private link → recipient opens it.

## Stack

| Layer      | Tech |
|------------|------|
| App        | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling    | Hand-written CSS design system (`app/globals.css`, `app/ui.css`) |
| Backend    | Supabase — Postgres, Auth, Storage, Row Level Security |
| Validation | Zod |
| AI (opt.)  | OpenAI API, server-side only |
| Deploy     | Vercel |

## What's built

- **Auth** — Supabase email/password, session middleware, protected routes.
- **Landing page** — scrapbook hero, how-it-works, creation preview, privacy.
- **Dashboard** — "What will you create today?" hub + your library + your pages.
- **Creators** — note, letter, song + note, love coupon, photo/video, voice note
  (record or upload). Doodle / bouquet / collage are placeholder routes for the
  next phase.
- **Page composer** — add / reorder / remove items, edit title, live preview.
- **Sharing** — publish + high-entropy token (only the SHA-256 hash is stored),
  rotate or disable the link.
- **Recipient experience** — `/for-you/[token]`, resolved through a
  `SECURITY DEFINER` RPC, with private media served via short-lived signed URLs.
- **Optional AI** — "help me write this" for notes/letters, server-side only.

## Local setup

### 1. Create a Supabase project

At [supabase.com](https://supabase.com), create a project. Then in
**SQL Editor**, paste and run the migration:

```
supabase/migrations/0001_init.sql
```

This creates the schema, RLS policies, the share-resolution and coupon-redeem
RPCs, and the storage buckets (`user-media`, `generated-previews`, `app-assets`).

> **Auth note:** for the fastest local test, in
> **Authentication → Providers → Email**, turn *Confirm email* **off** so signup
> logs you straight in. Leave it on for production.

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in values from
**Project Settings → API**:

```bash
cp .env.example .env.local
```

| Variable | Where |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (client-safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key (client-safe; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** — signs recipient media |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` in dev; your domain in prod |
| `OPENAI_API_KEY` | **server only**, optional. Leave blank to disable AI |

Never commit `.env.local`. It is gitignored.

### 3. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Scripts

- `npm run dev` — dev server
- `npm run build` / `npm start` — production build
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — Next.js ESLint

## Security model

- All user content is **private by default**; RLS restricts every row to its
  owner. Changing an id in a URL cannot reveal another user's data.
- Recipients never get row access. A share link is resolved server-side through
  `resolve_shared_page(token_hash)`, which returns only recipient-safe,
  published data.
- Only the token **hash** is stored. The raw token lives in the URL and is shown
  to the creator once per rotation.
- Private media (`user-media`) is never public; recipients receive short-lived
  **signed URLs** minted by the service-role client after the token validates.
- The service-role key and OpenAI key are **server-only** and never reach the
  browser.

## Deploy (Vercel)

1. Push to a Git repo and import it in Vercel.
2. Add the same environment variables in **Vercel → Settings → Environment
   Variables** (set `NEXT_PUBLIC_APP_URL` to your production URL).
3. Deploy. Supabase Auth redirect URLs should include your production domain.

## Project structure

```
app/
  (auth)/            login, signup, auth server actions
  create/            creators (note, letter, song, coupon, media, voice) + [type] placeholder
  dashboard/         creation hub + library + pages
  page/[pageId]/     edit (composer) + preview
  for-you/[token]/   recipient experience
  api/               ai/write, coupons/redeem
components/
  auth/ app/ creators/ composer/ scrapbook/ ui/
lib/
  supabase/          browser, server, admin, middleware clients
  validation.ts share.ts media.ts content-types.ts page-data.ts
supabase/migrations/ schema + RLS + RPC + storage
types/db.ts          hand-written DB types
middleware.ts        session refresh + route guard
```

## Roadmap (next phases)

- Canvas creators: doodle, bouquet builder, collage templates.
- Recipient reveal animations & themes.
- Share passcodes / expiry, reactions.
- Couple spaces, countdowns, "open when…" time capsules, printable export.

---

JustLDRthings ♡ · Complete Product Blueprint · 2026
