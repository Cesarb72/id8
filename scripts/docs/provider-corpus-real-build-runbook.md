# San Jose Provider Corpus Real Build Runbook

Status: not approved for execution.

This runbook defines the required preconditions and operating rules for a future real
San Jose provider corpus build. It is documentation only. It does not approve,
implement, or run the build.

## Purpose

Build the San Jose provider corpus once so Curate, Surprise, and Build can use
reviewed corpus supply without making per-session provider calls.

Hosted runtime must remain provider-silent by default. No provider key may be added
to Vercel, `.env.local`, repo files, logs, committed output, or browser/runtime
configuration unless a separate C-suite approval explicitly authorizes that later
runtime work.

## Preconditions

All items in this section are mandatory before any key is created, supplied, or used.

- C-suite approval is recorded with approver, date, and approval reference.
- `git status --short` is empty.
- Provider Governance Valve passes.
- Dessert proof gate passes.
- Corpus manifest, artifact, artifact round-trip, and review report tests pass.
- `npx tsc --noEmit` passes.
- `npm run build` passes.
- A Google Cloud API key is created specifically for this corpus build.
- No dev-machine, browser, hosted, or previous test key is reused.
- No key is committed to the repo.
- No key is written to `.env`, `.env.local`, `.env*.local`, or any checked-in file.
- No key is added to Vercel env.
- No key is printed to logs, diagnostics, generated artifacts, terminal transcripts, or review output.
- The key is supplied only through the operator shell environment for the build session.
- The operator public egress IP is confirmed and stable for the full run.

Stop before key creation or use if the operator public egress IP cannot be confirmed
and kept stable for the run.

## Google Cloud Setup

Create a dedicated key with this display-name pattern:

```text
id8-sj-provider-corpus-gate1-<YYYYMMDD>-operator-local
```

Configure the key before use:

- API restriction: restrict the key to Google Places API / Places API (New) only.
- Application restriction: restrict the key by IP address to the operator's confirmed public egress IP.
- Do not use browser HTTP referrer restrictions for this local/offline build.
- Do not allow hosted, browser, Vercel, or wildcard origins.
- Configure the lowest practical request quota/cap for a 12-query Gate 1 text-search run.
- Configure billing alerts before the run. Use thresholds that notify before, at, and above the expected run budget.
- Record the Cloud project, key display name, key ID, restriction summary, quota summary, and billing alert summary in the operator notes. Do not record the key value.

Google Cloud documents that unrestricted API keys are insecure and recommends both
API restrictions and application restrictions. For a local/offline operator build,
use IP address restrictions because the caller is a server-style local script, not a
browser application. Internal IPs and `localhost` are not valid IP restrictions.

References:

- Google Cloud API key restrictions: https://docs.cloud.google.com/docs/authentication/api-keys
- Places API (New) overview: https://developers.google.com/maps/documentation/places/web-service/op-overview
- Cloud Billing budgets and alerts: https://docs.cloud.google.com/billing/docs/how-to/budgets

To verify the key is not reusable by hosted/browser contexts:

- Confirm the key has no HTTP referrer/browser restrictions for hosted domains.
- Confirm the key has no allowed Vercel, localhost, wildcard, or browser origin.
- Confirm the only application restriction is the operator's public egress IP.
- Confirm a request from any unapproved network would fail key restrictions.
- Confirm the key is absent from Vercel env and `.env.local`.

## Execution Model

The future build must use a local/offline governed script only. This slice does not
provide that script.

Rules for the future script:

- Route every provider request through `ProviderAdapter`.
- Use `providerCorpusManifest` as the only query source.
- Use only manifest entries where `purpose` is `retrieval_supply`.
- Use exactly the 12 Gate 1 manifest queries.
- Do not expand the manifest query set beyond 12.
- Do not call `details_lookup`.
- Do not call Place Details (New).
- Do not use nearby, waypoint, anchor-search, runtime retrieval, route generation, scoring, or validation code as a query source.
- Use `maxCenters=1`.
- Use `maxCalls=1` per manifest query.
- Hard stop if attempted calls, billable calls, or attempted HTTP requests exceed the manifest cap.
- Emit a `ProviderCallLedger` and reconcile it with the review report.
- Keep `runtimeImportAllowed` set to `false`.

Gate 1 budget:

```text
manifest queries: 12
maxCenters per query: 1
maxCalls per query: 1
expected billable call cap: 12
details_lookup cap: 0
```

## Required Operator Environment

These values are examples only. Never paste a real key into this runbook, shell
history that will be shared, issue text, logs, checked-in files, or generated output.

```text
VITE_GOOGLE_PLACES_API_KEY="REDACTED_OPERATOR_SESSION_ONLY"
VITE_ID8_PROVIDER_ENABLE_RETRIEVAL_SUPPLY="1"
ID8_PROVIDER_CORPUS_BUILD_APPROVED="1"
VITE_ID8_PROVIDER_RETRIEVAL_SUPPLY_BILLABLE_CALL_CAP="12"
VITE_ID8_PROVIDER_BILLABLE_CALL_CAP="12"
VITE_ID8_SOURCE_MODE="hybrid"
VITE_GOOGLE_PLACES_MAX_CENTERS="1"
VITE_GOOGLE_PLACES_PAGE_SIZE="8"
VITE_GOOGLE_PLACES_LANGUAGE_CODE="en"
VITE_GOOGLE_PLACES_REGION_CODE="US"
```

Critical warning: `VITE_GOOGLE_PLACES_API_KEY` is operator-shell-only for this
corpus build. It is named with the `VITE_` prefix only because the current
`ProviderAdapter` reads that env var. For this runbook, it must be supplied only in
the operator shell session used for the local/offline build. It must never be added
to Vercel, `.env.local`, repo files, logs, committed output, or browser/runtime
configuration.

Before running the future script, verify:

- `VITE_GOOGLE_PLACES_API_KEY` is set only in the operator shell.
- `VITE_GOOGLE_PLACES_API_KEY` is absent from `.env.local`.
- `VITE_GOOGLE_PLACES_API_KEY` is absent from Vercel env.
- `VITE_GOOGLE_PLACES_API_KEY` is absent from `git status --short`.
- `VITE_ID8_PROVIDER_ENABLE_RETRIEVAL_SUPPLY=1`.
- `VITE_ID8_PROVIDER_RETRIEVAL_SUPPLY_BILLABLE_CALL_CAP=12`.
- `VITE_ID8_PROVIDER_BILLABLE_CALL_CAP=12`.
- `VITE_ID8_SOURCE_MODE=hybrid`.
- `VITE_GOOGLE_PLACES_MAX_CENTERS=1`.

## Output Artifacts

Intended future output paths:

```text
tmp/provider-corpus/real/san-jose/provider-corpus-snapshot.gate1.<runId>.json
tmp/provider-corpus/real/san-jose/provider-corpus-review.gate1.<runId>.json
tmp/provider-corpus/real/san-jose/provider-corpus-ledger.gate1.<runId>.json
tmp/provider-corpus/real/san-jose/provider-corpus-build.gate1.<runId>.log
```

Output requirements:

- Provider corpus artifact JSON uses `provider-corpus-snapshot.v1`.
- Review report JSON uses `provider-corpus-review.v1`.
- Diagnostics/ledger JSON includes `ProviderCallLedger`.
- Artifacts include provenance metadata: source, provider, manifest version, manifest query labels, generated timestamp, query labels, endpoint list, and operator approval reference.
- Artifacts include freshness metadata: `generatedAt`, `reviewBy`, `maxAgeDays`, and `staleAction`.
- Logs must not contain the key value.
- Outputs must be reviewed before commit.
- Real provider output is not committed without explicit C-suite approval after review.

## Review Checklist

The operator and C-suite reviewer must inspect:

- Query ledger.
- Total attempted calls.
- Total attempted HTTP requests.
- Total billable calls.
- Endpoint list.
- Venue count.
- Unique provider record count.
- Dedupe report.
- Duplicate provider identities.
- Drop reasons.
- Coverage report.
- Curate starter coverage.
- Surprise support coverage.
- Build anchor family coverage.
- Role coverage.
- Persona/vibe scenario coverage.
- Freshness window.
- Gate 1 readiness.
- Risk flags.
- Go/no-go recommendation.
- Confirmation that `runtimeImportAllowed` remains `false`.
- Confirmation that no key appears in repo, `.env.local`, Vercel env, logs, or committed output.

## Rollback And Delete Plan

If anything goes wrong:

- Stop the script immediately.
- Revoke or disable the Google Cloud key.
- Delete generated output under `tmp/provider-corpus/real/san-jose/`.
- Do not commit the generated corpus.
- Document the failure, including stop condition, attempted call count, billable call count, and whether any output was deleted.
- Confirm no hosted env changes occurred.
- Confirm no key was written to repo files, `.env.local`, Vercel env, logs, or committed output.

## Stop Conditions

Stop before or during the future build if any condition is true:

- C-suite approval is missing.
- Git worktree has uncommitted changes.
- Required tests or build checks fail.
- Google key is missing API restrictions.
- Google key is missing application restrictions.
- Operator public egress IP cannot be confirmed.
- Operator public egress IP cannot be kept stable for the run.
- Quota/cap cannot be confirmed.
- Billing alerts cannot be confirmed.
- Script would bypass `ProviderAdapter`.
- Script would use `details_lookup`.
- Script would call Place Details (New).
- Script would use runtime route generation, scoring, validation gates, or provider behavior as execution wiring.
- Manifest expands beyond 12 queries.
- Any manifest query has `maxCenters` greater than 1.
- Any manifest query has `maxCalls` greater than 1.
- Billable calls exceed cap.
- Attempted HTTP requests exceed cap.
- Generated corpus lacks provenance metadata.
- Generated corpus lacks freshness metadata.
- Review report is blocked.
- `runtimeImportAllowed` is not `false`.
- Any key appears in repo, `.env.local`, Vercel env, logs, or committed output.

## Future Execution Prompt

```text
NOT APPROVED YET - FUTURE EXECUTION PROMPT

Block 17B-5 - First Real San Jose Provider Corpus Build

C-suite approval: <name/date/ticket>

Use scripts/docs/provider-corpus-real-build-runbook.md.

Do not add keys to repo, .env.local, logs, committed output, or Vercel.
Do not wire runtime.
Do not change route generation, scoring, validation gates, or provider behavior.
Do not commit generated real provider output without separate C-suite approval.

Before any provider call:
- Confirm git status is clean.
- Confirm the dedicated Google Cloud key exists only for this corpus build.
- Confirm the operator public egress IP is known and stable for the run.
- Confirm the key is restricted to that operator egress IP.
- Confirm the key is restricted to Places API only.
- Confirm billing alerts are configured.
- Confirm provider quota/caps are configured.
- Confirm VITE_GOOGLE_PLACES_API_KEY is set only in the operator shell session.
- Confirm VITE_GOOGLE_PLACES_API_KEY is absent from Vercel env, .env.local, repo files, logs, and generated output.
- Confirm required no-call tests, tsc, and build pass.
- Confirm providerCorpusManifest has exactly 12 Gate 1 queries.
- Confirm every Gate 1 query has maxCenters=1 and maxCalls=1.
- Confirm details_lookup remains disabled.

Run the local/offline governed corpus build through ProviderAdapter only, using
operator shell env vars only. Write artifacts to tmp/provider-corpus/real/san-jose/.
Stop immediately on any stop condition.
```

