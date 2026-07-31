# ID.8 / ARC — RE-HOUSING WORKLIST
## Step 1 of 3 · July 2026 · Every audit finding sorted against the End-State Map
### Source: 7 read-only audits at HEAD `1241da5c` (Interpretation, Field, Bearings, Waypoint, LCE, Application, Homeless). Target: `ID8_Arc_EndState_Engine_Architecture.md`.

> **What this is:** every finding from the seven audits, sorted into **KEEP** (housed correctly), **MOVE** (built, wrong home → named target), or **BUILD** (gap — the map names it, no code authors it). This is the concrete worklist that turns the end-state map into action.
>
> **The headline:** this is overwhelmingly a **MOVE** job, not a **BUILD** job. Almost everything exists. It's in the wrong rooms. Two "gravity wells" hold most of the misplaced code, and dissolving them is the bulk of the work.
>
> **Governing principle:** domain-specific → Interpretation (the lens); everything else domain-agnostic. Every MOVE below either returns leaked meaning to Interpretation, returns feasibility to Bearings, or keeps the Waypoint kernel clean. Each MOVE is simultaneously an MVP fix and a portability fix.

---

## THE TWO GRAVITY WELLS (the structural core of the work)

Every audit independently pointed at the same two modules absorbing other engines' jobs. Dissolving these two is ~70% of the re-housing.

### GRAVITY WELL 1 — `src/domain/arc/` (the meaning + feasibility + sequencing dumping ground)
This module became the catch-all. It holds code belonging to **three** different engines. It must be dissolved and redistributed:
| Code in `arc/` | Really belongs to | Target |
|---|---|---|
| `scoreArcAssembly.ts:1965` — `momentStrengthScore`, `strongMomentPresent`, flat-arc penalties | **Interpretation/Taste** (meaning) | moment strength is Taste's; MOVE |
| `scoreArcAssembly.ts:3506,:3562` — moment/romantic/family/category/vibe scoring | **Interpretation/Taste** (meaning) | MOVE — "the biggest non-Waypoint scoring body" |
| `scoreArcAssembly.ts:3506` — pacing/spatial/movement/geography scoring | **split**: pacing/transitions → Waypoint; movement feasibility → Bearings | MOVE (split) |
| `directionPlanning.ts:41` — `DirectionPlanningSelection` | **Interpretation** (Direction System belongs there) | MOVE |
| `directionPlanning.ts:553` — `buildRouteShapeContract()` role profiles/invariants | **Interpretation** authors experience composition; route-shape → Waypoint seam | MOVE (split) |
| `directionPlanning.ts:778,:934,:985` — Great Stop risk in direction validation | **Great Stop contract** (see homeless) | MOVE to aggregator |
| `assembleArcCandidates.ts:39` — warmup/peak/cooldown/wildcard shape assembly | **Waypoint** (sequencing) | MOVE toward Waypoint |
| `assembleArcCandidates.ts:866` — top-40 compact preservation | **compensation tell** — remove once upstream supply/admission fixed | BUILD-then-delete |
| `assembleArcCandidates.ts:425` — anchor match recognition | **Interpretation** (anchor-as-peak authoring) | MOVE |
| `isValidArcCombination.ts:113,:263` — geography, dup venue, category repetition, crew, energy | **split 3 ways**: category→Interpretation, geography→Bearings, sequence→Waypoint | MOVE (split) |
| `scoreArcAssembly.ts:3506` — movement/duration/coherence/pacing | **split**: movement→Bearings, pacing→Waypoint | MOVE (split) |

**Direction of travel:** `arc/` should not exist as an engine-agnostic scoring dump. Its contents split cleanly to Interpretation (meaning), Bearings (feasibility), Waypoint (sequencing). This is the single largest re-housing.

### GRAVITY WELL 2 — `src/engines/district/` (a homeless mini-engine outside the six)
District is running as its own standalone engine, mixing three engines' jobs. Per the map, **District Intelligence is a sub-engine INSIDE Interpretation** (with Hyperlocal folded in):
| Code in `engines/district/` | Really belongs to | Target |
|---|---|---|
| `core/buildDistrictOpportunityProfiles.ts:98` — structural place meaning | **Interpretation/District sub-engine** | MOVE into Interpretation |
| `scoring/computeTasteLite.ts:7` — taste-like signals (has TODO: "replace with real Interpretation/taste") | **Interpretation/Taste** | MOVE — the TODO already admits it |
| `scoring/computeBearingsLite.ts:10` — directional geometry signals | **Bearings** (or District-structural, but not "Bearings-lite") | MOVE/rename |
| `entities/fetchPlaceEntities.ts:51` — entity retrieval | **Field** (retrieval) | MOVE to Field |
| `candidates/buildDistrictCandidateGeoIndex.ts`, `clustering/formRawPockets.ts`, `viability/applyPocketViabilityRules.ts` | **split**: geo/pocket formation → Field raw-world; viability → Bearings; structural meaning → Interpretation/District | MOVE (split) |

**Direction of travel:** dissolve `engines/district/` as a standalone. Its structural-meaning core becomes Interpretation's District sub-engine; its retrieval goes to Field; its viability goes to Bearings.

---

## PER-ENGINE RE-HOUSING

### FIELD — *detects current reality; owns "how we query the world"*

**✅ KEEP (housed correctly):**
- `api/field/text-search.ts:43` — governed provider ingress ✓
- `api/field/_lib/fieldLedgerStore.ts` — KV/cache/budget ledger ✓
- `api/field/ledger-readiness.ts` — no-provider readiness ✓
- `api/field/_lib/fieldTextSearchProvider.ts` — server Google adapter ✓
- `src/domain/field/fieldProxyTypes.ts` + `fieldRequestValidation.ts` — proxy contract ✓

**➡ MOVE INTO Field (retrieval that's scattered elsewhere):**
- `src/domain/sources/fetchLivePlaces.ts:550` — general live retrieval → Field
- `src/domain/sources/buildLiveQueryPlan.ts:84` — query planning → Field (but strip semantic intent — that's Interpretation's; Field queries, doesn't mean)
- `src/domain/providers/buildProviderSourceOpportunity.ts:351` — Build's separate provider path → Field (consolidate with general path)
- `src/domain/retrieval/retrieveVenues.ts:703` — retrieval funnel/merge → Field
- `src/domain/sources/mapLivePlaceToRawPlace.ts:522` — raw place mapping → Field
- `src/domain/providers/ProviderAdapter.ts:319` + `providerGovernance.ts:75` + `buildProviderPublicLiveWiring.ts` — provider dispatch/governance/envelope → Field boundary (governance can stay shared infra, but the Field-facing wiring consolidates)
- `engines/district/entities/fetchPlaceEntities.ts:51` — entity retrieval → Field (from gravity well 2)

**🔨 BUILD (gaps the map names, no code owns):**
- **Single consolidated Field boundary** — no `FieldWorld`/`FieldSnapshot`/`RawWorld` artifact exists. BUILD the one Field owner that produces a consolidated current-world picture.
- **Deliberate Field-owned query planner** — currently mode-improvised (general + Build each author query text separately). BUILD one planner.
- **"Happening right now" live sensing** — currently only `openNow`/hours/status; crowd/demand/activation is heuristic. BUILD live pressure sensing (this is Field V2 territory — likely NOT MVP; flag for calibration).
- **Field-owned hours truth** — currently split Field↔normalization↔Bearings. Decide the seam (see Bearings).

---

### INTERPRETATION — *the lens; turns signals into meaning*

**✅ KEEP (housed correctly):**
- `buildCanonicalInterpretationBundle.ts:808` — single CIB builder ✓
- `buildCanonicalInterpretationBundle.ts:412` — ExperienceContract builder ✓ (real fields, but coarse — see BUILD)
- `taste/interpretVenueTaste.ts:747` — Taste Engine (role suitability, personality, moment potential/intensity/tier, anchor strength) ✓
- `taste/types.ts:271` — TasteSignals contract ✓
- `taste/detectMoments.ts:542` — moment detection ✓
- `taste/districtTasteBridgeArtifact.ts:249` — district→taste bridge ✓ (valid if District is a sub-engine — which the map says it is)

**➡ MOVE INTO Interpretation (meaning that leaked out):**
- `arc/scoreArcAssembly.ts:1965` — **moment strength** → Taste (THE Adega fix — moment strength must be Taste-authored, not Arc-computed)
- `arc/scoreArcAssembly.ts:3562` — romantic/family/category/vibe scoring → Taste
- `arc/directionPlanning.ts:41` — Direction System → Interpretation (Direction belongs inside the lens)
- `direction/buildDirectionCandidates.ts:784,:1449` — `deriveDirectionExperienceIdentity()`, experience-family/moment authoring → Interpretation
- `direction/applyVibeShaping.ts:552` + `applyPersonaShaping.ts:106` — meaning-facing shaping → Taste (extract Direction System's hospitality tuning back to Taste; Direction stays thin, asks Taste)
- `retrieval/scoreVenueFit.ts:747,:1286` — role preference/highlight-fit decisions → Interpretation (retrieval may USE taste signals, but must not DECIDE role meaning)
- `engines/district/core/buildDistrictOpportunityProfiles.ts:98` — structural place meaning → Interpretation/District sub-engine (gravity well 2)
- `engines/district/scoring/computeTasteLite.ts:7` — → Taste (the TODO admits it)
- App-authored role/meaning copy: `SandboxConciergePage.tsx:2633,:3153,:3605` — role tone/details/anchor copy → Interpretation payload (app renders, doesn't author)

**🔨 BUILD (gaps):**
- **Intrinsic moment strength / anchor-as-peak authoring** — Interpretation has `momentPotential`/`momentIntensity` but does NOT promote a selected Build anchor into "intended highlight peak with appropriate strength." This is the Adega root. BUILD it in Taste. *(MVP-critical.)*
- **Experience-level composition contract** — composition currently exists as route-shape role-profiles in `arc/`, not as an Interpretation-authored experience composition. BUILD it.
- **Unify the two ExperienceContract systems** — `contracts/experienceContract.ts:152` (scenario) and `buildCanonicalInterpretationBundle.ts:412` (canonical) both exist, both in Interpretation, not unified. MERGE to one.
- **Fold Hyperlocal into District** — (from last night's decision) Hyperlocal's micro-pocket resolution → District sub-engine.
- **Richer venue meaning for provider-backed anchors** — `taste/mapVenueToTasteInput.ts:101` is thin for live Build anchors. BUILD enrichment. *(MVP-relevant.)*

---

### BEARINGS — *applies real-world constraints (feasibility, movement, timing)*

**✅ KEEP (housed correctly):**
- `buildContractGateWorld.ts:2016,:87,:1506` — admitted-world builder + shape + gating ✓
- `buildContractGateWorld.ts:2162` — canonical Interpretation→Bearings adapter ✓
- `buildStrategyAdmissibleWorlds.ts:1227,:1077` — strategy worlds ✓
- `staticRuntimeHoursProof.ts:107` + `hoursAdmissibilityPolicy.ts:86` — hours proof/policy ✓
- `fieldCorpusRuntimeHoursAdmission.ts:57` — applies hours policy to Field corpus ✓
- `assessDirectionContractBuildability.ts:55` — supply-envelope feasibility ✓
- `buildGreatStopAdmissibilitySignal.ts:23` — consumes GS verdict as suppression signal ✓ (consumes quality, doesn't author it)

**➡ MOVE INTO Bearings (feasibility that leaked out):**
- `app/services/buildCandidateAdmission/buildCandidateAdmissionService.ts:305,:222,:314` — candidate admission, geo posture, anchor hard-gate → Bearings (app service doing Bearings' job)
- `normalize/inferHoursPressure.ts:150` + `normalize/applyQualityGate.ts:88,:200` — hours inference/demotion → Bearings (consolidate hours realism)
- `retrieval/computeRoleAwareHoursPressure.ts:18` — hours pressure → Bearings
- `retrieval/retrieveVenues.ts:921` — city/distance admission (`driveMinutes<=max`) → Bearings (movement admissibility)
- `arc/isValidArcCombination.ts` (geography portions) — spatial feasibility → Bearings
- `arc/assembleArcCandidates.ts:1088,:1201` — spatial feasibility invalidation → Bearings
- `arc/scoreArcAssembly.ts:3506` (movement portions) — movement pressure/geography → Bearings
- `arc/buildRolePools.ts:2023` — movement hard-rejects → Bearings
- `integrations/waypoint/core.ts:470` (feasibility portions) — movement compactness re-derivation → Bearings owns the truth, Waypoint may read it
- `engines/district/scoring/computeBearingsLite.ts:10` — → Bearings (gravity well 2)
- `greatStop/buildGreatStopGateResult.ts:225` (`place_right` movement) — → coordinate with Bearings (movement feasibility vs. quality-place; see Great Stop)

**🔨 BUILD (gaps — the input-starvation problem):**
- **Real user time capture** — `normalizeIntent.ts:73` only carries optional timeWindow; if absent, `resolvePlanningTimeWindow.ts:28` falls back to fixed **Friday 7PM default**. BUILD real time into the flow so Bearings can enforce timing. *(MVP-critical — without it "doable tonight" is fiction.)*
- **Precise movement origin** — `intent.ts:475` has city/neighborhood but **no user origin lat/lng**. Bearings can't measure movement from actual location. BUILD origin capture. *(MVP-relevant — decide how precise the MVP needs.)*
- **Per-stop temporal feasibility** — `staticRuntimeHoursProof.ts:47` checks one instant, not each stop's arrival across the route. BUILD full-route temporal check.
- **Single route-candidate admitted-world gate before Waypoint** — currently missing; Waypoint consumes already-assembled candidates. BUILD the Bearings route-level gate.
- **Consolidated hours policy** — unify the split (normalization + quality gate + retrieval + Bearings) into one Bearings-owned policy.

---

### WAYPOINT — *coordinates the sequence + aggregates Great Stop*

**✅ KEEP (the kernel is clean — protect it):**
- `integrations/waypoint/core.ts:1` — boundary statement (excludes interpretation/admissibility/presentation) ✓
- `core.ts:31` — consumes CIB + StrategyAdmissibleWorld + required-stop + route shape as INPUTS ✓
- `rankArcCandidates.ts:29` — `rankArcCandidatesFromContract` ✓
- `core.ts:650` — deterministic final ordering ✓
- `core.ts:228` — opaque lane/role/energy/spatial scoring (no hardcoded categories — confirmed clean) ✓
- `core.ts:606` — contract trace diagnostics ✓

**➡ MOVE OUT of Waypoint (things that shouldn't be in the kernel):**
- `core.ts:332` — host-vocabulary refinement (`more-exciting`, `little-fancier`, `closer-by`, etc.) → this is Interpretation/steering semantics, NOT kernel. MOVE OUT.
- `core.ts:164` — price/drive-spread "fancier/closer" preference → semantic, MOVE OUT
- `core.ts:470` (feasibility penalties) — movement/transition/backtrack → Bearings owns truth (Waypoint may read admitted movement, not re-derive it)
- `waypoint/buildContractDrivenBuildWaypointPlan.ts:329` — required-anchor repair-after-parity → this is a compensation tell; the anchor should survive upstream (Bearings guarantee), not be repaired here
- `waypoint/buildContractDrivenBuildWaypointPlan.ts:527` — post-repair Great Stop verification → Great Stop aggregator (see homeless)

**➡ MOVE TOWARD Waypoint (sequencing that's stranded in `arc/`):**
- `arc/assembleArcCandidates.ts:39` — core route-shape assembly (warmup/peak/cooldown) → Waypoint
- `arc/scoreArcAssembly.ts:3506` (pacing/transition portions only) → Waypoint

**🔨 BUILD (gaps):**
- **Hard build→peak→taper gate** — `core.ts:282` scores arc progression but doesn't gate it; Great Stop does the load-bearing moment gate later. BUILD the Moment-arc as a Waypoint-owned STAMP that feeds the Great Stop aggregator.
- **Single owner for sequencing/pacing/transitions** — currently split across Arc/Great Stop/Waypoint. CONSOLIDATE into Waypoint.
- **Great Stop aggregation** — (map decision) Waypoint aggregates the 5 stamped verdicts → one PASS/FAIL. BUILD the aggregator here (counts stamps, never computes them). *(This is the Great Stop home from last night.)*
- **Retire the legacy no-contract ranking path** — `rankArcCandidates.ts:11` — delete once contract path proven sole (Phase 5).

---

### LCE — *keeps the sequence aligned as reality changes*

**✅ KEEP (housed correctly):**
- `lce/lceRuntimeContract.ts:1,:35,:135` — runtime contract shell, consumes RuntimeRouteArtifact first (NOT SelectedRouteArtifact) ✓
- `lce/lceRuntimeContract.ts:148,:206` — never-silent-mutation diagnostics, commit gate requires runtime route + confirmation ✓
- `lce/continuationContract.ts:10` — detect/alert/preview/confirm vocabulary ✓ (but allows legacy `planner_arc_itinerary` — tighten)
- `artifacts/runtimeRouteProjection.ts:172` — runtime patch helper (patches, doesn't regenerate) ✓
- `LiveJourneyPage.tsx:76` — continuation target `runtime_final_route` ✓

**➡ MOVE INTO LCE (runtime adaptation scattered into app/page):**
- `app/services/sandbox/sandboxSwapService.ts:182` — swap patch orchestration (canonical rewrite, replacement construction) → LCE (app should gate, LCE should perform)
- `LiveJourneyPage.tsx:793,:404` — page-local `patchFinalRouteStop` + duplicate patch helper → LCE (use `runtimeRouteProjection`, not page-local)
- `LiveJourneyPage.tsx:623` — live alert policy in page state → LCE intervention policy
- `components/journey/JourneyMapReal.tsx:985` — nearby live data feeding UI → route through LCE
- `domain/live/canonicalizeNearbySwapTarget.ts:45` — → under LCE mutation governance

**🔨 BUILD (gaps):**
- **Governing intervention policy (Signal → Impact → Action)** — `lceRuntimeContract.ts:189` has "confirmation required" but no real framework. BUILD it. *(The doc's known P2 gap.)*
- **Live conditions actually feeding LCE** — type supports `field_runtime_reality`/`live_provider_envelope` but the real swap flow doesn't build an LCE contract from live signals. WIRE Field's live sensing → LCE. *(Depends on Field's live-sensing gap — likely post-MVP.)*
- **Real-data proof** — currently only `static_runtime_fixture` tests. Needs live proof (depends on above).

**🗑 DELETE (Phase 5):**
- `lce/lceRepair.ts:120,:158,:191,:215` — legacy repair path (operates on `ArcCandidate`, not locked runtime). Quarantine then delete.
- `AppShell.tsx:1853,:1884` — legacy repair reachable from app. Delete.

---

### APPLICATION — *turns the stack into a usable product; renders truth, never authors it*

**✅ KEEP (genuinely built and working):**
- `routeRecommendationLifecycle.ts:1,:52` — lifecycle states, candidate previews non-lockable ✓ (this is GOOD — see homeless resolution)
- `routeAuthority/routeAuthorityService.ts:557,:918` — canonical truth selection, rejects shadow/candidate/legacy ✓
- `SandboxConciergePage.tsx:22006` — CTA lifecycle gating (candidate → "Continue building" not "Review") ✓
- `HomePage.tsx`, `PlansHubPage.tsx`, `LiveJourneyPage.tsx` (render surfaces) ✓
- `live/liveSessionHandoff.ts:37` — lock→live handoff ✓

**➡ MOVE OUT of App (shadow-engine behavior):**
- `SandboxConciergePage.tsx:3402,:3605` — candidate/legacy route projection + anchor copy → render Interpretation payload, don't shape truth/copy
- `buildCurateCommittedRouteFallback.ts:145` — synthesizes fallback ContractEntryArtifact → this is authoring truth; MOVE to proper generation or DELETE
- `SandboxConciergePage.tsx:4705,:4762,:16027` — preview steering local scoring ("more lively/shorter moves" scored locally) → **steering must request engines to re-generate, not locally re-rank** (this is the inert-chips gap)
- `app/preview/planPreview.ts:193,:244` — stop rationale/"why this works" fallback copy → render Interpretation payload (compensates for thin meaning — fixed when Interpretation enriches)
- `SandboxConciergePage.tsx:17160` — swap narrative copy → Interpretation/LCE payload

**🔨 BUILD (gaps):**
- **Steering-before-lock wired to engines** — chips exist but locally re-rank. BUILD the "request engines to adjust" loop (chip → re-drive Interpretation/Waypoint → new route). *(MVP-relevant — it's the "adjust before you lock" promise. Note: wiring chips to Place-Right/Moment-Right presets is post-MVP, but wiring them to re-generate at all may be MVP.)*
- **Trust/rationale fully from Interpretation** — UI still invents fallback rationale. Resolves when Interpretation payload gets richer (dependency on Interpretation BUILD items).

---

## THE FOUR HOMELESS SYSTEMS — RESOLVED (with file/line)

| System | Current (homeless) location | Resolution | Action |
|---|---|---|---|
| **ConciergeIntent** | Split: `app/concierge/conciergeIntentAdapter.ts:203` (app authors posture) + `interpretation/projectConciergeIntentToIntentInput.ts:30` (Interpretation projects) | **Interpretation authors, all read.** App collects raw UI only. | MOVE intent-posture authoring from app adapter → Interpretation. App adapter becomes dumb collector. |
| **Great Stop** | Enforced in 5 places: `greatStop/buildGreatStopGateResult.ts` + `bearings/buildContractGateWorld.ts:1522` + `arc/directionPlanning.ts:778` + `SandboxConciergePage.tsx:2132` | **Output contract: engines STAMP criteria, Waypoint AGGREGATES.** | BUILD: each engine stamps its criterion (Field=Real, Taste=Role/Intent/Moment-meaning, District/Bearings=Place, Waypoint=Moment-arc); Waypoint aggregates. Retire the scattered enforcement. |
| **Route Lifecycle** | `routeRecommendationLifecycle.ts` (app service) — already built well | **Application orchestration.** Already correctly placed. | KEEP. Formalize as the owned App state machine. Minor: tighten so all state transitions route through it. |
| **routeAuthority** | `routeAuthority/routeAuthorityService.ts` (app service) | **DISSOLVE into "lockable lifecycle state + Great Stop pass."** | Refactor: authority becomes a derived query (state + GS verdict), not a separate arbiter. Near-term KEEP as-is (it works); dissolve conceptually. |

**Note on ConciergeIntent:** the Homeless audit flags `conciergeIntentAdapter.ts:203` as "contains real intent-policy decisions, not purely pass-through." That's the app authoring meaning — the one place ConciergeIntent ownership is still split. The MOVE: intent *policy* (posture, pacing, travel tolerance) → Interpretation; the app adapter only forwards raw UI selections.

---

## THE GAPS — what's actually MISSING vs. just misplaced *(MVP CALIBRATED)*

**Almost everything is a MOVE. The genuine BUILDs (net-new, not relocation) are short — and now scoped:**

| Gap | Engine | MVP scope (LOCKED) |
|---|---|---|
| Anchor-as-peak / intrinsic moment strength authoring | Interpretation/Taste | ✅ **MVP-CRITICAL** — the Adega root |
| Real user time capture into the flow | Bearings (needs intent+app) | ✅ **MVP-CRITICAL** — "doable tonight" is fiction without it |
| Great Stop stamp-and-aggregate mechanism | Waypoint + all engines | ✅ **MVP-CRITICAL** — the quality gate |
| Consolidated Field boundary + query planner | Field | ✅ **MVP-CRITICAL** — kills the scattered-retrieval mess |
| Experience-level composition contract | Interpretation | ✅ **MVP-CRITICAL** — composition currently stranded in arc/ |
| Precise movement origin | Bearings (needs intent+app) | ✅ **MVP-CRITICAL** — pairs with time; enables real movement feasibility |
| Steering-before-lock wired to engines | Application | ✅ **MVP-CRITICAL** — the "adjust before you lock" promise (wiring chips to *presets* stays post-MVP; wiring them to *re-generate at all* is MVP) |
| LCE governing policy (Signal→Impact→Action) | LCE | ⏸ **POST-RE-HOUSING (decide from evidence)** — LCE sits on top of everything else's output; its policy can't be specced until the re-housed pipeline is settled and observable. Decide by watching the new architecture run. |
| Field "happening right now" live sensing | Field | ⛔ **POST-MVP (Field V2)** — depends on live-signal infrastructure |
| LCE fed by live conditions + real-data proof | LCE + Field | ⛔ **POST-MVP** — depends on Field V2 live sensing |

**The MVP-critical BUILD list is 7 items.** Everything else in this document is MOVE (relocate existing code) or DELETE (Phase 5 cruft). LCE governing policy is the one deferred-by-design item — it's the last engine to spec because it depends on the others being home first.

---

## PHASE 5 DELETE LIST (quarantined cruft — confirmed orphan-able)
- `artifacts/selectedRouteArtifact.ts` — legacy, quarantined
- `app/wrapper/curateRefinementEntry.ts` — legacy compat wrapper
- `SandboxConciergePage.tsx:5279` — Paper Plane `step2_static_build_paper_plane` (mandatory retire — masks generic regressions)
- `app/preview/planPreview.ts:290` — legacy direction fallback adapter
- `lce/lceRepair.ts` + `AppShell.tsx:1853,:1884` — legacy LCE repair
- `waypoint/postPlannerCommitParity.ts:197` — post-planner parity scaffold (legacy two-truth reconciliation)
- `sources/devGreatStopFixtures.ts` — dev fixtures
- Waypoint legacy no-contract ranking path `rankArcCandidates.ts:11`

---

## CURRENT A1/A2/A4 IDENTITY WORKLIST - 2026-07-28
*This addendum records the accepted Stage 2 remainder inventory from current code truth. It does not dissolve the full historical re-housing worklist.*

### Completed Identity Rows
| Row | Status | Owner | Scope | Proof / Pass Condition |
|---|---|---|---|---|
| Stage 0 - governed source preservation | complete | Field evidence | `src/domain/field/corpus/evidence/provider-corpus-real-1781057364783/` | 96-row source preserved byte-exact; SHA-256 `9fa6fafbc1fdaf11859bcce709722417760c25f290ed1e84897993f14525f65f`; no behavior change. |
| Stage 1 - Interpretation venue identity resolution | complete | Interpretation | `src/domain/interpretation/venueIdentity/*`, focused offline proof | Static convergence, provider-only deterministic IDs, pending/ambiguous states, city portability, duplicate convergence, provider IDs provenance-only. Corpus gate denominator verified: 96 observations minus four static rows (2, 7, 42, 64) = 92 provider-only observations. |
| Stage 2A - Field to Interpretation handoff | complete | Field -> Interpretation | `fetchLivePlaces` handoff path and Stage 2A proof | Field carries raw/provider provenance; Interpretation authors resolution; pending identities do not enter `FetchLivePlacesResult.venues`. |
| Stage 2B - Bearings admission | complete | Bearings | venue identity admission helper and proof | Resolved identities may be admitted; pending/ambiguous/provider-derived identities remain diagnostic-only; no routeAuthority or lock work. Verified corpus-gate result: 82/92 provider-only observations route-eligible, 77 unique route-bearing provider-only identities, 10 pending (`coordinate_only:3`, `multi_venue_address_without_unit_data:7`), zero `live_google_*` route-bearing identities; exact-count gate, no invented percentage threshold. |
| Stage 2C - Build provider supply through admitted identity | complete at `09ca966` | Field -> Interpretation -> Bearings -> Build consumer | Build provider supply path | Build provider route supply uses admitted resolved identity; `live_google_` / `providerRecordId` remain provenance only; accounting `243 + 533 + 179 = 955` closed. |
| Stage 2D - Build anchor ingress | complete at `2102be1` | Field -> Interpretation -> Bearings; Application consumes | `ProviderAdapter.searchAnchorPlaces`, Build anchor orchestration, provider fixture identity handling, and Stage 2D proof | Direct Build anchor/provider ingress materializes selectable `Venue` only after Field -> Interpretation -> Bearings identity/admission; diagnostic-only results retain evidence and cannot be selected. |
| Stage 2E-1 - retrieval merge/dedupe identity preservation | complete at `6bcbf4e` | Retrieval consumes; Field/Interpretation/Bearings remain identity owners | `src/domain/retrieval/dedupeVenues.ts`, `src/domain/retrieval/retrieveVenues.ts`, `scripts/test-stage-2e-retrieval-identity-guard.ts` | Retrieval preserves admitted canonical `Venue.id`; same admitted identities merge; distinct admitted identities remain distinct; provider provenance and similarity heuristics cannot author route identity; required inventory is canonical-only. |
| Stage 2E-2 - scoring candidate-identity preservation | complete at `99f9bed` | Scoring consumes; Field/Interpretation/Bearings remain identity owners | `src/domain/retrieval/scoreVenueFit.ts`, `scripts/test-stage-2e-scoring-identity-guard.ts` | Scoring preserves admitted `Venue.id`; base, Moment, and activation wrappers may carry distinct `candidateId` values while sharing one physical `baseVenueId`; unparented or unresolved-parent Moments remain preserved supply but are excluded from selectable MVP candidates. Stage 2E is globally CLOSED through retrieval, dedupe, and scoring. |
| Packet 1 - A1 canonical physical identity | locally complete at `d41eecd` | Interpretation owns; Field/Bearings consume or preserve by boundary | approved local/offline identity spine | Canonical `baseVenueId` consolidation is closed for approved local/offline paths. Field retains source observation identity and provenance; Interpretation authors canonical physical identity; Bearings adjudicates route-bearing admission. |
| Packet 1 - A2 provider identity provenance | locally complete at `d41eecd` | Field owns provenance; Interpretation/Bearings prevent route-bearing promotion | approved identity spine through downstream preservation | Provider IDs are provenance-only across the approved identity spine. `live_google_*` and `providerRecordId` may remain Field evidence but cannot become route-bearing canonical identity through the closed local path. |
| Packet 1 - A4 candidate-evidence continuity | locally complete at `d41eecd` | Field / Interpretation / Bearings / retrieval / Waypoint evidence remains owner-attributed | A4 proof composition | Candidate-level evidence continuity is closed by composition from existing carriers. No runtime carrier enrichment, shared diagnostic-contract expansion, or new universal identifier is required; minimum enrichment map is empty; provider calls attempted zero. |

### Remaining / Held Rows
| Row | Owner | Scope | Dependency | Pass Condition | Held / Protected Files | Behavior-Changing Status | Proof Requirement | Stop Condition | C-suite Approval |
|---|---|---|---|---|---|---|---|---|---|
| Hybrid portable retrieval identity classification | held / unresolved boundary | `src/domain/retrieval/hybridPortableAdapter.ts` | C-suite scope ruling | Determine whether hybrid portable dedupe belongs in Stage 2E-2, Stage 2F, or later cleanup without widening Stage 2E-1. | Do not modify without explicit packet approval. | Open classification; not closed by Stage 2E-1. | Read-only classification or separately approved proof. | Any attempt to widen Stage 2E-1 retroactively. | Held. |
| Stage 2F-1 - Waypoint/Arc candidate-materialization identity parity | Waypoint consumes; Field/Interpretation/Bearings remain identity owners | `ScoredVenue` -> role pools -> Arc candidate assembly -> combination validation -> route selection before Application/protected handoff | Stage 2E globally closed at `99f9bed` | Local identity parity line is complete through integrated Packet 1 closure at `d41eecd`: `candidateId` remains wrapper/candidate identity; `baseVenueId` remains admitted physical identity for duplicate prevention, physical exclusion, and required-stop preservation; raw `candidate.venue.id` has no universal meaning. | Do not touch Application projection, routeAuthority, ContractEntryArtifact, Review/Lock, RuntimeRouteArtifact, Great Stop, LCE, Stage 2G, Stage 3, provider/hosted proof. | Local Packet 1 identity behavior closed; no further Stage 2F-1 production work authorized by this record update. | Closed-valve characterization/correction/proof lineage retained locally; A4 closure proof confirms no runtime enrichment required for candidate-evidence continuity. | Any need to alter scoring/ranking thresholds, Application behavior, protected route truth, Great Stop, or routeAuthority. | Complete for local Packet 1 identity line; not a claim of governed-live, A3, Great Stop, Application masking, LCE, or MVP green. |
| Stage 2F-2 - Application and product-mode materialization identity parity | Application consumes; owners remain Field/Interpretation/Bearings/Waypoint | `AppShell`, Curate product materialization, public-card/seed bridges, sandbox/demo/debug product projection | Stage 2F-1 characterization and any approved Waypoint parity correction | Application presents/selects resolved/admitted engine truth only; no App repair, synthesis, substitution, fallback canonicalization, or provider identity promotion. | Do not touch routeAuthority, RuntimeRouteArtifact, Review/Lock, Stage 3 corpus, Great Stop purity. | Held; behavior-changing where Application fallbacks currently mask missing engine identity. | Offline product-mode fixtures proving Curate/Surprise/Build materialization use admitted identity and retain diagnostic evidence. | Any product-mode difference that requires UX/product approval rather than identity-boundary cleanup. | Held; not part of Stage 2F-1. |
| Stage 2G - LCE/live identity decision | LCE consumes/preserves; Field/Interpretation/Bearings if live observations are admitted | `src/domain/nearby/fetchNearbyPlacesForWaypoint.ts`, `src/domain/live/*`, `src/pages/LiveJourneyPage.tsx` | Stage 2D-2F inventory stable | Runtime nearby/swap/live-session paths either rewire provider observations through the accepted identity/admission seam or quarantine them as diagnostic-only; no silent provider-to-lock identity conversion. | Review/Lock, RuntimeRouteArtifact, routeAuthority remain protected unless separately approved. | Product/architecture decision likely required because runtime replacement can affect lock-bearing identity. | Offline live-session/swap fixtures; no provider calls; proof that `live_google_` remains provenance only. | Any need to change lock authority or LCE policy without C-suite ruling. | Required before implementation or explicit hold. |
| Stage 3 - corpus regeneration/promotion | Field consumes preserved source; Interpretation resolves; Bearings admission/pending states preserved | `src/domain/field/corpus/promoteProviderCorpus.ts`, `src/domain/providers/providerCorpusArtifact.ts`, `src/domain/field/corpus/resolveCurateStaticFieldCorpusVenues.ts`, governed 96-row source and regenerated artifacts | Stage 2 route-bearing producer/consumer seams closed | Regenerated corpus preserves all 96 observations, resolved IDs, pending states, provenance, and candidate-level evidence; no provider-derived canonical fallback; no 92-row shrink. | Do not run provider calls; do not silently rebaseline tests; do not delete pending evidence. | Behavior/data-artifact changing; must be isolated. | Offline regeneration/proof from preserved source only; hash/provenance/accounting emitted. | Missing source evidence, shrink, provider-derived ID, or unresolved case counted route-eligible. | Required before implementation. |
| A3 - routeAuthority / Review / Lock protected packet | Protected Application/lifecycle authority | `src/app/services/routeAuthority/routeAuthorityService.ts`, `src/domain/artifacts/runtimeRouteArtifact.ts`, `src/domain/artifacts/contractEntryArtifact.ts`, Review/Lock consumers, save/session/return continuity, compatibility consumers, LCE touchpoints | Packet 1 local A1/A2/A4 closure recorded; A3-1 characterization complete at `91dbca0`; A3-2 authority contract recorded | System audit complete; characterization complete; authority contract recorded. `approvedPayloadRouteCanonical` is legitimate pre-lock lifecycle authority. `RuntimeRouteArtifact` is post-lock authority and must preserve exact approved canonical IDs/order. Two prohibited substitutions remain open: provider/source stable-ID substitution and display-name equality substitution. | Entire A3 scope is protected from ordinary Stage 2 cleanup. Compatibility wrappers and Application repairs are retained as non-authoritative unless future proof says otherwise. | High-risk behavior-changing lock authority work; implementation not authorized. | A3-3 provider/source substitution proof, A3-4 display-name substitution proof, then big-wire approval before any production correction. | Any fallback deletion, artifact change, Review/Lock change, Application behavior change, LCE behavior change, or lock-authority change without C-suite ruling. | Big-wire approval required for behavior changes. |
| Separate proof debt - malformed Phase 2 fake ArcCandidate | Proof harness ownership TBD | Malformed fake `ArcCandidate` baseline proof | Independent of Stage 2D | Baseline debt remains explicit and not green; malformed proof cannot mask route truth. | Do not mark Great Stop or MVP green through this debt. | Proof-only unless later approved. | Focused fixture/proof that proves the malformed candidate class is eliminated or quarantined. | Any rebaseline that hides the malformed fixture. | Required before marking related proof green. |

---

## CURRENT NEXT
- **Packet 1 record state:** A1 + A2 + A4 are locally closed at `d41eecd`. This does not close governed-live validation, Great Stop parity/pre-selection, Application or compatibility masking, Review/Lock and artifact work, LCE, or MVP green.
- **A3 authority contract state:** A3 system audit and A3-1 characterization are complete. A3-2 records the approved-payload-to-runtime authority contract and bounded change map. No routeAuthority fallback deletion or behavior change is authorized without big-wire approval.
- **A3 next proof:** A3-3 should prove provider/source stable-ID substitution reachability and consumers. A3-4 should prove display-name equality substitution reachability and consumers. Do not combine them automatically; current planning judgment is that they are safely isolatable because the triggers, assertions, and proof fixtures are independent.

### A3 Bounded Authority Change Map
| Seam | Exact file | Exact symbol | Producer | Consumer | Lifecycle state | Current trigger | Current selected value | Current authority | Intended authority | Code change expected? | Preserve | Stop | Upstream dependency | Compatibility dependency | Artifact impact | Review/Lock impact | Save/session/LCE impact | Safest independent proof | Proposed slice | Big-wire approval |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | `src/app/services/routeAuthority/routeAuthorityService.ts` | `firstStableStopId / stopStableIdCandidates` | RuntimeRouteArtifact-like stops carrying `venueId`, `providerRecordId`, `sourceStopId` | `routeIds`, route/artifact comparison, lock-ready candidate diagnostics | RouteAuthority pre-lock/lock-readiness | `venueId` empty or absent while provider/source ID exists | `providerRecordId` or `sourceStopId` | Provider/source ID can become `canonicalRouteIds` and satisfy equality | Canonical venue ID from approved route truth; provider/source IDs provenance-only | Yes, if approved | Complete canonical ID/order paths; diagnostics may report provenance | Provider/source ID satisfying missing canonical identity, lockability, or artifact/runtime equality | Interpretation/Bearings must provide admitted canonical physical identity before lock | Legacy diagnostics may continue to display provider/source provenance | No artifact shape change expected; routeAuthority rejection reasons may expand only if approved | Routes missing canonical IDs should fail honestly instead of locking | Saved/LCE route should remain unchanged for valid canonical paths; invalid substitution should not lock | A3-3 provider-free reachability/consumer proof | A3-3 | Required |
| B | `src/app/services/routeAuthority/routeAuthorityService.ts` | `compareRouteToArtifact` display-name branch | ContractEntryArtifact role coverage with missing stable IDs plus RuntimeRouteArtifact display names | routeAuthority runtime/artifact comparison | RouteAuthority pre-lock/lock-readiness | artifact role identity has no ID but has display name | normalized displayName | Name equality can validate different physical venue IDs | Exact canonical stable IDs and order only; display names presentation-only | Yes, if approved | Valid canonical ID equality; display names remain render/debug fields | Display-name equality proving route equality, eligibility, or materialization | ContractEntryArtifact must carry complete canonical route role identity before lock | Legacy/display projections may still render names from authoritative routes | No artifact shape change expected unless later upstream contract proof requires stricter required identity | Missing canonical equality should fail honestly instead of Review/Lock eligibility | Saved/LCE route should remain unchanged for valid canonical paths; invalid name-only substitution should not lock | A3-4 provider-free reachability/consumer proof | A3-4 | Required |
| C | `src/app/services/routeAuthority/routeAuthorityService.ts` | `approvedPayloadRouteCanonical` | `ContractEntryArtifact.approvedPayload.finalRoute` | lock-ready canonical route truth candidate when runtime route is absent | Approved pre-lock before runtime materialization | valid artifact + approved payload + exact stable ID/order match + Great Stop/lock readiness | approved payload `finalRoute` | Legitimate lifecycle authority | Same: pre-lock approved route truth; RuntimeRouteArtifact becomes authority after materialization | No, unless later proof contradicts current ruling | Approved-payload pre-lock authority and exact equality checks | Blanket removal or mislabeling as leak | Application lifecycle approval must provide the approved payload | Compatibility consumers may project already-authoritative route only | No artifact change | Must not weaken Great Stop or lock readiness | Save/session/LCE should consume materialized runtime truth after lock | Existing A3-1 / routeAuthority shadow regression | Retain | Required for any removal |
| D | `src/app/services/routeAuthority/routeAuthorityService.ts` | `legacyCurateRefinementEntryPayload`, `legacySelectedRouteArtifact`, `pageLocalFinalRoute` | legacy Curate wrapper, selected-route wrapper, page-local projection | observedSources diagnostics and compatibility comparisons | Compatibility only | legacy/page-local route present | already-projected finalRoute | Non-authoritative compatibility diagnostics; cannot lock without canonical authority | Same: may project authority, may not create it | No, unless future orphan proof authorizes cleanup | Diagnostics and compatibility projection | Compatibility wrapper creating authority or lock eligibility | Canonical artifact/runtime authority must exist elsewhere | Direct dependency is compatibility projection | No artifact change | No Review/Lock eligibility from legacy/page-local only | No saved/LCE authority from legacy/page-local only | Existing app-authored truth relocation guard | Retain | Required for deletion |
| E | `src/app/services/sandbox/canonicalRouteArtifactService.ts` | `buildSandboxCanonicalRouteArtifact` with `routeAuthorityFinalRoute` / `renderOnlyFinalRoute` | Sandbox Build wrapper projection | Sandbox canonical route artifact and planning display stops | Application projection before/around Review | Build wrapper active and render-only route differs | `routeAuthorityFinalRoute` | Application repair/projection, not route authority | Same: project authoritative route only | No, unless future proof shows promotion | Do not promote stale render-only route; preserve routeAuthority route | `renderOnlyFinalRoute` becoming authority | routeAuthority must supply canonical route | render-only remains display-only | No artifact authority change | No Review/Lock equality change | No save/session/LCE change | Existing A3-1 Build projection proof | Retain | Required for change |
| F | `src/app/services/routeAuthority/routeAuthorityService.ts` | `buildLockSafeItineraryStops` | RuntimeRouteArtifact finalRoute plus itinerary | liveSessionHandoff lock-safe itinerary projection | Lock materialization | runtime `sourceStopId` differs from itinerary ID and role/index companion exists | finalRoute venueId/displayName/sourceStopId with itinerary details | Application repair/projection, not route authority | Same: align references while preserving canonical finalRoute IDs/order | No, unless future proof shows identity mutation | Canonical finalRoute IDs/order and itinerary details | Itinerary repair changing route authority or eligibility | RuntimeRouteArtifact must already be canonical | none beyond lock projection | No artifact authority change | No lock eligibility change | Save/session/LCE consumes same finalRoute | Existing A3-1 lock-safe repair proof | Retain | Required for change |

### A3-3 Provider/Source Substitution Proof Design
| Field | Design |
|---|---|
| Behavior to exercise | RuntimeRouteArtifact-like stops with missing/empty `venueId` and present `providerRecordId`/`sourceStopId` reaching routeAuthority. |
| Existing provider-free fixture or builder | A3-1 fixture builder in `scripts/test-a3-route-authority-characterization.ts`; routeAuthority service builders. |
| Authority substitution trigger | `firstStableStopId` and `stopStableIdCandidates` choose provider/source ID. |
| Expected current result | Snapshot can validate and emit provider/source IDs as `canonicalRouteIds`; lock input can become available. |
| Expected ruled result | Honest failure before lock when canonical venue IDs are missing; provider/source IDs remain provenance only. |
| Canonical identity assertion | Canonical route IDs must equal approved/admitted venue IDs, never `providerRecordId` or `sourceStopId`. |
| Route-order assertion | Existing valid canonical route order remains unchanged. |
| Eligibility assertion | Missing canonical IDs means no lock eligibility. |
| Artifact assertion | No artifact shape change; ContractEntryArtifact must not be treated valid for lock without complete canonical IDs. |
| Compatibility assertion | Legacy/page-local wrappers remain non-authoritative. |
| Honest-failure assertion | Rejection reason must explain missing canonical route identity rather than substituting provenance. |
| Affected regression proofs | A3 characterization, route-authority shadow, build Review/Lock handoff, phase2 cross-mode convergence, app-authored truth relocation. |
| Production implementation isolatable? | Yes, provided it only changes provider/source fallback authority and preserves diagnostic provenance. |

### A3-4 Display-Name Substitution Proof Design
| Field | Design |
|---|---|
| Behavior to exercise | ContractEntryArtifact role identities lacking canonical IDs but matching RuntimeRouteArtifact display names with different venue IDs. |
| Existing provider-free fixture or builder | A3-1 display-name fallback fixture and routeAuthority comparison path. |
| Authority substitution trigger | `compareRouteToArtifact` falls from stable ID comparison to normalized display-name comparison. |
| Expected current result | Snapshot can validate artifact/runtime equality and emit runtime IDs despite missing artifact canonical role IDs. |
| Expected ruled result | Honest failure before lock unless exact stable canonical IDs and order are proven. |
| Canonical identity assertion | Display names never satisfy canonical route equality. |
| Route-order assertion | Valid canonical routes preserve order; name-only routes cannot use order as proof. |
| Eligibility assertion | Name-only equality cannot produce Review/Lock eligibility or runtime materialization authority. |
| Artifact assertion | No artifact shape change in proof; missing role IDs remain a failure condition for lock authority. |
| Compatibility assertion | Compatibility projections may render names only from already-authoritative route truth. |
| Honest-failure assertion | Rejection reason must identify missing/mismatched canonical route identity rather than display-name mismatch masking. |
| Affected regression proofs | A3 characterization, route-authority shadow, build Review/Lock handoff, phase2 cross-mode convergence, app-authored truth relocation. |
| Production implementation isolatable? | Yes, provided it only changes display-name equality authority and preserves presentation/debug display names. |

## LEGACY NEXT (superseded by CURRENT NEXT)
- **Step 2 — Identify the gaps:** done inline (the GAPS table above). The finite BUILD list is ~10 items; the rest is MOVE/DELETE.
- **Step 3 — Calibrate the MVP:** take the GAPS table, sort MVP-critical vs. post-MVP. First cut marked above; needs your calibration pass.
- **Then:** formalize each engine in updated technical docs (the moat made legible) — this worklist is the input to that.

---
*Re-Housing Worklist · July 2026 · 7 audits @ HEAD 1241da5c sorted against the End-State Map. The work is overwhelmingly MOVE, not BUILD. Two gravity wells (`src/domain/arc/` and `src/engines/district/`) hold most of the misplaced code; dissolving them + returning meaning to Interpretation, feasibility to Bearings, and keeping the Waypoint kernel clean IS the re-housing. Every move is simultaneously an MVP fix and a portability fix. Next: calibrate which gaps are MVP.*
