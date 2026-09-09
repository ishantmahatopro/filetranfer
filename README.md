# Location sharing + private dashboard

A consent-based web page that asks a visitor to share their location, and a
**private, login-gated dashboard** that plots every reading on a live map —
only you can see it. The VPN check and the Bangalore geofence run on the
server, so no API keys ever live in the browser.

```
visitor → index.html ──POST──▶ Supabase Edge Function (collect)
                                  │  ├─ vpnapi.io lookup  (secret key)
                                  │  ├─ Bangalore geofence (from GPS)
                                  │  └─ stores reading if allowed
                                  ▼
                            locations table  ──realtime──▶ dashboard.html (you, logged in)
```

This is a **transparent** tool. The public page tells the visitor their
location is shared with you, and the browser shows its own location prompt.
Send it to people who expect to share their location with you — not to track
anyone who hasn't agreed.

## Files

| File | What it is |
|------|-----------|
| `index.html` | Public page the visitor opens. No secrets in it. |
| `dashboard.html` | Your private map dashboard. Requires login. |
| `supabase/migrations/0001_init.sql` | `locations` table + row-level security + realtime. |
| `supabase/functions/collect/index.ts` | Serverless endpoint: VPN + geofence check, stores readings. |

## One-time setup

### 1. Create a Supabase project
At <https://supabase.com> create a free project. Grab these from
**Project Settings → API**: the **Project URL**, the **anon/publishable key**,
and the **project ref** (the `xxxx` in `xxxx.supabase.co`).

### 2. Apply the schema
In the Supabase dashboard → **SQL Editor**, paste and run the contents of
`supabase/migrations/0001_init.sql`. (Or with the CLI: `supabase db push`.)

### 3. Deploy the Edge Function and its secrets
With the [Supabase CLI](https://supabase.com/docs/guides/cli):
```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set VPNAPI_KEY=your_vpnapi_key
supabase secrets set ALLOWED_ORIGIN=https://YOUR-USERNAME.github.io   # your site origin
supabase functions deploy collect --no-verify-jwt
```
`--no-verify-jwt` lets the public page call it without a login. The function
URL is `https://YOUR-PROJECT-REF.supabase.co/functions/v1/collect`.

### 4. Create YOUR dashboard account, then lock sign-ups
In **Authentication → Users**, add your own user (email + password). Then in
**Authentication → Providers / Sign In**, **disable new sign-ups** so nobody
else can register and read the data.

### 5. Fill in the two front-end configs
- `index.html` → `CONFIG.endpoint` = your `collect` function URL (and optional
  `recipientName`).
- `dashboard.html` → `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

### 6. Host the pages
GitHub Pages works (Settings → Pages → deploy from this branch, root).
**HTTPS is required** — the browser location API won't run over plain HTTP.
- Public link to share: `https://YOUR-USERNAME.github.io/cyber/`
- Your dashboard: `https://YOUR-USERNAME.github.io/cyber/dashboard.html`

## Where do the locations go / how do I see them?
Every allowed reading is a row in the `locations` table. Open
`dashboard.html`, sign in with your account, and they appear as map markers and
a live list — new ones stream in automatically via Supabase Realtime. Because
of row-level security, an anonymous visitor (or anyone without your login) gets
**nothing** from that table.

## Access rule
In `supabase/functions/collect/index.ts`, `shouldBlock()` decides who is turned
away. Default (per request): block only when the visitor is **both on a VPN and
outside Bangalore**. A commented alternative blocks all VPNs / allows only
inside Bangalore. Change it and redeploy the function. The Bangalore check uses
the GPS coordinates, so a VPN can't fake it.

## Honest limitations
- **VPN detection is never 100%** — IP reputation misses some VPNs and can
  false-positive.
- **GPS accuracy varies** — metres on a phone, sometimes hundreds of metres on
  a laptop. The reading's accuracy is stored and shown.
- **A visitor can decline** the browser prompt; then nothing is sent. By design.

## Security note
Your vpnapi key was briefly committed in an earlier version of this page's
client code. Since it was exposed in the repo, **rotate it** in your vpnapi.io
dashboard and set the new one only as the `VPNAPI_KEY` secret (step 3) — never
back in the HTML.

## Please use it responsibly
Keep the consent notice honest, and only send the link to people who expect to
share their location with you.
