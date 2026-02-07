# ADR 001: Use email headers instead of LLM for newsletter detection

## Decision
Detect unsubscribable emails by checking the `List-Unsubscribe` header instead of using LLM analysis.

## Context
The original spec proposed using an LLM to classify each email as newsletter/non-newsletter and extract unsubscribe links. This would require an LLM provider, add cost per email, and potentially make the analysis long-running.

## Rationale
- `List-Unsubscribe` is an RFC 2369 standard header that bulk senders are required to include
- Its presence is both the detection signal ("this is bulk mail") and the payload ("here's how to unsubscribe")
- No LLM cost, no API keys needed beyond Gmail
- Fast enough to run synchronously — no need for job queues or polling infrastructure
- More reliable than LLM classification

## Consequences
- Emails without `List-Unsubscribe` but that are still newsletters won't be detected (acceptable trade-off)
- No need for Cloudflare AI or external LLM integration
- Analysis completes in seconds rather than minutes
