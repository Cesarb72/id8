# ID.8 / ARC — RE-HOUSING DISCOVERY LOG
## Live doc · captures what we find WHILE re-housing · feeds the formal engine docs
### Companion to: `ID8_ReHousing_Worklist.md` (the plan) · Decisions go to the PDD (#108+) · This doc = discoveries during execution

> **Purpose:** the worklist is the *plan* (what to move where). This is the *live record of what actually happens when we move it* — surprises, resistances, MOVEs that turned out to be MOVE+BUILD, boundaries that were fuzzier or cleaner than the map predicted. Append as you go. Low ceremony.
>
> **Why it exists:** the formal engine docs get written LAST, from reality — not first, from intention. This log is how reality accumulates so the formal docs describe what IS, not what we hoped. (Same discipline as: PDD carries churn, canonical docs update at milestones.)
>
> **Division of labor:**
> - **Decisions** (we chose X over Y, we changed scope) → **PDD entries #108+**
> - **Discoveries** (moving X surfaced Y, boundary Z resisted) → **THIS doc**
> - **Move status** (done / not done per item) → tracker table below
> - **Formal engine truth** (what the engine IS, once home) → **formal engine docs, written at the end from this log**

---

## HOW TO LOG A DISCOVERY (keep it fast)

Append an entry under the relevant engine below. Format:
```
- [DATE] [MOVE ref] — what we expected → what we found. Impact: [clean move / became MOVE+BUILD / boundary fuzzy / boundary cleaner than expected / new gap / other]. Action: [what we did or what needs deciding].
```
If a discovery is a *decision* (changed scope, chose an approach), also log it to the PDD and note the entry number here.

---

## MOVE-COMPLETION TRACKER
*Thin status view — is each major re-housing done? (not the detail, just the state)*

### Gravity Well 1 — dissolve `src/domain/arc/`
| Move | Status | Notes |
|---|---|---|
| `scoreArcAssembly.ts` moment-strength → Taste | ☐ not started | the Adega root |
| `scoreArcAssembly.ts` meaning scoring → Taste | ☐ not started | |
| `scoreArcAssembly.ts` movement → Bearings / pacing → Waypoint (split) | ☐ not started | |
| `directionPlanning.ts` Direction System → Interpretation | ☐ not started | |
| `directionPlanning.ts` route-shape → Waypoint seam | ☐ not started | |
| `assembleArcCandidates.ts` shape assembly → Waypoint | ☐ not started | |
| `isValidArcCombination.ts` → split (Interp/Bearings/Waypoint) | ☐ not started | |
| `arc/` fully dissolved | ☐ not started | the milestone marker for WELL 1 |

### Gravity Well 2 — dissolve `src/engines/district/`
| Move | Status | Notes |
|---|---|---|
| `buildDistrictOpportunityProfiles.ts` → Interpretation/District sub-engine | complete | Implementation now lives under Interpretation/District Intelligence; consumers route through boundary. |
| `computeTasteLite.ts` → Taste | complete | Placeholder now lives under Taste; legacy path remains compatibility-only; downstream legacy signal shapes remain. |
| `computeBearingsLite.ts` → Bearings | ☐ not started | |
| `fetchPlaceEntities.ts` → Field | blocked / partial split | Whole-file move blocked by District admission, radius selection, and distance/popularity sorting. GW2-1A raw source loader extracted to Field; District orchestration/admission split still pending. |
| geo/pocket/viability → split (Field/Bearings/Interp) | partial | Structural clustering fan-in complete for `formRawPockets.ts` and `dbscan.ts`; structural identity fan-in complete for `inferPocketIdentity.ts`, `identitySignals.ts`, and `identityDecision.ts`; structural refinement fan-in complete for `refinePocketsWithSplitMerge.ts`, `splitPocket.ts`, and `mergePockets.ts`; `geoDistance.ts` held in legacy path due mixed consumers; viability/entity/admission splits remain pending. |
| `engines/district/` fully dissolved | ☐ not started | the milestone marker for WELL 2 |

### Per-engine MOVEs
| Engine | Move-in done? | Move-out done? | Notes |
|---|---|---|---|
| Field (consolidate retrieval) | ☐ | ☐ | |
| Interpretation (reclaim meaning) | ☐ | ☐ | |
| Bearings (reclaim feasibility) | ☐ | ☐ | |
| Waypoint (clean kernel) | ☐ | ☐ | protect the clean core |
| LCE (reclaim runtime adaptation) | ☐ | ☐ | |
| Application (stop shadow-engine) | ☐ | ☐ | |

### The 7 MVP-critical BUILDs
| Build | Status | Notes |
|---|---|---|
| Anchor-as-peak / moment-strength (Taste) | ☐ not started | Adega root |
| Real user time capture (Bearings+intent+app) | ☐ not started | |
| Great Stop stamp-and-aggregate (Waypoint + all) | ☐ not started | |
| Consolidated Field boundary + query planner | ☐ not started | |
| Experience-level composition contract (Interp) | ☐ not started | |
| Precise movement origin (Bearings+intent+app) | ☐ not started | |
| Steering-before-lock → engines (App) | ☐ not started | |

---

## DISCOVERIES

### Field
- [2026-07-08] [GW2 fetchPlaceEntities → Field] — expected entity retrieval relocation from District to Field → found retrieval is mixed with District admission diagnostics, radius selection, and distance/popularity ordering. Impact: blocked. Action: no code move performed; needs C-suite decision on whether admission/selection helpers move with retrieval or stay behind a cleaner seam.
- [2026-07-08] [GW2-1A Field raw source loader] — expected clean split of raw venue/source loading out of District orchestration → found curated city loading and hybrid portable source loading can move behind a Field helper without importing District internals. Impact: clean move. Action: added `loadFieldSourceVenues` in Field and rewired `fetchPlaceEntities.ts` to keep District admission, distance/radius selection, sorting, fallback selection, and result shaping in District.

### Interpretation (incl. Taste, District, Direction System)
- [2026-07-08] [GW2-HOME-1 District Intelligence boundary] — expected no-behavior scaffold for structural District Intelligence under Interpretation/District → found existing district/ contains recommendation/explanation/anchor payload logic, so structural home was established under district/intelligence/. Impact: clean boundary scaffold. Action: added no-behavior re-export boundary; no implementation moved.
- [2026-07-08] [GW2-HOME-2 District Intelligence boundary rewire] — expected no-behavior import rewire through the new District Intelligence boundary → found runtime and proof-script consumers entered through the legacy `engines/district` barrel, with one page also needing a type-only import from District types. Impact: clean boundary rewire. Action: rewired `buildDistrictOpportunityProfiles` consumers through `domain/interpretation/district/intelligence/`; no implementation moved.
- [2026-07-08] [GW2-HOME-3 District structural implementation move] — expected behavior-preserving relocation of `buildDistrictOpportunityProfiles` into the District Intelligence home → found the implementation could move cleanly while keeping existing District helper files in place via relative imports; preflight confirmed `resolveDistrictAnchor`, explanation, and insider payload files are legitimate Interpretation/District work, while `recommendDistricts` remains mixed and `getDirectionLiveSignals` is ambiguous but non-blocking. Impact: clean move with future cleanup notes. Action: moved implementation into `domain/interpretation/district/intelligence/`; removed old engines/core implementation file; no helper files moved.
- [2026-07-08] [GW2-STRUCT-1 District clustering fan-in] — expected behavior-preserving move of structural clustering files into District Intelligence → found `formRawPockets.ts` and `dbscan.ts` are safe structural clustering, while `geoDistance.ts` has mixed consumers (`entities/fetchPlaceEntities.ts`, candidate/scoring helpers, and `domain/interpretation/construction/scenarioBuilder.ts`) and should not be pulled into District Intelligence in this move. Impact: clean move with compatibility re-exports; `geoDistance.ts` held. Action: moved `formRawPockets.ts` and `dbscan.ts` to `domain/interpretation/district/intelligence/clustering/`, rewired the District builder to the local clustering path, left old clustering paths as direct re-exports, and logged temporary legacy type imports as temporary — resolves at type split. Temporary dependencies: `domain/interpretation/district/intelligence/clustering/formRawPockets.ts` imports `getDistrictPocketTruthTier`, `isFallbackPocketOrigin`, `DistrictClusteringConfig`, `PocketFallbackReasonCode`, `PocketClusteringSource`, `PocketOrigin`, `PlaceEntity`, `RawPocket`, and `RawPocketGeometryMetrics` from legacy `engines/district/types/districtTypes.ts` — temporary — resolves at type split.
- [2026-07-08] [GW2-STRUCT-2 District identity fan-in] — expected behavior-preserving move of structural pocket identity files into District Intelligence → found `inferPocketIdentity.ts`, `identitySignals.ts`, and `identityDecision.ts` are pure structural District identity helpers; `buildDistrictCandidateGeoIndex.ts` remains a temporary legacy glue consumer through old-path compatibility. Impact: clean move with compatibility re-exports. Action: moved identity implementation files to `domain/interpretation/district/intelligence/identity/`, rewired the District builder to the local identity path, left old identity paths as direct re-exports, and logged temporary legacy type imports as temporary — resolves at type split. Temporary dependencies: `domain/interpretation/district/intelligence/identity/inferPocketIdentity.ts` imports `IdentifiedPocket` and `RefinedPocket`; `identitySignals.ts` imports `RefinedPocket`; `identityDecision.ts` imports `PocketIdentity` and `RefinedPocket` from legacy `engines/district/types/districtTypes.ts` — temporary — resolves at type split.
- [2026-07-09] [GW2-STRUCT-3 District refinement fan-in] — expected behavior-preserving move of structural pocket refinement files into District Intelligence → found `refinePocketsWithSplitMerge.ts`, `splitPocket.ts`, and `mergePockets.ts` are structural pass-through refinement helpers today; `buildDistrictCandidateGeoIndex.ts` remains a temporary legacy glue consumer through old-path compatibility. Impact: clean move with compatibility re-exports. Action: moved refinement implementation files to `domain/interpretation/district/intelligence/refinement/`, rewired the District builder to the local refinement path, left old refinement paths as direct re-exports, and logged temporary legacy type imports as temporary — resolves at type split. Temporary dependencies: `domain/interpretation/district/intelligence/refinement/refinePocketsWithSplitMerge.ts` imports `RefinedPocket` and `ViablePocket`; `splitPocket.ts` imports `ViablePocket`; `mergePockets.ts` imports `ViablePocket` from legacy `engines/district/types/districtTypes.ts` — temporary — resolves at type split. Watch-item: `mergePockets.ts` still contains a future movement-cost TODO; implementing that would require Bearings ownership review and was not expanded in this move.

- [2026-07-09] [GW2-RESIDUAL-2A shared geo primitive] - expected `geoDistance.ts` to be a shared primitive rather than District-owned -> found no existing shared geo/math home and mixed consumers across District Intelligence, legacy District glue, and Interpretation construction. Impact: clean move with compatibility re-export. Action: moved implementation to `src/domain/shared/geo/geoDistance.ts`, left `src/engines/district/clustering/geoDistance.ts` as a direct re-export, and rewired current consumers to the shared path.
- [2026-07-09] [GW2-RESIDUAL-2B structural type slice] - expected a minimal safe type extraction -> found only dependency-light structural exports could move now. Impact: clean partial type slice with compatibility re-exports. Action: created `src/domain/interpretation/district/intelligence/types.ts` for `DistrictPoint`, clustering config, pocket origin/source/fallback/truth-tier helpers, `RawPocketGeometryMetrics`, and `PocketIdentity`; legacy `districtTypes.ts` preserves public exports. Held `RawPocket` because it depends on held `PlaceEntity`; held `IdentifiedPocket`/`RefinedPocket`/`ViablePocket` because viability remains a Bearings seam; held public profile/ranking/result/debug/Taste/retrieval/admission contracts.
- [2026-07-09] [GW2-RESIDUAL-2C hyperlocal structural pass] - expected hyperlocal helpers might fan into District Intelligence -> found `scoreIdentityAnchors.ts` is structural enough to move, while `resolveMicroPockets.ts` contains explicit experience-forward category/hospitality logic and should not move before Taste/category cleanup. Impact: partial clean move; mixed helper held. Action: moved `scoreIdentityAnchors.ts` to `src/domain/interpretation/district/intelligence/hyperlocal/` with an old-path compatibility re-export; left `resolveMicroPockets.ts` in legacy scoring and logged the hold.
- [2026-07-09] [GW2-TASTE-2A District->Taste contract scaffold] - expected first Taste extraction slice -> C-suite approved explicit handoff types DistrictStructuralFacts (District->Taste structural facts only) and TastePocketMeaning (Taste returns lens meaning). Impact: boundary now named before helper movement. Action: scaffold/enrich existing DistrictTasteBridgeArtifact without behavior changes; keep DistrictTasteSignals as tracked-temporary compatibility.
  DistrictTasteSignals tracked temporary - consumers: direct type/use in `src/engines/district/types/districtTypes.ts` and `src/engines/district/scoring/computeTasteBridgeSignals.ts`; `DistrictOpportunityProfile.tasteSignals` shape consumed by Direction (`src/domain/direction/buildDirectionCandidates.ts`), Bearings (`src/domain/bearings/buildContractGateWorld.ts`, `src/domain/bearings/buildStrategyAdmissibleWorlds.ts`), District ranking (`src/engines/district/ranking/rankAndSelectPockets.ts`), Taste bridge (`src/domain/interpretation/taste/districtTasteBridgeArtifact.ts`), app/page/dev UI (`src/pages/SandboxConciergePage.tsx`, `src/components/dev/DistrictPreviewPanel.tsx`), and proof scripts/tests via fixture-shaped district profiles (`scripts/test-bearings-concierge-intent-threading.ts`, `scripts/test-phase2-contract-path-causality.ts`, `scripts/test-phase2-family-local-proof.ts`). `DistrictAppSignals.tasteSignals` remains consumed by `src/components/dev/DistrictPreviewPanel.tsx`. Resolves when Direction/Bearings/app/scripts consume Taste-owned pocket meaning or bridge artifact directly.
- [2026-07-09] [GW2-TASTE-2B Taste bridge signal move] - expected behavior-preserving relocation of District-authored hospitality meaning helper -> moved/wrapped computeTasteBridgeSignals behind Taste-owned helper `computeDistrictPocketTasteMeaning` at `src/domain/interpretation/taste/computeDistrictPocketTasteMeaning.ts`. Impact: Taste now owns pocket meaning computation while legacy DistrictTasteSignals/profile.tasteSignals remain compatibility. Action: keep DistrictTasteSignals tracked-temporary until Direction/Bearings/app/scripts consume Taste-owned meaning directly.
- [2026-07-09] [GW2-TASTE-2C Taste-lite placeholder move] - expected behavior-preserving relocation of District Taste-lite placeholder -> moved/wrapped computeTasteLite behind Taste-owned helper `computeDistrictPocketTasteLite` at `src/domain/interpretation/taste/computeDistrictPocketTasteLite.ts`. Impact: Taste now owns the remaining Taste-like placeholder while legacy profile/app signal shapes remain compatibility. Action: keep DistrictTasteSignals and DistrictAppSignals.tasteSignals tracked-temporary until downstream consumers consume Taste-owned meaning directly.

### Bearings
- [2026-07-09] [GW2-BEARINGS-2A District->Bearings contract scaffold] - expected first Bearings viability extraction slice -> C-suite approved fact/verdict boundary: District computes structural metrics; Bearings owns thresholds, policy, and admissibility verdicts. Impact: scaffolded BearingsPocketFacts as a narrow view over DistrictStructuralFacts and BearingsViabilityVerdict as the Bearings return contract, with no behavior changes. Action: keep ViablePocket, PocketViabilityClass, PocketViabilitySignals, and ApplyPocketViabilityRulesResult as temporary compatibility until applyPocketViabilityRules moves behind Bearings.
  C-suite condition for GW2-BEARINGS-2B: when thresholds move into Bearings, inspect whether thresholds are hardcoded nightlife-specific values or parameterized config. If hardcoded, log as tracked-temporary: nightlife thresholds - parameterize at extraction.

### Waypoint
*(append discoveries here)*

### LCE
*(append discoveries here)*

### Application
*(append discoveries here)*

### Cross-cutting (contracts, gravity wells, seams)
- [2026-07-08] [GW2-HOME-3 District folder preflight] — expected `district/intelligence/` naming to stay clear despite existing `district/` recommendation/explanation files → found the child boundary remains clean for structural District Intelligence, but `recommendDistricts` still mixes Taste-adjacent recommendation scoring with legacy Arc role-pool glue and `getDirectionLiveSignals` appears live-signal/Direction-adjacent rather than purely structural District. Impact: non-blocking future re-housing note. Action: proceeded with implementation move; leave mixed files for later scoped cleanup.

- [2026-07-09] [GW2-LOC-1 resolveLocation ownership preflight] - expected maybe-moveable one-consumer location helper -> found temporary glue crossing raw input normalization, Field search scope, District spatial context, and future Bearings movement-origin semantics. Impact: boundary-setting move avoided. Action: C-suite approved Option A - leave in legacy location folder as tracked temporary glue; do not move or scaffold. Location-boundary design deferred into Bearings movement-origin / real-user-time MVP build. Ambiguities tracked: userLatLng origin-vs-center; searchRadiusM Field-vs-District-vs-Bearings; pseudo-centers production fallback-vs-dev scaffold.
- [2026-07-09] [Gravity-well ownership mirage] - repeated pattern across fetchPlaceEntities, geoDistance, and resolveLocation: file path and direct consumers can misrepresent ownership inside a gravity well. Responsibility, not location or consumer count, determines the home. Action: continue read-only seam checks before moving boundary-setting files.

---

## OPEN QUESTIONS SURFACED DURING RE-HOUSING
*Things the move revealed that need a decision. Move resolved ones to the PDD as decisions.*
*(append here)*

---
*Re-Housing Discovery Log · opened July 2026 · Live during re-housing execution. Decisions → PDD #108+. Formal engine docs written from this log at re-housing completion. Close this doc when the formal docs are written — it will have done its job.*
