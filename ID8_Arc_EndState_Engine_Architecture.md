# ID.8 / ARC — END-STATE ENGINE ARCHITECTURE
## The re-housing target · July 2026 · What each engine owns in the finished product
### Assembled from: the one-liner reference + ConciergeIntent contract doc + Bible ownership principles + the product heart (validated against the original vision). This is the canonical map every inventory finding gets re-housed against.

> **What this is:** the definitive statement of what each engine owns in the finished ID.8 — with clean handoffs — so code can be re-housed against it and the boundaries stop eroding. This is the artifact whose *absence* let the boundaries smear. It exists now.
>
> **The governing principle (the portability test):** everything domain-specific lives in **Interpretation** (the lens); everything else is **domain-agnostic** (the invariant machine). Any code that violates this is BOTH an MVP bug AND a portability breach. Fixing the housing IS building the moat — a new vertical swaps the lens and keeps the machine.

---

## THE ONE-LINE REFERENCE (the spine)

- **Field** — Detects current reality.
- **Interpretation** — Turns signals into meaning. *(The lens. The only domain-specific engine.)*
- **Bearings** — Applies real-world constraints.
- **Waypoint** — Coordinates the sequence.
- **LCE** — Keeps the sequence aligned as reality changes.
- **Application** — Turns the stack into a usable product.

---

## THE PIPELINE (Interpretation-first, two-pass)

```
raw user input (captured ONCE at Step 1)
        ↓
┌─────────────────────────────────────────────────────────────┐
│ INTERPRETATION — PASS 1: author the intent contract         │
│   raw input + mode entry strategy → ConciergeIntent          │
│   (the lens is applied here; domain context is set)          │
└─────────────────────────────────────────────────────────────┘
        ↓  ConciergeIntent (input contract — every engine reads this, never raw UI)
┌─────────────────────────────────────────────────────────────┐
│ FIELD — sense reality against the constrained intent         │
│   reads: experience profile, objective, reality posture      │
│   → real venues/entities that exist & are reachable now      │
└─────────────────────────────────────────────────────────────┘
        ↓  real sensed world
┌─────────────────────────────────────────────────────────────┐
│ INTERPRETATION — PASS 2: give the sensed venues MEANING      │
│   Taste stamps meaning/role/moment-strength;                 │
│   District stamps spatial structure;                         │
│   Direction System narrows to N viable directions            │
└─────────────────────────────────────────────────────────────┘
        ↓  meaningful, structured candidates
┌─────────────────────────────────────────────────────────────┐
│ BEARINGS — enforce feasibility                               │
│   reads: anchor posture, constraint posture, persona         │
│   → admitted world (what's actually possible/allowed)        │
└─────────────────────────────────────────────────────────────┘
        ↓  admitted candidates
┌─────────────────────────────────────────────────────────────┐
│ WAYPOINT — sequence the arc + AGGREGATE Great Stop           │
│   reads: pacing, objective, anchor posture                   │
│   → builds ease-in→peak→wind-down                            │
│   → aggregates the 5 Great Stop verdicts → PASS/FAIL         │
│     (counts stamps, domain-blind — never reads their meaning)│
└─────────────────────────────────────────────────────────────┘
        ↓  Great Stop PASS → becomes a Recommendation
┌─────────────────────────────────────────────────────────────┐
│ APPLICATION — Lifecycle orchestration + exposure             │
│   candidate → recommendation → review → locked → live        │
│   renders truth, never authors it                            │
└─────────────────────────────────────────────────────────────┘
        ↓  LOCKED
┌─────────────────────────────────────────────────────────────┐
│ LCE — preserve the committed plan as reality changes         │
│   reads: swap tolerance, reality posture                     │
│   → adapts the locked arc without rebuilding/restarting      │
└─────────────────────────────────────────────────────────────┘
```

**Two-pass note:** Interpretation brackets Field. Pass 1 sets the lens (authors intent) *before* Field senses; Pass 2 gives meaning to what Field found *after*. This is why "Interpretation first" (the lens informs everything) and "Field detects reality" (the one-liner) both hold — Field sits *between* Interpretation's two passes.

---

## PER-ENGINE OWNERSHIP (the re-housing target)

### FIELD — detects current reality
| Owns | Must NOT own |
|---|---|
| Raw world/entity retrieval; the governed provider/API harness (querying well within 3/3/1); raw viability sensing; "what's true/active right now." | Meaning, constraints, sequencing, ranking. |
**End-state fix:** consolidate scattered retrieval (`buildProviderSourceOpportunity`, `retrieveVenues`, `fetchLivePlaces`) behind ONE Field boundary. Own hours/open-closed as "current reality" (currently leaked to Bearings). Add live "happening now" sensing (currently static-only).

### INTERPRETATION — turns signals into meaning *(THE LENS — domain-specific)*
Owns the ConciergeIntent contract (authors it), and all domain meaning. **Sub-engines:**
| Sub-engine | Owns | Portable? |
|---|---|---|
| **Taste** | Lens-specific meaning — venue personality, role suitability, **moment strength/memorability**, "what makes this romantic." | NO — the swappable slot. Each vertical fills it (concierge=hospitality, supply=perishability). |
| **District Intelligence** *(+ Hyperlocal folded in)* | Spatial structure at ALL resolutions — clusters, pockets, micro-pockets, density, stay-vs-shift. | YES — lens-agnostic, reused. Every vertical has space. |
| **Direction System** | Narrow the possibility space → N distinct viable directions (POOL→SHAPE→SELECT). Stays THIN. | YES (structure ports) — but its hospitality tuning must extract back into Taste. |
**End-state fix:** Taste must author moment-strength (the Adega failure = this missing). Fold Hyperlocal into District. Extract Direction System's hospitality tuning back into Taste — Direction asks Taste for meaning, never hardcodes it.

### BEARINGS — applies real-world constraints
| Owns | Must NOT own |
|---|---|
| Feasibility: temporal (timing/hours), movement/distance realism, constraint gating, required-stop survival. The admitted world (ContractGateWorld / StrategyAdmissibleWorlds). | Meaning, retrieval, sequencing, **quality** (feasible ≠ good — that's Great Stop). |
**End-state fix:** consolidate scattered admissibility into ONE gate. Resolve the input starvation — Bearings must actually RECEIVE time/origin (from ConciergeIntent) to enforce "doable tonight." Feasibility stays separate from quality.

### WAYPOINT — coordinates the sequence + aggregates Great Stop
| Owns | Must NOT own |
|---|---|
| Sequence correctness under constraint: sequencing, pacing, transitions, arc structure. **The Great Stop aggregation** (collects the 5 engine verdicts → one PASS/FAIL). | Meaning (never learns "romantic"); admissibility (Bearings); **the criteria themselves** (only aggregates them). |
**End-state fix:** the domain-agnostic kernel. Return the leaked meaning (moment-strength) to Taste. Aggregate Great Stop by COUNTING stamps — never computing them. Kernel stays domain-blind.

### LCE — keeps the sequence aligned as reality changes
| Owns | Must NOT own |
|---|---|
| Runtime preservation of the LOCKED plan; swap proposals; governed adaptation as reality shifts. Preserves, never rebuilds. | Generation, meaning, admissibility, sequencing. Only operates AFTER lock. |
**End-state fix:** needs a governing policy (Signal→Impact→Action framework) — currently ungoverned. Must be fed real changing conditions (from Field) — currently proven only on seeded data.

### APPLICATION — turns the stack into a usable product
| Owns | Must NOT own |
|---|---|
| Rendering; interaction; flow progression; user steering (swap/adjust before lock); **the Route Lifecycle** (state orchestration: candidate→recommendation→review→locked→live). | Authoring ANY truth — no routes, contracts, sequences, meaning, or quality judgments. Renders engine truth only. |
**End-state fix:** owns the Lifecycle state machine (enforces "candidate can't masquerade as locked"). Asks Waypoint for the Great Stop verdict; asks engines for truth; NEVER judges. Wire steering controls to re-drive engines (currently inert).

---

## THE TWO BOOKEND CONTRACTS

| Contract | Which end | Structure | Owner |
|---|---|---|---|
| **ConciergeIntent** | INPUT — "the promise" (what the user wants + conditions to honor) | **Composition** — one author assembles raw input into one object | **Interpretation authors**; all engines read. Never raw UI after Step 1. |
| **Great Stop** | OUTPUT — "was the promise kept" (Real, Role-Right, Intent-Right, Place-Right, Moment-Right) | **Aggregation** — many authors stamp, one collector tallies | **Engines stamp** their own criterion (Field=Real, Taste=Role/Intent/Moment-meaning, District=Place, Waypoint=Moment-arc); **Waypoint aggregates** the verdict. |

**The symmetry:** input contract is *composed* (single author, many readers). Output contract is *aggregated* (many authors, single collector). Mirrors in purpose, opposites in structure — which is why one lives in Interpretation and the other's aggregator lives in Waypoint.

---

## THE FOUR HOMELESS SYSTEMS — RESOLVED

| Was homeless | Now houses as | Owner |
|---|---|---|
| **ConciergeIntent** | Input contract | Interpretation authors, all read |
| **Great Stop** | Output contract | Engines stamp criteria; **Waypoint aggregates** |
| **Route Lifecycle** | State orchestration | **Application** |
| **routeAuthority** | **DISSOLVED** — = "lockable state + Great Stop pass" | nobody (derived) |

Four orphans → two bookend contracts + one App orchestration job + one dissolved re-implementation. The system is simpler than the audit made it look.

---

## THE PORTABILITY PROOF (why this is the moat)

Swap the lens, keep the machine. Same six engines, same two contracts, same pipeline — only Interpretation's content and Field's data source change:

| | Concierge (ID.8) | Supply (Stock & Flow) | Shipping |
|---|---|---|---|
| **Interpretation (lens)** | romantic/cozy/persona → intent | priority/perishability → intent | SLA/cargo → intent |
| **Taste (swappable slot)** | hospitality meaning | supply meaning | freight meaning |
| **District (reused)** | venue pockets | hub zones | port regions |
| **Field** | venues | inventory/trucks | carriers/lanes |
| **Bearings** | hours/travel | cold-chain/capacity | customs/weight |
| **Waypoint** | night arc + Great Stop | delivery run + Great Stop | routing + Great Stop |
| **LCE** | night adapts live | run re-coordinates | route re-routes |
| **Application** | concierge UI | ops dashboard | logistics console |

A new vertical writes: one Interpretation lens + one Taste-slot meaning-engine + one Field data adapter. **Everything else is the same code.** That's the extraction seam. That's the moat.

---

*ID.8 / Arc End-State Engine Architecture · July 2026 · The re-housing target. Governing principle: domain-specific → Interpretation (the lens); everything else domain-agnostic (the machine). Every inventory finding re-houses against this map. Re-housing = MVP fix AND portability proof — the same work. Next: (1) re-house the inventory against this map, (2) identify the gaps, (3) calibrate the MVP. Then formalize each engine in updated technical docs.*
