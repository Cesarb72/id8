# ID.8 / ARC — RE-HOUSING EXECUTION SEQUENCE
## The order to do the moves · companion to the Re-Housing Worklist
### Answers "where do we start" — a dependency-ordered path so we don't grab an entangled move first.

> **Why this exists:** the worklist is organized by engine (what moves where). This is organized by *order* (what moves first). Re-housing has real dependencies — some moves must happen before others, and starting with the wrong (entangled) move leads to frustration and micro-surgery. This sequences the work so each phase is as clean as possible and sets up the next.
>
> **The principle:** move the *cleanest, most foundational* things first (they validate the boundaries cheaply), then the entangled things (now easier because their neighbors are already home), then the genuine builds (now that the homes are clean). Establish homes before filling them.

---

## PHASE 0 — CONFIRM THE GROUND (before any move)
*Read-only. No code changes. Establishes the baseline so moves can be verified against it.*
- Confirm the regression gate exists and passes green (the "green path" test). Every move gets verified against this.
- Confirm HEAD, branch, clean worktree.
- Read the End-State Map and the Worklist. This is the target.
- **Exit criteria:** green baseline confirmed, target understood.

---

## PHASE 1 — ESTABLISH THE CLEAN HOMES (foundational, low-entanglement)
*Do the moves that DEFINE a boundary before the moves that FILL it. These are mostly clean relocations that validate the map cheaply.*

**1a. Confirm and protect the clean kernels (KEEP — no move, just fence them).**
Waypoint `core.ts`, Bearings `ContractGateWorld`, Field proxy, App lifecycle+authority are already correctly housed. Mark them as protected boundaries. Any later move must not contaminate them.

**1b. Fold Hyperlocal into District, establish District as an Interpretation sub-engine (structure only).**
Before dissolving the gravity wells, establish where their contents will land. Define the Interpretation sub-engine homes (Taste, District, Direction) as real boundaries so there's somewhere clean to move things INTO.
- **Exit criteria:** the target homes exist as real, named boundaries.

---

## PHASE 2 — DISSOLVE GRAVITY WELL 2 (`src/engines/district/`)
*Do this well first — it's smaller and more clearly separable than `arc/`, so it's the better warm-up and it feeds Phase 3.*
- `fetchPlaceEntities.ts` → Field (retrieval)
- `buildDistrictOpportunityProfiles.ts` → Interpretation/District sub-engine
- `computeTasteLite.ts` → Taste (the TODO already says to)
- `computeBearingsLite.ts` → Bearings
- geo/pocket/viability → split (Field raw-world / Bearings viability / Interpretation structural)
- **Exit criteria:** `engines/district/` dissolved; its pieces home. Regression green.
- **Why before `arc/`:** District's contents partly feed the `arc/` scoring; having them home first makes the `arc/` split cleaner.

---

## PHASE 3 — DISSOLVE GRAVITY WELL 1 (`src/domain/arc/`)
*The big one. Do it in sub-steps, not all at once. Each sub-step is a MOVE + regression-gate + log.*
- **3a. Meaning → Interpretation/Taste:** `scoreArcAssembly.ts` moment-strength (the Adega root), romantic/family/category/vibe scoring, anchor-match recognition.
- **3b. Feasibility → Bearings:** movement/geography/duration portions of `scoreArcAssembly.ts`, `isValidArcCombination.ts` geography, `assembleArcCandidates.ts` spatial invalidation, `buildRolePools.ts` movement rejects.
- **3c. Sequencing → Waypoint:** `assembleArcCandidates.ts` shape assembly (warmup/peak/cooldown), pacing/transition portions.
- **3d. Direction System → Interpretation:** `directionPlanning.ts` (DirectionPlanningSelection), extract its hospitality tuning back to Taste (keep Direction thin).
- **Exit criteria:** `arc/` dissolved; meaning in Interpretation, feasibility in Bearings, sequencing in Waypoint. Regression green.
- **Note:** 3a first — it's the Adega root and the highest-value move. Expect the biggest discoveries here; log carefully.

---

## PHASE 4 — RECLAIM THE SCATTERED ENGINE JOBS
*Now that the gravity wells are gone, mop up the remaining misplaced pieces per the worklist.*
- **Field:** consolidate scattered retrieval (`sources/`, `retrieval/`, Build's separate path) behind one Field boundary.
- **Bearings:** pull candidate admission (`buildCandidateAdmissionService`), hours inference/demotion, retrieval distance-admission into Bearings.
- **LCE:** pull swap orchestration and page-local patching into LCE; route live signals through LCE governance.
- **Application:** stop shadow-engine behavior — remove local preview scoring, fallback rationale, candidate projection; render engine payload instead.
- **ConciergeIntent:** move intent-posture authoring from the app adapter → Interpretation (app becomes dumb collector).
- **Exit criteria:** each engine owns its job; no engine does another's. Regression green.

---

## PHASE 5 — THE 7 MVP-CRITICAL BUILDS
*Now the homes are clean, build the genuinely-missing pieces INTO their correct homes.*
Order by dependency:
1. **Consolidated Field boundary + query planner** (Field) — foundational; others read from it.
2. **Real user time capture + precise movement origin** (Bearings + intent + app) — the input-starvation fix; enables real feasibility.
3. **Anchor-as-peak / moment-strength authoring** (Interpretation/Taste) — the Adega root; now has a clean Taste home to live in.
4. **Experience-level composition contract** (Interpretation) — composition authored where it belongs.
5. **Great Stop stamp-and-aggregate** (all engines stamp, Waypoint aggregates) — now that each engine owns its criterion cleanly.
6. **Steering-before-lock wired to engines** (Application) — chips re-drive engines instead of local re-ranking.
- **Exit criteria:** the 7 MVP-critical builds done, in their right homes. Regression green. THIN cells re-run and pass real Great Stop.

---

## PHASE 6 — CLEANUP + FORMALIZE
- Delete the Phase 5 cruft list (Paper Plane static path, selectedRouteArtifact, lceRepair, postPlannerCommitParity, dev fixtures, legacy ranking).
- **THEN formalize the engine docs** — one canonical technical doc per engine, written from the Discovery Log + re-housed reality. The moat made legible.
- **Exit criteria:** cruft gone, formal engine docs written from reality, MVP complete.

---

## RULES THAT APPLY TO EVERY PHASE
- **Regression-gate every move** — green before and after. Nothing lands red.
- **Log every discovery** to `ID8_ReHousing_Discovery_Log.md` as you go.
- **One move at a time** — don't batch moves across engine boundaries; each move should be independently verifiable.
- **Holistic before surgical** — if a move surfaces a bug, check the architecture/seam/portability before patching (see Build Agent instructions).
- **Surface, don't improvise** — a move that grows, a boundary that's ambiguous, or a third patch on one seam → stop and escalate to the C-suite chat for a PDD decision.
- **Deferred by design:** LCE governing policy is NOT in these phases — it's decided post-re-housing, from evidence, once the pipeline is settled and observable. Field live-sensing and LCE-fed-by-live-conditions are post-MVP.

---
*Re-Housing Execution Sequence · companion to ID8_ReHousing_Worklist.md · Establish clean homes → dissolve the gravity wells (district first, then arc) → reclaim scattered jobs → build the 7 MVP-critical pieces → cleanup + formalize. Cleanest/most-foundational first, entangled next, builds last. Regression-gate and log every move.*
