# ID.8 MVP CLOSEOUT CHECKLIST
## June 2026 · The finish line, in order · Regression-gate everything against the green Curate path

---

## ⚠ THE ONE RULE ABOVE ALL
**ConciergeIntent Convergence happens BEFORE finishing Build.** Do not push a 9th Build patch. Threading the contract makes the anchor flow as `anchor posture: hard` — and Build's handoff resolves itself. Convergence first, Build second.

**Regression gate on EVERY change:** `npm run test:curate-green-path` + `npm run test:route-authority-shadow`. Green before and after. Nothing lands red. The proven route (Willow Court → Theatre District → Hedley) is the truth.

---

## PHASE 1 — CONCIERGEINTENT CONVERGENCE (the root fix — do first)

- [ ] **1.1 Ratify the v2 contracts** — confirm all six engine contracts (v2 Authoritative) + ConciergeIntent definition against code; confirm the canonical artifact chain (ConciergeIntent → CanonicalInterpretationBundle → ContractConstraints → ContractGateWorld + StrategyWorldSnapshot[] → canonical route → RuntimeRouteArtifact) maps in code; flag any disagreement before threading. (Ratification task spec below.)
- [ ] **1.2 Make ConciergeIntent the only mode-entry output** — one exported builder; every mode (Surprise/Curate/Build) produces a complete ConciergeIntent, all 7 fields populated
- [ ] **1.3 Add anchor/candidate/starter lineage as TYPED FIELDS** on ConciergeIntent (not side channels)
- [ ] **1.4 Collapse IntentInput/IntentProfile** — into ConciergeIntent, or make IntentProfile a derived view, never separately page-built
- [ ] **1.5 Repoint Interpretation** — produces one normalized contract; reads ConciergeIntent
- [ ] **1.6 Repoint Bearings** — reads anchor/constraint posture + persona from the contract; Family hard-gating reaches it
- [ ] **1.7 Repoint Field/Discovery** — reads normalized contract, stops re-parsing raw persona/vibe/city
- [ ] **1.8 Repoint Waypoint** — reads pacing/anchor posture from the contract
- [ ] **1.9 Repoint LCE** — reads swap tolerance/reality posture from the contract
- [ ] **1.10 Relocate App-authored truth** — every "page builds route/contract/lock" → engine/routeAuthority produces, page renders ("never UI → route")
- [ ] **1.11 Inline cleanup as you thread** — recycle misplaced, delete provably-orphaned (regression-gated), FLAG uncertain

## PHASE 2 — MODE COMPLETION (now that the contract is threaded)

- [ ] **2.1 Build live proof** — Paper Plane anchor → governed supply → card → Review → Lock → RuntimeRouteArtifact → Plans. Should resolve cleanly now that anchor flows as a contract field. Operator-confirm KV env in Preview first.
- [ ] **2.2 Surprise regression retest** — produces complete ConciergeIntent, didn't drift
- [ ] **2.3 Curate regression retest** — green path holds against the contract
- [ ] **2.4 Family/Lively + Family/Cultured** — confirm resolvable now that persona hard-gating reaches Bearings
- [ ] **2.5 Cross-mode convergence** — all three modes converge on the same RuntimeRouteArtifact post-lock

## PHASE 3 — HONEST FAILURE + GOVERNANCE

- [ ] **3.1 Operator-confirm KV ledger env** active in Preview (before any expanded live testing)
- [ ] **3.2 Build the KV ledger health endpoint** (non-provider) before expanded multi-mode live testing
- [ ] **3.3 Honest failure states** across all three modes — no fake cards, no stale leaks, clean no-card
- [ ] **3.4 Provider envelope holds** across all modes — 3/3/1, browser silent everywhere

## PHASE 4 — UX / DEMO POLISH (safe now — spine + intent are clean)

- [ ] **4.1 Public copy cleanup** — no diagnostic language leaks; no-card copy; Review CTA truth
- [ ] **4.2 Preview stop-name render gap** — verify closed
- [ ] **4.3 Demo-safe starter selection** — lead with starters resolving to dense, proven families
- [ ] **4.4 Home/start entry clarity** + failure recovery copy

## PHASE 5 — FINAL HOUSEKEEPING SWEEP (before MVP-done)

- [ ] **5.1 Resolve all FLAGGED code** from inline cleanup — delete confirmed-dead (regression-gated), keep confirmed-needed
- [ ] **5.2 Clear the quarantine** — Legacy* wrappers (SelectedRouteArtifact, CurateRefinementEntryPayload) — delete once nothing reads them
- [ ] **5.3 Confirm clean codebase** — no orphaned code, no dead side channels, every file serves a contract
- [ ] **5.4 Doc reconciliation** — PRD + Bible updated to the v2 canonical artifact model (post-#88: SelectedRouteArtifact legacy/quarantined; ConciergeIntent threaded; CanonicalInterpretationBundle/ContractGateWorld/StrategyWorldSnapshot[] as canonical)

## PHASE 6 — DEMO READINESS PACKAGE (the close)

- [ ] **6.1 Demo script + exact test path**
- [ ] **6.2 Env posture + provider budget confirmed** — Preview-only, no Production touch
- [ ] **6.3 "What this proves" narrative**
- [ ] **6.4 Chrome walkthrough passes** → **MVP COMPLETE**

---

## MVP-DONE DEFINITION (all three must be true)
1. ✅ All six engines fire live through governed boundary
2. ✅ Every PRD requirement met (all three modes, full Home→Live→Plans flow, honest failures)
3. ✅ Each engine extraction-READY (clean contract boundaries, liftable — Version A)

---

# INSTRUCTIONS FOR CODEX

**Your role:** code-truth execution + audit. You implement against the contracts and report code-reality.

1. **Read first (in this order):** the **Engine Contracts v2 Authoritative** doc (THIS supersedes the v1 handoff — use the v2 artifact model: CanonicalInterpretationBundle, ExperienceContract, ContractConstraints, ContractGateWorld, StrategyWorldSnapshot[], RuntimeRouteArtifact), the ConciergeIntent Definition, the one-pager (all in repo docs).
2. **Phase 1 is your main work.** Thread ConciergeIntent through the pipeline per the v2 contracts' per-engine GAP notes. Each engine reads its defined input contract, not raw input. Follow the canonical Codex Rules (1–10) and the House-Cleaning Order in the v2 doc.
3. **Regression-gate every change** — `test:curate-green-path` + `test:route-authority-shadow` green before/after. Report any red immediately; do not land it.
4. **Inline cleanup rules:** recycle misplaced into the right seam; delete only provably-orphaned with green path passing; FLAG uncertain (mark `Legacy*`, don't delete). Never improve what works.
5. **Report as milestones, not patch streams** — "Interpretation threaded, green, here's what I cleaned" — one report per engine, not per commit.
6. **Loop-breaker:** if you hit 3 patches on one seam, STOP and surface the architecture question. Do not write the 4th.
7. **Provider valve stays closed** — no live calls during convergence. 3/3/1 only when explicitly gated.
8. **Cite file/line + commit** in every report. Status from code-truth, not memory.

# INSTRUCTIONS FOR BUILD TEAM (Coordination layer)

1. **Hold the sequence:** Convergence (Phase 1) before Build (Phase 2). Do not let urgency on Build trigger a 9th patch — the convergence makes Build resolve.
2. **One milestone at a time** — thread one engine, prove it green, report, then the next. Interpretation first (everything depends on normalized intent).
3. **Confirm against the record** — status from the PDD decision log + commits, not impressions.
4. **The contracts are the inspection standard** — code that serves no contract is orphaned. Use that to drive cleanup decisions.
5. **Escalate to C-suite (next session) for:** any irreversible decision, provider valve activation, artifact-shape change, or a seam hitting the 3-patch loop-breaker.
6. **Cleanup discipline:** clean as you thread (only what you touch), flag the rest, final sweep before done. Nothing deleted without a contract proving it dead + green regression.

---

# RATIFICATION TASK (Step 1.1) — the verified starting point
## Read-only. No patches. Confirm the v2 contracts against code BEFORE threading begins.

**Purpose:** the v2 contracts are built on the canonical architecture doc + the Codex product audit. Before threading, confirm each contract matches code reality, so threading starts from a verified baseline — not an assumption. This is the same audit-cross discipline that's worked all along: contract = the target, code = the reality, the gap = the work.

**For each of the 7 canonical artifacts, confirm in code (cite file/line) — EXISTS / PARTIAL / ABSENT:**
1. **ConciergeIntent** — exists at `intent.ts:117`? All 7 fields present? Confirm it's orphaned (built but pipeline runs on IntentInput/IntentProfile).
2. **CanonicalInterpretationBundle** — confirm `buildCanonicalInterpretationBundle.ts` exists; does it contain intent + ExperienceContract + taste + district meaning?
3. **ExperienceContract** — exists as a distinct artifact? Where built?
4. **ContractConstraints** — exists as the Interpretation→Bearings boundary artifact?
5. **ContractGateWorld** — exists (`buildContractGateWorld.ts`)? Is it the single admitted-world artifact, or still scattered?
6. **StrategyWorldSnapshot[]** — does Bearings emit multiple strategy-worlds, or one? (If one, that's a gap from canonical.)
7. **RuntimeRouteArtifact** — confirmed canonical post-lock (we know this is solid from entry #92).

**For each engine, confirm the ownership boundary holds (or flag the violation):**
- Interpretation: is the CanonicalInterpretationBundle builder the ONLY contract builder, or are there duplicates (incl. page-built)?
- Bearings: is admissibility consolidated in ContractGateWorld, or smeared across modules?
- Waypoint: does it consume admitted worlds, or compensate for weak upstream filtering?
- LCE: does it consume the canonical route, or app-side reconstructions? Confirm the no-governing-policy gap.
- App: enumerate every place the page authors canonical truth (the "never UI → route" violations).

**Confirm the structural facts:**
- Interpretation's lenses: do Taste and District Intelligence (incl. Hyperlocal) exist as identifiable sub-modules?
- Modes (Surprise/Curate/Build): confirm they're in the Application Layer producing intent, not building engine truth.
- SelectedRouteArtifact: confirm it's quarantined/legacy (post-#88), not still canonical.

**Return:** a CONFIRMED / PARTIAL / ABSENT table per artifact + per engine boundary, the list of disagreements between v2 contracts and code, and a one-paragraph verdict — are the v2 contracts accurate to code, and what's the smallest correction set before threading Interpretation. **Do not patch — this verifies the baseline. Threading starts after ratification clears.**

---
*MVP Closeout Checklist · June 2026 · Convergence first, Build second, regression-gate everything, clean as you thread, sweep before done. The path is clear.*
