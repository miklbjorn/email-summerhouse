# ADR 002: Server-side Gmail analysis, no token in browser

## Decision
Perform Gmail API calls server-side in a single analysis request. The worker exchanges the OAuth code for an access token, uses it immediately to fetch headers, then discards it. The browser never receives the token.

## Context
We needed to decide where Gmail API calls happen (browser vs. worker) and where to store the OAuth token (server-side vs. client). We expect a single-shot analysis and do not expect large inboxes.

## Rationale
- Bearer token never reaches the browser — reduces XSS/extension exposure
- No long-lived server storage (D1/KV) needed
- Keeps the client simple (no token storage or refresh handling)
- Fits the single-shot usage pattern

## Consequences
- Each analysis requires a fresh OAuth redirect
- Long analyses could hit worker time limits or feel slow
- Harder to provide incremental progress in the UI
