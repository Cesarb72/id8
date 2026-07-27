# ID.8 Technical Bible

Current shared operating map for the ID.8 / Arc codebase.

Authority source: full codebase audit ledger and doc-verification closure at HEAD `614a103` on `recovery/pre-demo-mode`.

This document supersedes stale current-authority claims in the older PILLAR, engine, re-housing, and tracker docs where they conflict with the audit ledger. Do not delete those docs. Keep them as historical inputs. Use this Bible as the team-facing map for current code truth and operating rules.

## 1. Scope And Status

This Bible is not a product spec, fix plan, or re-housing work order. It is the shared map for how the current system is housed, what the canonical contracts are, where the known residue is, and how build agents should reason before touching code.

Audit ground:

| Field | Value |
|---|---:|
| HEAD | `614a103` |
| branch | `recovery/pre-demo-mode` |
| files inventoried | 1493 |
| LOC counted | 1083863 |
| provider calls during audit | 0 |
| hosted calls during audit | 0 |
| audit ledger path | `.audit-output-614a103/` |
| doc verification closure | `.audit-output-614a103/doc-verification-closure.md` |

Current disposition counts from the audit ledger:

| Disposition | Count |
|---|---:|
| LIVE | 372 |
| DEMO-SPECIAL | 51 |
| LEGACY-COMPAT | 5 |
| ORPHANED | 22 |
| TEST-ONLY | 137 |
| INFRA | 906 |

Unknowns that still matter:

| Unknown | Status |
|---|---|
| UNKNOWN ownership rows | 99 |
| UNKNOWN mode-reach rows | 240 |
| files reached by zero modes | 706 |
| exact Philz route-scope scores | UNKNOWN |
| historical Row 1 proof output | UNKNOWN / not present in repo |
| per-mode perturbation proof | UNKNOWN / not run under audit guardrails |
| exact LCE consume point after threading | UNKNOWN |

Row 1 proof/root remains UNKNOWN and is separate from Curate RouteShapeContract provisioning.

## 2. Current Authority Order

When documents conflict, use this order:

1. Code at HEAD `614a103`.
2. `.audit-output-614a103/file-register.csv` and `.audit-output-614a103/file-register.ndjson`.
3. `.audit-output-614a103/doc-verification-closure.md`.
4. `.audit-output-614a103/audit-summary.md`, `contract-artifact-inventory.md`, `mode-execution-traces.md`, `masking-surfaces.md`, `open-questions.md`.
5. `ID8_Technical_Bible.md`.
6. Older PILLAR, engine, worklist, discovery-log, and supplied canonical docs as historical inputs only.

Retired as current authority where contradicted by audit:

- PILLAR_3 code-truth table as current source of code truth.
- Re-Housing Discovery Log tracker as current status authority.
- Re-Housing Worklist as current inventory authority.
- Any claim that modes differ only at intent entry.
- Any artifact chain that omits `ContractEntryArtifact`.
- Any claim that there is only one `ExperienceContract` builder/system.
- Any claim that `RouteShapeContract` is cleanly housed and settled.
- Any claim that routeAuthority is the future/end-state lock authority.
- Any claim that Application truth-authoring is mostly gone.

## 3. The System In One Page

Arc is a deterministic coordination kernel. ID.8 is the concierge vertical proving the kernel with San Jose nightlife data.

The six engines/layers:

| Engine | One job | Current code-truth posture |
|---|---|---|
| Field | Detect current reality | Provider/API boundary exists and is governed; retrieval/query planning is still scattered. |
| Interpretation | Turn signals into meaning | Taste, District, and Direction System are active; ExperienceContract duplication remains. |
| Bearings | Apply feasibility constraints | ContractGateWorld and StrategyAdmissibleWorlds exist; admissibility is still scattered in places. |
| Waypoint | Coordinate sequence | Contract-aware core exists; `src/domain/arc/` remains a gravity well and route-shape residue remains. |
| LCE | Preserve locked plan as reality changes | RuntimeRouteArtifact path exists; governing intervention policy is missing; legacy repair remains. |
| Application | Render and orchestrate lifecycle | Renders/locks runtime truth, but Sandbox/App fallback/proof/masking surfaces remain. |

The governing architecture remains:

```text
Interpretation authors intent
Field senses reality
Interpretation gives reality meaning
Bearings admits feasible worlds
Waypoint sequences and coordinates
Great Stop gates lockability
ContractEntryArtifact carries pre-lock truth
RuntimeRouteArtifact carries runtime/locked truth
Application renders and triggers
LCE preserves after lock
```

Important correction: shared pipeline does not mean the current implementation has no mode-specific branches. Audit traces show downstream mode-specific fallback/static/provider-shadow branches after entry.

## 4. Hard Floors

These are build rules, not preferences.

1. Domain-specific meaning lives in Interpretation, especially Taste.
2. Machine engines stay domain-agnostic.
3. Waypoint must not learn hospitality concepts.
4. Application renders truth and triggers lifecycle actions; it must not author route, meaning, contract, quality, or lock truth.
5. Provider calls only go through the governed Field/API boundary.
6. No live provider or hosted calls without explicit operator activation.
7. Candidate truth must not masquerade as locked truth.
8. SelectedRouteArtifact and CurateRefinementEntryPayload are legacy compatibility wrappers, not authority.
9. RouteShapeContract is not cleanly settled; do not treat it as a stable, fully housed authority.
10. If a bug appears local, trace the seam first: input -> handoff -> artifact -> gate -> UI/lifecycle surface.

## 5. Canonical Spine

The current accepted spine is:

```text
ConciergeIntent
  -> CanonicalInterpretationBundle
  -> ContractConstraints
  -> ContractGateWorld
  -> StrategyAdmissibleWorlds
  -> Waypoint / Great Stop
  -> ContractEntryArtifact
  -> RuntimeRouteArtifact
  -> Application surfaces / LCE runtime
```

The most important correction from doc verification:

```text
ContractEntryArtifact -> RuntimeRouteArtifact
```

Any artifact chain that skips `ContractEntryArtifact` is stale.

Canonical and compatibility artifacts:

| Artifact | Current status | Notes |
|---|---|---|
| ConciergeIntent | Current input contract | Interpretation authors; all engines read. Cross-mode proof is not fully closed for every mode. |
| CanonicalInterpretationBundle | Current Interpretation output | Exists and is consumed. |
| ExperienceContract | Current but duplicated | Scenario and canonical systems both exist. |
| ContractConstraints | Current boundary artifact | Interpretation -> Bearings. |
| ContractGateWorld | Current Bearings artifact | Admitted/suppressed/rejected world. |
| StrategyAdmissibleWorlds | Current Bearings artifact | One admissible world per strategy. |
| DirectionPlanningSelection | Current but housing residue | Still tied to `src/domain/arc/directionPlanning.ts`; Direction belongs under Interpretation. |
| RouteShapeContract | Current but unresolved | Defined in `src/domain/types/intent.ts`, built in `src/domain/arc/directionPlanning.ts`; roleProfile/roleInvariants residue remains. |
| Great Stop | Current gate, housing still impure | Audit classifies Waypoint as aggregator owner; code still computes/consumes evidence in `src/domain/greatStop`. |
| ContractEntryArtifact | Canonical pre-lock artifact | Must be included in the spine. |
| RuntimeRouteArtifact | Canonical lock/runtime artifact | Current lock/live truth carrier. |
| SelectedRouteArtifact | LEGACY-COMPAT | Compatibility only; not authority. |
| CurateRefinementEntryPayload | LEGACY-COMPAT | Compatibility only; not authority. |
| routeAuthority | Current app gate, not end-state authority | Should be framed as derived validation/gating, not the future lock owner. |

### Canonical Identity Rule

Current authority from #107:

```text
candidateIdentity.baseVenueId = route-logic identity for Arc/Waypoint/Bearings/Great Stop;
RuntimeRouteStop.venueId = authority/lock identity;
provider IDs like live_google_adega = provenance only - NOT a new abstraction.
```

The three identity layers are:

1. `candidateIdentity.baseVenueId` - route-logic identity; what Arc, Waypoint, Bearings, and Great Stop reason over.
2. `RuntimeRouteStop.venueId` - authority / lock identity; what `RuntimeRouteArtifact` commits to.
3. Provider ids such as `live_google_*` - provenance only; debug, lineage, and source evidence; never route-logic identity.

Lineage notes:

- #88 established artifact = engine-written proofs + canonical truth, projections = derived views, and Application never writes artifact truth. Provenance rigor across route identity lineage remained an open item.
- #90 established provenance-distinctness after the live fan-out incident: non-provider stops must not be marked live, and hybrid/bootstrap fallback must remain provenance-distinct and non-authoritative.
- #107 named the specific `baseVenueId` versus provider-id rule.
- 3BI exposed the rule in the live/static Voyager identity overlap: a live provider row and a selected static route stop can refer to the same public place while carrying different provenance and route-truth evidence.

Field/consolidation design implication:

- `baseVenueId`-based live/static dedupe before provider spend is the intended Field consolidation mechanism.
- Provider ids remain provenance-only.
- Live provider results should merge onto existing `baseVenueId` identity when they refer to the same place, rather than create duplicate route-logic identities.
- This is a design implication for the consolidation lane, not an implementation in this Bible update.

## 6. Mode Execution Truth

Shared canonical spine exists, but each mode still has mode-specific branches.

### Curate

```text
Curate entry
  -> ConciergeIntent
  -> CanonicalInterpretationBundle
  -> Field corpus/retrieval
  -> Bearings worlds
  -> Waypoint ranking/coordination
  -> Great Stop
  -> ContractEntryArtifact
  -> RuntimeRouteArtifact
  -> routeAuthority lock input
```

Known Curate-specific surfaces:

- Scenario-backed card gates.
- Coffee & Books proof target.
- Committed route fallback.
- Curated/static corpus.
- `CurateRefinementEntryPayload` compatibility.
- Selected-route compatibility projection.

### Surprise

```text
Surprise entry
  -> ConciergeIntent
  -> CanonicalInterpretationBundle
  -> Field retrieval/static corpus
  -> Bearings worlds
  -> Waypoint ranking
  -> Great Stop
  -> ContractEntryArtifact
  -> RuntimeRouteArtifact
  -> routeAuthority lock input
```

Known Surprise-specific surfaces:

- Discovery/direction/highlight support surfaces.
- Static corpus and dev fixtures.
- Legacy selected-route compatibility where accepted as non-authority.

### Build My Plan

```text
Build anchor capture
  -> runPlanBuildWithLegacyPlaceRightFallback
  -> runGeneratePlan
  -> Field provider/static source opportunity
  -> Bearings candidate admission and Place-Right verdict
  -> Waypoint ranking/compactness
  -> Great Stop
  -> buildContractEntryArtifactFromGeneration
  -> RuntimeRouteArtifact
  -> routeAuthority lock input
```

Known Build-specific surfaces:

- Required anchor.
- Provider-shadow pre-generation candidate.
- Build candidate admission.
- Static pre-generation non-authority.
- Legacy Place-Right fallback wrapper.
- Build matrix sidecar observer.

## 7. Engine Current-State Notes

### Field

Field owns reality detection: retrieval, current-world sensing, provider/API harness, raw viability, and query mechanics.

Verified:

- Governed API boundary exists at `api/field/text-search.ts`.
- Ledger/readiness exists at `api/field/_lib/fieldLedgerStore.ts` and `api/field/ledger-readiness.ts`.
- Field/provider code exists and stayed governed during audit.
- Provider calls during audit: 0.
- Retrieval is scattered across `buildProviderSourceOpportunity`, `retrieveVenues`, `fetchLivePlaces`, and the API boundary.
- Build uses an under-configured provider query plan inside a 3/3/1 envelope.

Current debt:

- No single consolidated Field boundary owns all query planning and retrieval.
- Static corpus/provider corpus surfaces remain masking surfaces.
- Budget/corpus numeric claims from older docs are not current authority unless supported by a proof artifact.
- Field breadcrumb runtime flow through District after convergence is unknown from static audit alone.

Do not:

- Put meaning or taste scoring in Field.
- Add direct provider calls outside the governed boundary.
- Treat provider runbooks as approval to call providers.

### Interpretation

Interpretation owns meaning and is the only domain-specific engine.

Verified active subsystems:

- Taste.
- District.
- Direction System.

Verified:

- `CanonicalInterpretationBundle` exists and is consumed.
- Taste owns route meaning verdicts.
- `evaluateTasteRoleIntentCore` is not directly fed by `RouteShapeContract`.
- Direction System is live conceptually and produces direction/shape decisions.

Current debt:

- Scenario and canonical `ExperienceContract` systems both exist.
- Claims of one ExperienceContract builder / no duplicates are wrong.
- DirectionPlanningSelection and route-shape construction still touch `src/domain/arc/directionPlanning.ts`.
- Moment strength / memorability remains a key Interpretation/Taste seam to protect.
- Generic hospitality fallback can still mask weak supply.

Do not:

- Put hospitality concepts into Waypoint, Bearings, Field, or Application.
- Let Application author rationale/meaning copy that should come from Interpretation.
- Treat Direction as a top-level engine; it is an Interpretation subsystem.

### Bearings

Bearings owns feasibility: constraints, timing, movement, hours, required-stop survival, candidate admission, and the admitted world.

Verified:

- `ContractGateWorld` exists at `src/domain/bearings/buildContractGateWorld.ts`.
- `StrategyAdmissibleWorlds` exists at `src/domain/bearings/buildStrategyAdmissibleWorlds.ts`.
- Hours handling exists and remains partial.
- Local stretch policy exists in code.

Current debt:

- Admissibility is still scattered through app candidate admission, normalization quality gate, retrieval distance admission, arc movement feasibility, and Waypoint compactness re-derivation.
- Required Stop Contract hard survival is a real path but not fully closed by an approved matrix/Row proof under the audit guardrails.
- Time/origin realism remains a critical seam.

Do not:

- Let Waypoint or Application re-derive admissibility.
- Treat quality as feasibility.
- Tune one route by loosening Bearings policy without tracing upstream inputs.

### Waypoint

Waypoint owns sequence coordination and should aggregate Great Stop as a domain-blind kernel.

Verified:

- Current boundary is `src/integrations/waypoint/core.ts` via `rankArcCandidates.ts`.
- Build contract-driven planner exists in `src/domain/waypoint/buildContractDrivenBuildWaypointPlan.ts`.
- `runGeneratePlan` accepts contract bundle/constraints and ranks through contract path when present.
- Waypoint core is substantially domain-blind in the audited path.

Current debt:

- `src/domain/arc/` remains a gravity well.
- `RouteShapeContract` and `RoleInvariantProfile` are unresolved current inputs, not settled ownership.
- `scoreArcAssembly.ts` and `assembleArcCandidates.ts` should not be treated as clean Waypoint authority.
- Great Stop is not yet pure stamp aggregation in code; current code still computes/consumes evidence in `src/domain/greatStop`.

Do not:

- Add hospitality-specific scoring to Waypoint.
- Treat `src/domain/arc/` as a clean long-term engine home.
- Fix route quality by tuning Waypoint weights before checking Field, Interpretation, and Bearings seams.

### LCE

LCE preserves the locked plan as reality changes.

Verified:

- RuntimeRouteArtifact path exists.
- LCE code references `RuntimeRouteArtifact`, not `SelectedRouteArtifact`, as runtime truth.
- `lceRuntimeContract.ts` has a runtime mutation gate and confirmation posture.
- LCE governing intervention policy is missing.

Current debt:

- `lceRepair.ts` is legacy compatibility, not clean canonical LCE.
- Exact LCE consume point after threading remains unknown without a focused flow proof.
- Field-to-LCE live signal ingestion is not active as an end-to-end current capability.

Do not:

- Let LCE regenerate plans.
- Let LCE reinterpret intent.
- Treat types for live Field envelopes as proof that live ingestion is wired.

### Application

Application owns UX, lifecycle orchestration, rendering, session state, mode entry, and action triggers.

Verified:

- App must render truth, never author it.
- All three modes are app entry strategies producing ConciergeIntent.
- `routeAuthority` currently validates route truth and lock inputs.
- RuntimeRouteArtifact is consumed through lock/live surfaces.

Current debt:

- `SandboxConciergePage.tsx` remains a large DEMO-SPECIAL masking surface.
- App/Sandbox still contains route, fallback, proof, and diagnostic logic that can mask engine truth.
- routeAuthority is current app validation/gating, not end-state lock authority.
- Provider governance should be framed as governed Field/API boundary, with app-hosted controls where applicable.
- Page route-shape relocation is not clean; builder still comes from `src/domain/arc/directionPlanning.ts`.

Do not:

- Let page state become route truth.
- Let fallback cards become authority.
- Add UI rationale as compensation for thin Interpretation output.
- Treat compatibility wrappers as lock authority.

## 8. Masking Surfaces

Masking surfaces are code paths that can hide thin engine truth, fake completeness, or let candidate/static/projection artifacts look authoritative.

Highest-confidence masking classes from the audit:

| Class | Examples |
|---|---|
| Static fixtures | `src/data/*` |
| Static provider corpus | `src/domain/field/corpus/*` |
| Provider shadow | provider-shadow / build-static-pre-generation paths |
| Curate fallbacks | `buildCurateCommittedRouteFallback`, Curate card/proof diagnostics |
| App/Sandbox authority shadows | `SandboxConciergePage.tsx`, routeAuthority compatibility inputs |
| Legacy wrappers | `SelectedRouteArtifact`, `CurateRefinementEntryPayload` |
| Demo/proof diagnostics | Coffee & Books proof, Row-style diagnostics |

Rule: do not delete masking surfaces without proof. Do not promote them as truth. Mark them clearly when using them for diagnostics.

## 9. Orphan And Deletion Candidates

The audit found 22 ORPHANED candidates. This Bible does not approve deletion.

Deletion requires:

- dynamic import search,
- route reach proof,
- fixture/harness proof,
- C-suite deletion approval.

Treat `.audit-output-614a103/deletion-candidates.md` as the current deletion-candidate ledger.

## 10. How To Work In This Repo

Before changing code:

1. Identify the failing gate or proof row.
2. Name the engine owner.
3. Trace the handoff chain: input -> engine handoff -> artifact/carrier -> approval gate -> UI/lifecycle surface.
4. Map connected surfaces: modes, artifacts, route authority, provider path, Great Stop, Review/Lock, tests, public UI, lifecycle consumers.
5. Classify the failure:
   - missing carrier,
   - wrong owner,
   - stale wrapper,
   - query-as-proof risk,
   - candidate-as-proof risk,
   - user-search-as-proof risk,
   - admission/selection gap,
   - materialization gap,
   - provider-envelope issue,
   - hosted/runtime mismatch.
6. Define the correct seam.
7. Only then implement the smallest safe fix.

Stop and surface when:

- a move becomes bigger than scoped,
- ownership is ambiguous,
- a third patch would hit the same seam,
- a fix would put domain logic in the kernel,
- a fix would make Application author truth,
- a provider call is needed,
- a finding contradicts this Bible or the accepted audit ledger.

## 11. Current Atlas-Carry Claims

These are safe to carry forward:

- Six-engine ownership model.
- Field owns the governed provider/API boundary.
- Retrieval/query logic is scattered and needs consolidation.
- CanonicalInterpretationBundle exists and is consumed.
- ContractGateWorld and StrategyAdmissibleWorlds exist.
- Waypoint boundary is `src/integrations/waypoint/core.ts` via `rankArcCandidates.ts`.
- Build has a contract-driven Waypoint path.
- SelectedRouteArtifact and CurateRefinementEntryPayload are legacy compatibility, not authority.
- LCE governing policy is missing.
- Application renders truth and must not author it.
- Canonical lock spine includes `ContractEntryArtifact -> RuntimeRouteArtifact`.

## 12. Claims To Retire

Do not carry these forward as current truth:

- Modes differ only at intent entry.
- The canonical chain can omit ContractEntryArtifact.
- Interpretation has only two lenses/subsystems.
- LCE is engine 5 of 5.
- There is only one ExperienceContract builder/system.
- Phase 2 resolved most App truth-authoring.
- RouteShapeContract is cleanly relocated and settled.
- routeAuthority is future/end-state lock authority.
- Field live breadcrumbs and budget numerics are confirmed current code truth.
- LCE Field live signal ingestion is active.

## 13. Guardrails For Future Work

Provider valve:

- Keep provider calls at zero unless explicitly activated.
- No `/api/field/text-search` or Google Places calls without operator approval and governed boundary.
- No direct client/browser provider calls.
- No cap loosening as a quiet fix.

Git/worktree:

- Do not stage audit outputs, input docs, sidecars, or generated docs unless explicitly asked.
- Do not commit or push without explicit instruction.
- Do not delete old docs in a Bible pass.

Architecture:

- Do not start Experience Composition work unless explicitly scoped.
- Do not start ExperienceContract merge unless explicitly scoped.
- Do not implement Curate RouteShapeContract fix unless explicitly scoped.
- Do not fix Family L1 PlaceRight from sidecar context unless explicitly scoped.
- Do not touch `evaluateTasteRoleIntentCore` unless the task explicitly targets it.

## 14. Fast Reference

| Need | Current source |
|---|---|
| Full file register | `.audit-output-614a103/file-register.csv` |
| Machine register | `.audit-output-614a103/file-register.ndjson` |
| Audit executive summary | `.audit-output-614a103/audit-summary.md` |
| Counts | `.audit-output-614a103/aggregate-counts.md` |
| Mode traces | `.audit-output-614a103/mode-execution-traces.md` |
| Contract/artifact inventory | `.audit-output-614a103/contract-artifact-inventory.md` |
| Masking surfaces | `.audit-output-614a103/masking-surfaces.md` |
| Deletion candidates | `.audit-output-614a103/deletion-candidates.md` |
| Doc verification closure | `.audit-output-614a103/doc-verification-closure.md` |
| This team-facing map | `ID8_Technical_Bible.md` |

## 15. One-Line Reminder

Build from the spine, protect the seams, keep meaning in Interpretation, keep feasibility in Bearings, keep sequencing in Waypoint, keep runtime preservation in LCE, keep truth out of Application, and never let static or legacy compatibility masquerade as authority.
