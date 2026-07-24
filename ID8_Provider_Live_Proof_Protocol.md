# ID8 Provider Live Proof Protocol

## 1. Purpose

This protocol governs any local provider/live proof run for ID8.

It does not authorize hosted or Vercel proof. It does not authorize broad debugging runs, exploratory provider calls, matrix runs, Row 2 work, cleanup, re-housing, or product implementation.

The purpose is operator safety: prove only the approved live-provider path, stay inside the approved provider-call envelope, and prevent diagnostic/static/fallback evidence from being treated as MVP green.

## 2. Authority Boundary

`ID8_Technical_Bible.md` remains the source of truth for the current team-facing technical map.

This protocol is an operator safety procedure for live-provider proof only. It does not create a new architecture authority, supersede the Technical Bible, or settle unresolved product seams.

## 3. Required Approval Before Live Run

A live provider run requires explicit founder approval before execution.

Approval must name:

- phase name
- exact script and command
- max provider calls
- expected ledger used before the run
- expected ledger cap after the run
- run scope
- stop conditions
- post-run disarm requirement

No provider-consuming command may be rerun without new approval.

## 4. Budget Rules

The per-run provider-call cap must be explicitly named.

The default approved proof cap is 3 provider calls unless the founder states otherwise.

The daily cap must be calculated as:

```text
current ledger used + approved run allowance
```

Example:

```text
ledger used = 4
approved run allowance = 3
ID8_PROVIDER_DAILY_CALL_CAP = 7
```

If the actual ledger used differs from the expected value, stop and recalculate before running.

Never rerun a provider-consuming command without new approval.

## 5. Required Env Vars

The Phase 3 governed live proof runner requires:

- `GOOGLE_PLACES_API_KEY`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `ID8_PROVIDER_DAILY_CALL_CAP`
- `ID8_PHASE_3R_LIVE_PROOF=1`

Secrets must never be pasted into chat, Codex prompts, reports, committed files, or audit outputs.

Env vars must be process-local only unless a separate operator decision approves persistence.

Do not write provider keys, KV tokens, or live-proof flags into repo files.

## 6. PowerShell Local-Run Pattern

Use this pattern from the repo root when an approved live proof run is ready.

It prompts for secrets without printing them, injects env vars process-locally inside a script block, runs the approved command once, and restores/removes the injected env vars in `finally`.

```powershell
& {
  function ConvertFrom-Secret([securestring]$Secret) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
    try {
      [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }

  $keys = @(
    'GOOGLE_PLACES_API_KEY',
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'ID8_PROVIDER_DAILY_CALL_CAP',
    'ID8_PHASE_3R_LIVE_PROOF'
  )
  $old = @{}
  foreach ($key in $keys) {
    $old[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
  }

  $googlePlacesApiKey = Read-Host -AsSecureString 'GOOGLE_PLACES_API_KEY'
  $kvRestApiUrl = Read-Host 'KV_REST_API_URL'
  $kvRestApiToken = Read-Host -AsSecureString 'KV_REST_API_TOKEN'
  $dailyCallCap = Read-Host 'ID8_PROVIDER_DAILY_CALL_CAP positive integer'

  try {
    $env:GOOGLE_PLACES_API_KEY = ConvertFrom-Secret $googlePlacesApiKey
    $env:KV_REST_API_URL = $kvRestApiUrl
    $env:KV_REST_API_TOKEN = ConvertFrom-Secret $kvRestApiToken
    $env:ID8_PROVIDER_DAILY_CALL_CAP = $dailyCallCap
    $env:ID8_PHASE_3R_LIVE_PROOF = '1'

    npx tsx scripts/test-phase-3-mvp-proof-gate-live.ts
  } finally {
    foreach ($key in $keys) {
      if ($null -eq $old[$key]) {
        Remove-Item "Env:\$key" -ErrorAction SilentlyContinue
      } else {
        [Environment]::SetEnvironmentVariable($key, $old[$key], 'Process')
      }
    }

    Remove-Variable googlePlacesApiKey, kvRestApiUrl, kvRestApiToken, dailyCallCap -ErrorAction SilentlyContinue
  }
}
```

Do not include actual secret values in the command, chat, reports, or committed files.

## 7. Envelope Rules

For Phase 3R / Phase 3U style proof:

- `maxProviderCalls=3`
- `maxQueryLabels=3`
- `maxCenters=1`
- local only
- no hosted or Vercel proof
- governed Field path only
- `/api/field/text-search`
- `retrieval_supply`

The runner must fail rather than exceed the approved envelope.

## 8. Stop Conditions

Stop immediately if:

- key, KV, or cap readiness is missing
- ledger used does not match expected
- provider calls would exceed the approved cap
- query labels exceed the approved cap
- centers exceed the approved cap
- a hosted or Vercel URL is used
- required proof columns are missing
- a static, fallback, provider-shadow, DEMO-SPECIAL, app-authority, or legacy path is marked pass
- compatibility-only route truth is promoted as canonical
- the provider valve cannot be disarmed
- the command requires persistent env change not approved for the task

When a stop condition triggers, do not rerun without new approval.

## 9. Valid Proof Rules

A valid live proof pass requires:

- governed live Field path
- `ContractEntryArtifact`
- `RuntimeRouteArtifact`
- Great Stop pass
- Review/Lock eligible
- canonical route truth
- `diagnostic-only=false`
- full lineage and masking columns
- no unapproved static, dry, fallback, provider-shadow, DEMO-SPECIAL, app-authority, or legacy production
- provider calls within cap

Compatibility-only route truth cannot be promoted as canonical.

## 10. Diagnostic Proof Rules

Static, dry, fallback, provider-shadow, DEMO-SPECIAL, app-authority, or legacy rows are diagnostic-only.

Diagnostic rows can inform decisions.

Diagnostic rows cannot be MVP green.

## 11. Live Data Evidence Contract

The live run must answer two questions:

- Did the governed live path produce a valid proof row?
- What did live data provide or fail to provide that must be represented locally for MVP closeout?

The proof is not complete if it only reports pass/fail. It must also explain whether the live provider output contained enough evidence for Field, Interpretation, Bearings, Waypoint, Great Stop, lifecycle, and local proof fixtures to support an MVP closeout claim.

Required live-data capture from Field/provider output:

- provider/source name
- query label
- query center / pocket
- provider call count
- provider place id, if available
- venue name
- address / location
- categories/types
- hours/open-status data, if available
- rating/review count, if available
- website/phone, if available
- raw evidence availability flags
- whether data came from live provider, static, fallback, provider-shadow, or compatibility path

Required Interpretation/Taste evidence capture:

- `roleScore`
- `stopShapeFit`
- `lensCompatibility`
- `contextSpecificity`
- threshold source
- evidence status: carried, recomputed, defaulted, or unavailable
- which live fields supported the Taste verdict
- which Taste evidence was missing or thin

Required Bearings evidence capture:

- district/pocket
- distance / movement feasibility
- hours feasibility
- Place-Right status
- required anchor survival status
- admissibility status
- any missing constraint evidence

Required Waypoint / Great Stop capture:

- selected route role sequence
- selected windDown venue
- support source
- Great Stop pass/fail
- Great Stop failure reasons
- whether Great Stop used live evidence, recomputed evidence, defaulted evidence, or missing evidence

Required artifact/lifecycle capture:

- `ContractEntryArtifact` produced? yes/no
- `RuntimeRouteArtifact` produced? yes/no
- canonical route truth? yes/no
- routeAuthority / Review-Lock status
- Review/Lock eligible? yes/no
- diagnostic-only? yes/no
- valid live proof pass? yes/no

Local MVP closeout requirements:

The live proof report must state what must be built, captured, or represented locally after the live run, including:

- which live data fields are necessary for valid route generation
- which fields were missing or too thin
- which engine needs the missing evidence: Field, Interpretation, Bearings, Waypoint, LCE, or Application
- whether local fixtures need to be updated
- whether local proof needs new recorded/sanitized live evidence
- whether engine logic needs to better handle thin live data
- whether provider/live proof is still required for that evidence

Data handling rule:

- Do not commit raw provider payloads unless explicitly approved.
- Prefer sanitized/redacted proof outputs.
- Do not expose secrets.
- Do not store API keys or provider credentials in reports.
- If raw payload retention is needed, stop and request approval.

Future live proof reports must include:

```text
SECTION - Live Data Evidence / MVP Local Build Requirements
```

That section must include:

- what live data came through
- what live data was missing
- what evidence was sufficient
- what evidence was thin
- what needs to be represented locally
- which engine owns each gap
- whether this blocks MVP green
- whether this requires another live run

## 12. Post-Run Requirements

After every approved live provider run:

- disarm the provider valve immediately
- restore env
- report provider calls consumed
- report budget before and after
- report selected route and windDown
- report false-green flags
- report live-data sufficiency
- report local-build requirements
- report engine ownership for missing evidence
- report whether another live call is justified or not
- report whether MVP green can be claimed
- do not rerun without approval

The final report must distinguish valid live proof, diagnostic-only proof, honest-fail, invalid false-green, and MVP-green claim status.

## 13. Current Phase 3 Live-Proof Context

- Current runner commit: 7545e1d - Add governed live MVP proof runner
- Phase 2 fix: 8a7c3e5 - Fail closed Curate scenario support without Taste evidence
- Expected budget before next approved run: used=4
- Approved run allowance: 3
- Expected daily cap for that run if used remains 4: 7
- Next run still requires local operator injection of Google and KV env vars.

The next approved run remains local-only and must use the committed governed live proof runner unless founder approval names a different script and scope.
