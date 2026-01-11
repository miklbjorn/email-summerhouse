<project overview>
Invoice management system built on Cloudflare Workers. Receives invoices via email, extracts data using LLM, stores in D1 database, and provides a React frontend for viewing/managing invoices.

Architecture:
- Cloudflare Workers backend (src/index.ts entry point)
- React frontend (src/frontend/)
- D1 database for invoice storage
- R2 bucket for raw file storage
- LLM extraction using Cloudflare AI (src/utils/ai-processing.ts)
- Email processing with medallion architecture: bronze (raw) → silver (markdown) → gold (structured JSON)

Key data model:
- Invoice has `status` enum: 'unpaid' | 'paid' | 'no_payment_due'
- `account_balance` field for credit balances (when customer has overpaid)
- `amount` is null when no payment is due
</project overview>

<commands>
- pnpm run build:frontend - Build React frontend with Vite
- pnpm dev - Start dev server via Wrangler
- pnpm exec tsc --noEmit - TypeScript type check
- pnpm exec wrangler d1 migrations apply bjrk-d1 --local - Apply migrations locally
- pnpm exec wrangler d1 execute bjrk-d1 --local --command "SQL" - Run SQL locally
</commands>

<key files>
- src/utils/database.ts - Database types and insert logic
- src/utils/ai-processing.ts - LLM extraction interface and prompts
- src/api/invoices.ts - API handlers
- src/frontend/components/ - React components
- src/frontend/types/invoice.ts - Frontend TypeScript types
- migrations/ - D1 database migrations
- wrangler.jsonc - Wrangler config (D1 database: bjrk-d1)
</key files>

<git usage>
- you will typically be prompted to work on a specific issue, from the github issues.
- always work by pulling latest main branch, checking out a separate branch, make changes, rebase on main, then make PR towards ´main´
- checkout main once you are done. If you find the branch and it is not on main, check with user that there is not another claude or user currently building a feauture
- never include references to claude in commit messages and PRs
