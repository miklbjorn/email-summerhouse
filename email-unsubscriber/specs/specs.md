I want an app that helps me unsubscribe from newsletters in one go.

The UX will be:
- Provide a gmail account (app is gmail only) to analyze
- Provide a date range - default is last month
- When pressing enter all emails in range are extracted via api and analyzed
- For each email, the `List-Unsubscribe` header is checked. If present, the email is unsubscribable — the sender comes from the `From` header, the unsubscribe mechanism from the `List-Unsubscribe` (and optionally `List-Unsubscribe-Post`) header.
- Once analysis is done the user is provided with:
	1. An overview of which fraction of emails in the period were bulk/newsletter emails (i.e., had a List-Unsubscribe header)
	2. A list of all unique senders including: the number of mails from that sender in the period, the unsubscribe link, and the link type (http or mailto)
- The idea is that the user can quickly click all the unsubscribe links they want to get rid of
- For mailto-type unsubscribe links, display the link type so the user knows what to expect
- We want to save each of these analyses in an analysis history for later reference

Non-functional reqs
- This is a cloudflare solution, based on the cloudflare Next.js starter template (OpenNext)
- We will use Cloudflare Access to limit who can reach the app, configured in the platform
- The repo is public so NO secrets or personal details committed EVER

Implementation behind the scenes:
- Authenticate to Gmail via Google OAuth (Authorization Code flow with PKCE where possible)
- Client secret stored as a Wrangler secret, never committed
- One server-side API route handles the OAuth code→token exchange and runs the analysis
- Access token kept only in server memory for the duration of the analysis request — not persisted or sent to the browser
- All Gmail API calls made server-side during the analysis request
- No LLM needed — detection relies entirely on email headers (List-Unsubscribe)
- Analysis history saved to D1 database

Design decisions:
- No long-running task infrastructure needed — header-only analysis is fast enough to complete synchronously server-side
- Token not persisted — user re-authenticates each analysis/session (acceptable for this use case)
- Gmail API calls from server — token never sent to or stored in the browser
- Single worker serves both the Next.js frontend and the API routes
