# Email Unsubscriber — Docs

## Overview
A single-page app that scans a Gmail inbox for bulk/newsletter emails and presents all unsubscribe links in one place. Built on Cloudflare Workers (Next.js via OpenNext).

## Architecture
```
Browser                          Cloudflare Worker (Next.js)
┌──────────────────────┐        ┌──────────────────────────┐
│ React SPA            │        │ Next.js API routes       │
│ - OAuth flow trigger │───────▶│ - POST /api/auth/token   │──▶ Google OAuth
│ - Gmail API calls    │──▶ Gmail API (direct)            │
│ - Token in state     │        │ - POST /api/analyses     │──▶ D1
│ - Results display    │◀──────▶│ - GET  /api/analyses     │
└──────────────────────┘        └──────────────────────────┘
```

## Auth flow
1. User clicks "Sign in with Google"
2. Browser redirects to Google consent screen (scope: `gmail.readonly`)
3. Google redirects back with auth code
4. Browser sends code to `POST /api/auth/token`
5. Server exchanges code for access token using client secret (Wrangler secret)
6. Access token returned to browser, held in React state

## Analysis flow
1. User picks date range, clicks "Analyze"
2. Browser calls `gmail.users.messages.list` with date filters (paginated)
3. Browser calls `gmail.users.messages.get` for each message (metadata only, parallelized)
4. Client-side: filter messages with `List-Unsubscribe` header, group by sender
5. Display results: sender list with counts and unsubscribe links
6. Save results to D1 via API route

## Key headers used
- `From` — sender identification
- `List-Unsubscribe` — unsubscribe URL or mailto link (RFC 2369)
- `List-Unsubscribe-Post` — indicates one-click unsubscribe support (RFC 8058)
