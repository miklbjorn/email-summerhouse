# Implementation Plan

## Issue 1: Project scaffolding and layout shell
**Status:** Not started

Remove Next.js boilerplate. Set up the basic app layout with a header and main content area. Configure Tailwind. Add a `.dev.vars.example` file documenting required env vars (Google OAuth client ID).

**Scope:**
- Replace `src/app/page.tsx` boilerplate with app shell
- Update metadata in `layout.tsx`
- Add `GOOGLE_CLIENT_ID` to wrangler.jsonc vars (public, safe to commit)
- Add `GOOGLE_CLIENT_SECRET` to `.dev.vars.example` (actual value as Wrangler secret, never committed)
- Clean up unused boilerplate assets

---

## Issue 2: Google OAuth sign-in flow
**Status:** Not started

Implement Google OAuth Authorization Code flow with PKCE. User clicks "Analyze", is redirected to the Google consent screen (requesting `gmail.readonly` scope), then redirected back with an auth code. A Next.js API route (`/api/auth/callback`) exchanges the code for an access token using the client secret and runs the analysis server-side. The token is never returned to the client.

**Scope:**
- "Analyze" button on the main page starts OAuth flow
- Generate OAuth URL with correct scopes, redirect URI, PKCE code verifier/challenge
- Store PKCE code verifier in a secure, short-lived cookie for callback validation
- API route `GET /api/auth/callback` — receives auth code, exchanges for access token via Google's token endpoint, runs analysis, returns results to client
- Handle auth errors and token expiry (1 hour)

---

## Issue 3: Gmail API — fetch message list
**Status:** Not started

Given a date range and access token, fetch all message IDs from Gmail using `messages.list` with date filters. Handle pagination (Gmail returns max 500 per page via `nextPageToken`). This runs server-side.

**Scope:**
- Gmail API utility: `fetchMessageIds(token, after, before)` → returns all message IDs
- Use Gmail search query: `after:YYYY/MM/DD before:YYYY/MM/DD`
- Handle pagination loop (follow `nextPageToken`)
- Date range picker UI component (default: last 30 days)
- "Analyze" button kicks off OAuth + server-side analysis
- Show progress: "Fetching email list... (X emails found)" (if feasible)

---

## Issue 4: Gmail API — fetch message headers
**Status:** Not started

For each message ID, fetch the message metadata (headers only). Extract `From`, `List-Unsubscribe`, and `List-Unsubscribe-Post` headers. Parallelize requests with concurrency control to respect Gmail rate limits (~50 req/sec). This runs server-side.

**Scope:**
- Gmail API utility: `fetchMessageHeaders(token, messageId)` → returns relevant headers
- Fetch with `format=metadata` and `metadataHeaders` query params
- Parallel fetching with concurrency limit (e.g., 20-30 concurrent requests)
- Progress indicator: "Scanning headers... (X/Y)"
- Return structured array: `{ messageId, from, listUnsubscribe, listUnsubscribePost }`

---

## Issue 5: Analysis logic — parse, group, and compute stats
**Status:** Not started

Process the fetched headers into the final analysis result. Parse `List-Unsubscribe` headers (can contain `<http://...>`, `<mailto:...>`, or both). Group by sender. Compute stats.

**Scope:**
- Parse `From` header into display name + email address
- Parse `List-Unsubscribe` header: extract HTTP URLs and mailto links
- Detect one-click unsubscribe support via `List-Unsubscribe-Post` header
- Group messages by sender email address
- For each sender: count, unsubscribe link (prefer HTTP over mailto), link type
- Compute overview stats: total emails, emails with unsubscribe, percentage
- Type definitions for analysis result

---

## Issue 6: Results UI
**Status:** Not started

Display the analysis results. Overview stats at top, then a sortable list of senders with unsubscribe links.

**Scope:**
- Overview card: "X of Y emails (Z%) are bulk/newsletter emails from N unique senders"
- Sender list table/cards: sender name, sender email, email count, unsubscribe link, link type badge (http/mailto/one-click)
- Unsubscribe links open in new tab
- Sort by email count (descending, default) or sender name
- Empty state when no unsubscribable emails found
- Visual distinction for mailto vs http links

---

## Issue 7: D1 database and analysis history
**Status:** Not started

Set up D1 database for persisting analysis results. Save each completed analysis. Provide a history view to revisit past analyses.

**Scope:**
- Add D1 binding to `wrangler.jsonc`
- Migration: create `analyses` table (id, user_email, date_range_start, date_range_end, total_emails, unsubscribable_emails, created_at)
- Migration: create `analysis_senders` table (id, analysis_id, sender_name, sender_email, email_count, unsubscribe_url, unsubscribe_type)
- Save analysis result server-side as part of the OAuth callback analysis flow
- API route `GET /api/analyses` — list past analyses
- API route `GET /api/analyses/[id]` — get a single analysis with its senders
- History page/section in the UI
- Auto-save after analysis completes

---

## Issue 8: Polish and error handling
**Status:** Not started

Handle edge cases, improve UX, and harden the app.

**Scope:**
- Handle Gmail API errors gracefully (rate limit, auth expired, network errors)
- Handle OAuth errors (user denies consent, invalid state)
- Loading/skeleton states during analysis
- Responsive design for mobile
- Handle case where token expires mid-analysis (1-hour expiry)
- Cancel in-progress analysis
- Confirm the app works behind Cloudflare Access

---

## Implementation order rationale

Issues 1→2→3→4→5→6 form the critical path — each builds on the previous. Issue 7 (history) is semi-independent and could be built after issue 6 or in parallel with issues 5-6. Issue 8 is a final pass.

```
1 (scaffolding) → 2 (OAuth) → 3 (message list) → 4 (headers) → 5 (analysis) → 6 (results UI) → 7 (history) → 8 (polish)
```
