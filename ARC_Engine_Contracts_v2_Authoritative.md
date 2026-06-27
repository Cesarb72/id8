# ARC ENGINE CONTRACTS — v2 AUTHORITATIVE
## Version A · June 2026 · For build team + Codex
### Built on the canonical Arc Architecture & Codex Rules doc, reconciled to current state (post-#88 spine collapse, ConciergeIntent-threaded, basics-first)

> **Supersedes the rushed v1.** This version adopts the canonical artifact model (CanonicalInterpretationBundle, ExperienceContract, ContractConstraints, ContractGateWorld, StrategyAdmissibleWorld[]), the correct engine sub-structure (Interpretation's lenses), the confirmed LCE definition, and the canonical Codex Rules. Five-section template per engine. Version A = kernel as ID.8 exercises it, portably shaped, NOT full capacity.

---

## THE CORE PRINCIPLE (canonical, verbatim)

**Arc = Ask → Meaning → Admissibility → Coordination → Runtime Continuity → Exposure**

The user asks → the system interprets what it means → determines what reality is valid → coordinates the best sequence from that valid world → keeps it aligned as reality changes → the app exposes that truth clearly.

> *"The application is not the system. The engines are the system. If any layer starts doing another layer's job, drift and regressions appear."*

**Memory phrase:** Ask → Promise → Allowed World → Shape → Live Path → Exposure

---

## THE CANONICAL ARTIFACT CHAIN (reconciled to post-#88)

```
ConciergeIntent            (the Ask, normalized — produced by every mode, MVP-critical)
   ↓
CanonicalInterpretationBundle   (Interpretation's output — contains intent + meaning)
   ├─ ExperienceContract        (the Promise — what kind of night)
   ├─ Taste meaning             (hospitality lens)
   └─ District/Hyperlocal meaning (spatial lens)
   ↓
ContractConstraints        (Interpretation→Bearings boundary artifact)
   ↓
ContractGateWorld          (the Allowed World — Bearings)
StrategyAdmissibleWorld[]    (one admissible world per strategy — Bearings; this is the confirmed CODE name, ratified June 2026 — replaces the earlier "StrategyWorldSnapshot[]" draft name)
   ↓
[canonical route]          (the Shape — Waypoint; SelectedRouteArtifact now legacy/quarantined per #88)
   ↓
RuntimeRouteArtifact       (the Live Path — LCE)
   ↓
rendered surfaces          (Exposure — App)
```

**#88 reconciliation:** SelectedRouteArtifact was the canonical Waypoint output in the original architecture doc; entry #88 collapsed the spine and Cluster 1 quarantined it as a legacy compatibility wrapper. Waypoint's canonical route output now flows toward RuntimeRouteArtifact. The *ownership* (Waypoint owns the sequence) is unchanged; the *packaging* collapsed.

---

## 1. INTERPRETATION ENGINE (parent + two lenses)

**1. JOB**
Turn signals into meaning. Sole owner of: what the request means, what each place means for it, the system's promise. **Structured as a parent engine with two lenses:**
- **Taste Engine (First Lens — Hospitality):** interprets venues for experiences (vibe → cuisine → energy → arc → social density). *This is the hospitality context — the lens that makes ARC specifically a concierge. It SWAPS per vertical* (a civic ARC has a different first lens). The vertical-specific part of Interpretation.
- **District Intelligence (Second Lens — Spatial):** interprets locations for opportunity + movement (density → mix → momentum; cluster → flow → boundary; activity layering, access patterns). Feeds location meaning into Interpretation.
  - **Hyperlocal (within District Intelligence):** the person→place/venue connection — the finest-grain layer connecting a specific person to a specific place. Important to BOTH ID.8 product strategy AND Arc as a system. Preserve this; significant work was done here.

**2. INPUT CONTRACT — ConciergeIntent**
- **Name:** ConciergeIntent — the normalized "what the user is trying to do" (the basics). Seven fields: intent mode, objective, control posture, experience profile {persona, vibe, pacing}, anchor posture, constraint posture, reality posture.
- **Producer:** the mode's thin entry adapter (Surprise/Curate/Build) produces it; Interpretation consumes it. Interpretation is mode-AGNOSTIC — it never knows "Surprise" vs "Build," it just receives intent.
- **Invariant:** every field always populated; raw UI consumed only at Step 1; an unpopulated field is a bug.
- **⚠ GAP (audit):** ConciergeIntent exists (`intent.ts:117`) but is orphaned; pipeline runs on raw-built IntentInput/IntentProfile; page builds IntentInput from UI (`SandboxConciergePage.tsx:14396`). FIX: ConciergeIntent is the only mode-entry output.

**3. OUTPUT CONTRACT — CanonicalInterpretationBundle**
- **Name:** CanonicalInterpretationBundle — contains normalized intent + ExperienceContract + strategy meaning + taste meaning + district/hyperlocal meaning
- **Sub-artifact: ExperienceContract** — "the system's promise": coordination mode, act structure, highlight model, movement style, social posture, pacing
- **Consumers:** Bearings (constrains it), Waypoint (sequences from it), App (renders rationale)
- **Ownership:** Interpretation is sole writer. One canonical builder (`buildCanonicalInterpretationBundle.ts` exists — confirmed by audit).
- **★ MVP vs POST-MVP scope:** **MVP** = the basic bundle (intent + meaning + promise, no personalization — "a stranger gets a great night"). **POST-MVP** = the bundle grows into the GUEST PROFILE ("you're a regular, we know you") — personalization across visits. The guest-profile layer and the ArcTraceBundle learning loop are ONE post-MVP body of work, activating at beta with multiple users. **Sequencing: ConciergeIntent (the basics) first → CanonicalInterpretationBundle-as-profile later.**

**4. INVARIANTS**
- Never owns structural admissibility (Bearings), route sequencing (Waypoint), or runtime mutation (LCE).
- Never reads raw UI past Step 1.
- Family persona is a contract-shaping flag (sets "hard logistical gating required" for Bearings), not a label. ⚠ GAP: Family special-cased but not as one early hard gate.

**5. LEARNING & FEEDBACK** *(interface only — placeholder/coming-soon, activates at beta)*
- Learns intent→meaning patterns; the Taste lens learns hospitality patterns, District Intelligence learns spatial/movement patterns.
- ArcTraceBundle breadcrumbs — **define the shape, do NOT build trace-writing now; stub it "coming soon."**
- Port-out: the meaning kernel ports; the Taste lens is replaced per vertical.

---

## 2. BEARINGS ENGINE

**1. JOB**
Apply real-world constraints and admissibility. Sole owner of: what reality is actually allowed — hours, distance, movement tolerance, required-stop survival, fallback discipline.

**2. INPUT CONTRACT — ContractConstraints**
- **Name:** ContractConstraints (the Interpretation→Bearings boundary artifact): peak count, continuity/escalation, movement tolerance, wind-down strictness, recovery windows, highlight pressure, social density band + ConciergeIntent fields read directly: anchor posture, constraint posture, persona (esp. Family)
- **Producer:** Interpretation (the boundary artifact)
- **⚠ GAP (audit):** Bearings reads contract-adjacent data, not one shared contract (`buildContractGateWorld.ts:1861`). FIX: read from ContractConstraints + normalized intent.

**3. OUTPUT CONTRACT — ContractGateWorld + StrategyAdmissibleWorld[]**
- **ContractGateWorld** — the admitted/suppressed/rejected world with reason codes. The first canonical *allowed reality* artifact.
- **StrategyAdmissibleWorld[]** — one admissible world per strategy (anchored pulse, contained pulse, exploratory pulse). **How one contract yields multiple valid interpretations** — Waypoint picks among these.
- **BearingsDecisionLog** — decisions + reason codes
- **Consumers:** Waypoint (sequences within the admitted worlds)
- **Invariant:** required stops carry role + survival guarantee through dedupe/pruning/scoring
- **Ownership:** Bearings is sole writer. ⚠ GAP: admissibility still scattered ("needs ContractGateWorld extraction" — the consolidation target).

**4. INVARIANTS**
- Never silently rescues a weak plan — honest failure over fake admission.
- Never owns user meaning (Interpretation) or route ranking itself (Waypoint).
- Required stops non-negotiable — the anchor MUST survive. Failure: "anchor dropped from final arc."
- Build-mode geography is SOFT penalty, not hard blocker (required-anchor arcs tolerate cross-pocket). Curate's hard geography gate must NOT be inherited by Build.

**5. LEARNING & FEEDBACK** *(interface only — placeholder)*
- Learns what's actually admissible in practice. ArcTraceBundle shape defined, not built.
- Port-out: the admissibility kernel ports to any constrained domain (Stock & Flow inventory).

---

## 3. FIELD ENGINE

**1. JOB**
Detect current reality. Sole owner of: the raw venue universe, place/entity retrieval, **district/pocket formation**, geometry, density, spread, raw viability sensing. *What exists? What is true in the environment right now?*

**2. INPUT CONTRACT**
- **Name:** the constrained intent (experience profile + objective + reality posture from ConciergeIntent) within ContractGateWorld's admitted bounds
- **Producer:** Interpretation (intent) + Bearings (admitted bounds)
- **⚠ GAP (audit):** candidate board re-parses raw persona/vibe/city (`stopTypeCandidateBoard.ts:2015`). FIX: read normalized contract, don't re-parse raw.

**3. OUTPUT CONTRACT — the grounded venue universe**
- Raw pockets, raw venue sets, field metrics, density/spread signatures
- **Consumers:** Bearings (admits within), Waypoint (sequences), Interpretation's District Intelligence lens (interprets the pockets Field forms)
- **Invariant:** every venue real, open, accurately located — no demo ghosts, no cached-closed venues
- **Ownership:** Field is sole writer of the raw venue universe + pocket formation

**4. INVARIANTS**
- Never owns user intent, experiential meaning, route sequencing, or UI explanation.
- Never makes live provider calls outside the governed boundary (the $817 rule).
- **Note the boundary:** Field FORMS pockets (geometry/density); Interpretation's District Intelligence lens INTERPRETS them (meaning/movement). Live venues must run THROUGH pocket formation, not bolt on after (scattered-route root cause).

**5. LEARNING & FEEDBACK** *(interface only — placeholder)*
- Learns supply-quality patterns. Port-out: detection kernel ports to any real-world-sensing domain (@local events).
- *Version A: Field is intentionally Stage 1-2 (Seedling) in ID.8; full sensing matures in @local.*

---

## 4. WAYPOINT ENGINE

**1. JOB**
Coordinate the sequence. Sole owner of: role sequencing, start/highlight/wind-down coordination, route assembly, act execution, route ranking. *What is the best sequence from the already-admissible ingredients?*

**2. INPUT CONTRACT**
- **Name:** StrategyAdmissibleWorld[] (admitted worlds from Bearings) + CanonicalInterpretationBundle (meaning) + ConciergeIntent fields: pacing, anchor posture, objective
- **Producer:** Bearings (admitted worlds) + Interpretation (meaning) + Field (grounded venues)
- **⚠ GAP (audit):** reads IntentProfile, not the normalized contract (`rankArcCandidates.ts:11`). FIX: read pacing/anchor posture from the contract.

**3. OUTPUT CONTRACT — the canonical route**
- The selected route, selected strategy, route shape, stop sequence — canonical route truth for preview/story/journey
- *(Was SelectedRouteArtifact; post-#88 this is reconciled — Waypoint's route output flows toward RuntimeRouteArtifact; SelectedRouteArtifact is legacy/quarantined)*
- **Consumers:** App (renders), LCE (preserves at runtime)
- **Invariant:** arc builds → peaks → winds down; required stops in their roles
- **Ownership:** Waypoint is sole writer of the route shape

**4. INVARIANTS**
- Never owns raw retrieval, user meaning, or admissibility truth.
- Never decides what the night means — doesn't know what "romantic" means, and that's the point.
- Builds AROUND required stops, never drops them.
- Stop compensating for weak upstream filtering (cleanup priority) — if candidate worlds are still shared/unfiltered, Bearings isn't constraining early enough.
- **Certified phase-v-portable — the cleanest kernel; its boundaries are the model for the others. Extracts FIRST, after MVP.**

**5. LEARNING & FEEDBACK** *(interface only — placeholder)*
- Learns sequencing/pacing patterns. Port-out: "extraction is a configuration, not a rebuild."

---

## 5. LCE — LATENCY CAPACITY ENGINE

**1. JOB**
Keep the sequence aligned as reality changes. Sole owner of: swap proposals, runtime repair, mutation handling, route preservation during change. *How do we preserve route truth as the world moves?*

**★ DUAL-VERTICAL EXPRESSION (the portability thesis, in one engine):** LCE is ONE engine with ONE kernel function — "keep the sequence aligned as reality changes" — that surfaces differently per vertical:
- **In ID.8 (concierge):** keeps the NIGHT'S ROUTE aligned as venues close, timing slips, the user changes things. The Live Co-Pilot / RuntimeRouteArtifact — **the centerpiece of the live app.** Engine 5 of 5, the runtime layer.
- **In ABCD (civic):** the same alignment function activates as its "latent capacity" dimension — connecting unused community resources (Detect→Reveal→Connect→Activate→Measure). *Same kernel, different vertical surface.*

**2. INPUT CONTRACT**
- **Name:** the canonical route (from Waypoint) + runtime reality + ConciergeIntent fields: swap tolerance, reality posture
- **Producer:** Waypoint (route) + Field (runtime reality)
- **⚠ GAP (audit):** reads IntentProfile/runtime state, not the contract (`lceRepair.ts:33`). FIX: read swap tolerance/reality posture from the contract.

**3. OUTPUT CONTRACT — RuntimeRouteArtifact**
- The live-adjusted route, swap lineage, preservation state, runtime continuity truth
- **Consumers:** App (Live Journey, Plans), all post-lock surfaces
- **Invariant:** single source of truth post-lock; never silently changed — **LCE Trust Contract: "detects → alerts → previews → waits for user choice"**
- **Ownership:** LCE is sole writer post-lock

**4. INVARIANTS**
- Never rebuilds plans from scratch — preserves them.
- Never owns original contract build, original admissible world, or original route meaning.
- Never reinterprets intent.
- **⚠ KNOWN GAP (documented):** LCE is live in ID.8 but operating WITHOUT a governing policy — no intervention threshold defined, and "the boundary between runtime correction and route regeneration is not enforced — LCE can blur into Waypoint." This is P2/post-MVP work (the same Field→LCE seam from entry #91). The contract names it as the invariant-at-risk.

**5. LEARNING & FEEDBACK** *(interface only — placeholder)*
- Learns which adaptations preserved the experience. Port-out: preservation kernel ports (ABCD names LCE as its first deployment — where the latent-capacity dimension activates).

---

## 6. APPLICATION LAYER (ID.8 — the lens, not the kernel)

**1. JOB**
Expose engine truth clearly. Sole owner of: intake UI, direction cards, preview/story/journey surfaces, controls, debug viewers. *How do users see and interact with engine truth?*

**★ THE MODES LIVE HERE.** Surprise / Curate / Build are **ID.8-specific entry strategies** — they belong to the Application Layer, NOT the Arc kernel. Each is a thin adapter that produces a ConciergeIntent. A different vertical (civic, events) would have entirely different entry strategies. **Modes are product; ConciergeIntent is the contract; the engines are the kernel.** This is the cleanest statement of the portability seam: ARC doesn't have "Surprise mode" — *ID.8* does.

**2. INPUT CONTRACT**
- **Name:** every engine's canonical output — CanonicalInterpretationBundle, ContractGateWorld, the route, RuntimeRouteArtifact + ConciergeIntent fields: control posture, intent mode
- **Producer:** all engines
- **⚠ GAP (audit):** the page builds route shape contracts, final routes, canonical artifacts, lock payloads (`SandboxConciergePage.tsx:14254`+) — it AUTHORS truth. Biggest "never UI → route" violation. FIX: relocate all truth-authoring into engines/seams; page orchestrates + renders only.

**3. OUTPUT CONTRACT — rendered surfaces**
- Cards, Preview, Journey, Share, Calendar, Plans Hub — the same truth, surfaced consistently
- **Ownership:** the app writes NOTHING canonical — render-only

**4. INVARIANTS**
- Never authors canonical contracts, constraints, admissibility, strategy truth, or route identity.
- Never invents stop logic or acts as a shadow engine. "Never UI → route."
- The modes produce ConciergeIntent via thin adapters; they never build engine truth.
- May: pass user inputs, render engine outputs, trigger actions. May not: rebuild contracts, rebuild admissibility, patch route identity after the fact.

**5. LEARNING & FEEDBACK**
- The render layer is vertical-SPECIFIC — each vertical builds its own; only the engine-consumption pattern ports. The App Layer is the ID.8 lens itself; its learning is product-specific, not a portable kernel.

---

## THE CODEX RULES (canonical — apply to all implementation)

1. **Ownership first** — before writing code, name which engine owns the job, what artifact it produces/consumes, whether the app is currently doing it wrong. Call it out before large changes.
2. **No app-first engine logic** — no canonical truth in page files / components / UI helpers unless a temporary bridge, explicitly marked.
3. **Parent folder rule** — code lives under the engine it belongs to (contract builders → Interpretation; gate → Bearings; route assembly → Waypoint; swap/repair → LCE).
4. **No duplicate canonical builders** — one builder per artifact. Multiple = drift, call it out.
5. **Extract, then consume** — extract the canonical artifact into the right engine, make downstream consume it, remove duplicates. Don't keep both paths alive.
6. **No surface patching before ownership audit** — if it looks wrong, find whether the wrong engine owns the logic before tuning copy/labels.
7. **Debug by engine** — debug panels grouped by engine output, not variable dumps.
8. **Strategy is not cosmetic** — strategy labels must reflect real differentiated worlds.
9. **Contract must constrain reality before coordination** — if shared candidate worlds survive into Waypoint, contract isn't constraining early enough.
10. **Do not overfit the app** — every structural fix evaluated for portability, modularity, growth beyond ID.8. Arc is bigger than ID.8.

---

## HOUSE-CLEANING ORDER (canonical — matches our convergence sequence)

1. **Interpretation extraction** — create/consume CanonicalInterpretationBundle; remove app-side contract building. *(= ConciergeIntent convergence, Interpretation first)*
2. **Bearings extraction** — create ContractGateWorld + StrategyAdmissibleWorld[]; all admissibility consumers use them.
3. **Waypoint cleanup** — consume strategy worlds, emit canonical route.
4. **LCE cleanup** — consume canonical route, emit RuntimeRouteArtifact.
5. **Application simplification** — remove duplicated derivations, render engine truth only.

---

## NON-NEGOTIABLE BUILD RULES

No app-side canonical truth. No duplicate builders. No strategy labels without differentiated worlds. No Bearings logic smeared across modules. No preview/story truth not derived from canonical route artifacts. Every fix names the engine that owns it. If ownership is unclear — stop and audit.

---
*Engine Contracts v2 Authoritative · Version A · June 2026 · Built on the canonical Arc Architecture & Codex Rules doc, reconciled to current state. ConciergeIntent (basics) is MVP; CanonicalInterpretationBundle-as-guest-profile + learning loop are post-MVP/beta. Thread Interpretation first, regression-gate against the proven green path, clean as you thread.*
