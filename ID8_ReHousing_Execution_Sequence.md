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

## CURRENT IDENTITY PROGRAM STATUS - 2026-07-28
*This section reconciles the original broad re-housing sequence with the accepted A1/A2/A4 identity program. It does not mark the historical re-housing program complete.*

### Completed Identity Work
- **Stage 0 - evidence preservation:** complete. The governed 96-row provider corpus source is durably preserved; corpus SHA-256 remains `9fa6fafbc1fdaf11859bcce709722417760c25f290ed1e84897993f14525f65f`.
- **Stage 1 - Interpretation venue identity resolution:** complete and accepted. Interpretation owns deterministic venue-identity resolution; venue identity remains separate from direction identity.
- **Stage 2A - Field to Interpretation handoff:** complete and accepted. Field constructs source/provenance evidence and hands it to Interpretation without authoring canonical identity.
- **Stage 2B - Bearings admission seam:** complete and accepted. Bearings owns route admission and identity preservation through admission.
- **Stage 1/Stage 2B corpus-gate traceability:** verified at HEAD `03a5085` through the existing offline admission proof. The preserved corpus has 96 observations; rows `2`, `7`, `42`, and `64` converge to static canonicals and are excluded from the 92-observation provider-only denominator. Result: `82/92` provider-only observations are route-eligible through Bearings admission, `77` unique route-bearing provider-only identities are emitted, and `10/92` remain diagnostic-only pending (`coordinate_only:3`, `multi_venue_address_without_unit_data:7`). The gate is exact-count based; no standalone percentage threshold is recorded. This proves offline architecture correctness and supply rescue for this corpus gate only, not provider/hosted behavior, A1/A2/A4 global closure, Great Stop purity, A3, malformed proof debt closure, or MVP green.
- **Stage 2C - Build provider supply through admitted identity:** complete, accepted, committed at `09ca966` (`Wire Build provider supply through admitted venue identity`), and accounting-closed. The accepted accounting is `243 + 533 + 179 = 955` Git-counted insertions; the earlier physical-line estimate omitted 44 blank lines. Provider calls: 0. Hosted/Vercel calls: 0.
- **Stage 2D - Build anchor/provider ingress identity rewire:** complete, accepted, and committed at `2102be1` (`Close Stage 2D Build anchor identity ingress`). Direct Build anchor/provider ingress now materializes selectable `Venue` only after Field -> Interpretation -> Bearings identity/admission; diagnostic-only results retain evidence and cannot be selected.
- **Stage 2E-1 - retrieval merge/dedupe identity preservation:** complete, accepted, and committed at `6bcbf4e` (`Preserve admitted identity through retrieval`). Retrieval consumes admitted canonical `Venue.id`; only equal admitted identities collapse; distinct admitted identities remain distinct; provider provenance and similarity heuristics cannot author route identity; required inventory resolves only through admitted canonical identity.
- **Stage 2E-2 - scoring candidate-identity preservation:** complete, accepted, and committed at `99f9bed` (`Preserve moment venue identity through scoring`). Scoring preserves admitted `Venue.id`; base, Moment, and activation wrappers may carry distinct `candidateId` values while sharing one physical `baseVenueId`; unparented or unresolved-parent Moments remain preserved supply but are excluded from selectable MVP candidates.
- **Stage 2E global closure:** closed through retrieval, dedupe, and scoring. No Stage 2E path may mint, re-resolve, repair, or substitute physical identity.

### Remaining Stage 2 Packets
1. **Stage 2F-1 - Waypoint/Arc candidate-materialization identity parity** *(immediate next gate: closed-valve characterization proof; production implementation not authorized).* Boundary: begins when `ScoredVenue` enters role pools and Arc candidate assembly; ends before Application projection or protected artifact/route-authority creation. Candidate identity is for wrapper competition/order/equality/diagnostics; physical identity is for duplicate prevention, physical exclusion, and required-stop preservation; raw `candidate.venue.id` must not be assigned a universal meaning without characterization.
2. **Stage 2F-2 - Application and product-mode materialization identity parity** *(held).* Scope: `AppShell`, Curate product materialization, public-card/seed bridges, sandbox/demo/debug product projection. Purpose: ensure Application consumes resolved/admitted engine truth and does not repair, synthesize, substitute, or promote provider identity.
3. **Stage 2G - LCE/live nearby identity quarantine decision** *(held; distinct live/runtime seam).* Scope: nearby replacement, swap, live-session, and LCE consumers. Purpose: decide whether live/provider observations can become lock-bearing during runtime change, then rewire through the accepted seam or quarantine as diagnostic-only.

### Held / Protected Work
- **Stage 3 - corpus regeneration/promotion:** held. The corpus must be regenerated from the preserved 96-row source with Interpretation-resolved identity and pending states; no shrink, deletion, or silent rebaseline is accepted.
- **A3 - routeAuthority / Review / Lock identity authority:** fenced from Stage 2D-2G. `routeAuthority`, `RuntimeRouteArtifact`, `ContractEntryArtifact`, and Review/Lock consumers require a separate protected packet.
- **Stage 2F-1 characterization matrix:** base only; base + Moment same base; base + activation same base; base + Moment + activation same base; presentation-similar distinct bases; required Build anchor as wrapper; required Build anchor as base; same physical venue across multiple role pools; distinct wrappers competing for different roles; provider/source provenance present; reversed input order; Build/Curate/Surprise shared-path parity.
- **Potential Stage 2F-1 correction areas:** same-base wrapper support exclusion, required-anchor preservation by physical identity, fallback support selection, baseline rehydration, targeted refinement identity accounting, and diagnostics exposing both candidate and physical identity honestly. These are not implementation-authorized until characterization establishes current behavior.
- **Great Stop purity:** remains a current MVP-green condition. Do not claim MVP green until the Great Stop standing condition is satisfied and proven.
- **Malformed Phase 2 fake ArcCandidate proof:** remains explicit baseline proof debt and is not green.
- **MVP status:** A1/A2/A4 are not globally passed yet; MVP green remains unclaimed.

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
