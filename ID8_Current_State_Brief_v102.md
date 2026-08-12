# ID.8 — CURRENT-STATE BRIEF

**Companion to:** PBD v2 (product truth) + PDD v102 (decision truth)  
**Refreshed:** August 12, 2026  
**Purpose:** The readable, point-in-time account of where the living build stands. The PBD defines what ID.8 is; the PDD records what has been decided; this Brief records current implementation position. Repository evidence governs code truth, and any disagreement is flagged rather than blended.

---

## At a glance

- **Phase:** MVP closeout — Move 4 of the authoritative five-move sequence.
- **Governing code baseline:** branch `recovery/stage-2f-integrated-identity-lineage`, HEAD `912e269b7e480266768799266d4e71b712d81d78`.
- **Governing record:** PDD v102. PDD v101 is preserved inside it as the Move 3 close record.
- **Product truth:** PBD v2 doctrine is adopted; its stale roadmap pointer is superseded pending the bounded roadmap refresh.
- **Move 3:** CLOSED at `afdc6c4fbdc15cd354a22d4741e268d8dcb290fc`.
- **Move 4:** Product contract ratified; Stage 0 complete; Stage 1 scoped and HELD.
- **MVP-green:** NOT claimed.
- **Provider valve:** closed.
- **Hosted/Vercel:** not entered; reserved for the canonical Stage 8 boundary.

## Five-move MVP closeout sequence

| Move | What it proves | Status |
|---|---|---|
| **1 — Great Stop aggregation purity** | Great Stop consumes owner-authored verdicts and re-authors nothing | **CLOSED** (`9029758`) |
| **2 — Experience Composition** | ID.8 authors and preserves one persona-specific Start → Highlight → Wind-down promise | **CLOSED** (`377e051`) |
| **3 — SOFT_FEASIBLE recovery + contextual role casting** | A missing Build role is contextually cast by the correct owner; soft-feasible recovery preserves the hard anchor and reaches normal authority | **CLOSED** (`afdc6c4`) |
| **4 — User Transaction Lifecycle / Workstream F** | Verified durable Save → exact Return → verified Delete, plus immutable browser-independent sharing | **ACTIVE — Stage 0 complete; Stage 1 held** |
| **5 — Cleanup + engine-document formalization** | Remove proven-orphan compatibility paths and formalize extraction-ready engine records | **UNSTARTED** |

MVP-green requires all five Moves to close and the governing MVP close bar to pass.

## What Move 3 closed

Move 3 closed as one integrated Build outcome:

- Application preserves a place-only hard anchor without inventing role truth.
- Waypoint contextually casts an unauthored role from existing Interpretation/Taste evidence.
- Explicit Start, Highlight, or Wind-down remains hard and cannot be overridden.
- The bigger-night recovery uses the owner-authored flexible route-shape envelope.
- Bearings independently proves the recovered route feasible.
- The accepted deterministic path reaches Great Stop PASS, routeAuthority valid, Review eligible, and Lock eligible.
- Surprise and Curate containment remained byte-identical against the accepted Stage 0 baseline.
- Provider, fetch, and external-network counts remained zero.

Moves 1–3 remain closed and are not reopened by Move 4.

## Move 4 governing outcome

Across Surprise, Curate, and Build, any route that passes Review and Lock must be capable of being:

- saved through a verified account-backed transaction;
- bound to an authenticated owner;
- returned exactly across sessions and devices;
- deleted with verified effect;
- published as an immutable read-only share version;
- retrieved independently of the originating browser.

Move 4 is one shared post-Lock Application/Persistence/Identity lifecycle. It does not change route generation, route authorization, Arc engine ownership, or the locked artifact.

## Stage 0 close

Stage 0 completed read-only at `912e269` with a clean tracked worktree and index. Retained untracked evidence remained present and untouched. Provider, fetch, and external-network counts were zero.

Repository confirmation established:

- the current Vite SPA + Vercel API topology can support authenticated server-side lifecycle transactions;
- privileged persistence credentials can remain outside the browser bundle;
- no competing production auth or durable-persistence architecture is present;
- Move 4 can attach after Lock through one Application-owned lifecycle boundary;
- provider-specific code can remain subordinate to vendor-independent lifecycle contracts;
- existing authoritative artifact, route, and lineage validators remain the validation owners.

## Provider and environment standing

**Supabase Auth + Postgres + row-level security is `RECOMMENDED WITH EXPLICIT CONDITIONS`.** Repository evidence does not disqualify it.

The PDD records required capabilities and selection criteria, not a vendor name. Supabase is the selected implementation candidate recorded here in the implementation state.

Later proof must confirm:

- magic-link or email-OTP redirect behavior;
- session restoration and server-verifiable identity;
- Preview and Production isolation;
- row-level owner isolation and authorization policy;
- transactional Save, Delete, and share revocation;
- provider-independent conformance to the lifecycle contracts.

Browser-permitted configuration is limited to non-privileged provider client configuration, application origin information, and provider-approved session material. Service-role credentials, database credentials, transaction-executor credentials, auth-verification secrets, and other privileged write capability remain server-only. Local development, deterministic tests, Preview, and Production remain separated.

Hosted confirmation remains deferred to Stage 8.

## Accepted lifecycle boundaries

- **routeAuthority** owns validated Lock truth.
- **Existing validators** own artifact, route, payload, and lineage validation.
- **Application lifecycle** owns Save, Return, Delete, Publish Share, and their transaction semantics.
- **Identity** owns authenticated user and session truth.
- **Persistence** owns durable records, transaction completion, idempotency, deletion state, and retrieval.
- **Provider adapters** implement capabilities without authoring lifecycle or route semantics.
- **UI surfaces** consume lifecycle results but never become persistence authority.
- **Waypoint** does not own accounts, persistence, Plans Hub, or sharing.

Persistence may store, validate, retrieve, and present authoritative truth. It may not generate, reinterpret, repair, substitute, resequence, or reapprove it.

## Accepted identity and transaction model

The lifecycle keeps these identities distinct:

- `userId` — authenticated owner;
- `planId` — canonical durable plan;
- `routeId` — route identity inside the authoritative artifact;
- `shareVersionId` — one immutable published snapshot;
- `saveOperationId` — one owner-scoped logical Save operation.

Save idempotency is unique within `(userId, saveOperationId)`. An equivalent retry returns the same `planId`; reuse with a different payload fails honestly.

The durable plan stores the exact validated locked payload. Return retrieves and revalidates that payload without recomputation or fallback authority. Every successful Publish creates a new immutable `shareVersionId`. Delete makes the plan unavailable and revokes all associated share versions atomically or through an equivalently provable boundary. A durable tombstone may enforce idempotency and anti-resurrection but must not become archive/restore product behavior.

## Local storage and legacy cutover

Browser storage may provide only:

- continuity for the current validated locked plan before durable Save succeeds;
- pending-authentication continuity;
- optional caching after successful canonical retrieval.

It may never become fallback authority when Save, Return, ownership, validation, deletion, or provider capability fails.

Historical browser-local saved/shared entries will not be silently promoted. At cutover, old local shared entries receive a clean reset. Only the current validated locked plan may be explicitly claimed through canonical Save after authentication.

## Stage 1 — scoped and held

The accepted Stage 1 source scope is create-only:

- `src/app/lifecycle/lockedPlanLifecycleTypes.ts`
- `src/app/lifecycle/lockedPlanLifecycleValidation.ts`
- `src/app/lifecycle/lockedPlanLifecycleService.ts`
- `src/app/lifecycle/lockedPlanLifecycleReferenceAdapters.ts`

The accepted proof scope is create-only:

- `scripts/test-move-4-lifecycle-reference-contract.ts`
- `scripts/test-move-4-lifecycle-idempotency-concurrency.ts`

Stage 1 is vendor-independent, infrastructure-free, locally deterministic, provider-call-free, fetch-free, network-free, production-unwired, and behavior-preserving outside isolated reference proofs.

It must prove atomic Save, concurrent duplicate Save, owner-scoped idempotency, exact Return, immutable publication, owner isolation, atomic Delete plus share revocation, stale-cache anti-resurrection, and rejection of persistence-authored route changes.

Stage 1 remains unauthorized until the coordinated PDD v102 + Current-State Brief + PBD v2 roadmap-position synchronization is accepted.

## Ruled but not implemented

- **R-02:** Governing post-Lock canonical changes re-authorize through owner engines; LCE coordinates and never authors. Governing and unimplemented; outside Move 4.
- **R-04:** Browser-local continuity is not durable Save. Implemented by Move 4 when its close bar passes.
- **R-05:** MVP sharing is an immutable versioned snapshot retrieved independently of the originating browser. Implemented by Move 4 when its close bar passes.
- **V-01/V-02:** Contained outside the active public path; Move 4 must not make the archive residue reachable.
- **V-03:** Failed local share writes can appear success-shaped; Move 4 Ruling 5 must eliminate this class.

## Product-facing doctrine carried into Move 4

- **Home priority:** active Live → locked in-progress → recent saved → start new → secondary discovery.
- **URL owns nothing:** navigation identifiers never own intent, identity, composition, approval, or lineage.
- **Provenance is not authority:** origin explains a plan but never becomes a second truth spine.
- **Plans Hub in Move 4:** active, locked, and saved states only. Versioning, restore, branch, collaboration, and living shared plans remain deferred.

## Current standing and next action

- Moves 1–3 closed.
- Move 4 contract ratified.
- Move 4 Stage 0 complete.
- Move 4 implementation not begun.
- Stage 1 scoped and held.
- Move 5 unstarted.
- Provider valve closed.
- Hosted/Vercel not entered.
- R-02 governing and unimplemented.
- MVP-green unclaimed.

The only current action is documentation synchronization: PDD v102, this Brief, and the bounded PBD v2 roadmap refresh must agree on baseline, Move status, stage sequence, and authorization boundary. After founder acceptance, Stage 1 may be authorized separately.

---

*Point-in-time snapshot. PDD v102 carries authoritative decision detail; PBD v2 carries durable product doctrine; this Brief carries the current implementation position at `912e269`.*
