# ARC SHARED OPERATING PROCESS - THE ONE-PAGER
## How ID.8 (and every Arc vertical) actually works - June 2026 - STICKY - read before any mode work

---

## THE ONE TRUTH

**The three modes are NOT three products. They are three entry strategies into ONE shared pipeline.**
Mode differences end at intent. From there, every mode runs the exact same engine process.

> *"User intent -> interpreted -> constrained -> coordinated -> surfaced. NEVER UI -> route."* - App Layer doc
> *"Mode differences end at contract entry. Artifact lineage is shared from preview onward."* - PRD

If a mode improvises its own pipeline, that is the bug. There is one pipeline.

---

## THE SHARED PIPELINE (every mode flows through this, in this order)

```text
  INTENT          ->  MEANING          ->  CONSTRAINT      ->  GROUND      ->  SEQUENCE     ->  PRESERVE     ->  RENDER
  (the ask)           Interpretation       Bearings            Field            Waypoint         LCE              App Layer

  "what does the      normalize into       what reality is     find real        build the        keep aligned     show it.
   user want"         ConciergeIntent      actually allowed    venues that       night around     as reality       never invent.
                      + give places        (hours, distance,   ground the        constraints      changes after
                      meaning              required stops)     intent in         + meaning        lock
                                                               reality
```

**The load-bearing handoff:** every mode must produce **ConciergeIntent** - the normalized "what the user is trying to do." Nothing downstream runs without it. Every engine reads it. It is the shared contract that makes the pipeline shared. *(This is the documented weakest link - see why below.)*

---

## WHERE THE MODES DIFFER (only here - at intent entry)

| Mode | Entry strategy | How the user expresses intent | Produces |
|---|---|---|---|
| **Surprise** | System-led | "Give me a strong night fast" - location only | -> ConciergeIntent (system-seeded) |
| **Curate** | Guided | Pick a starter -> resolves to 1 of 9 scenario families -> light shaping | -> ConciergeIntent (family-seeded) |
| **Build** | User-led | Pick the ONE anchor I care about -> build around it | -> ConciergeIntent (anchor-seeded, anchor = required stop) |

**After this column, the three modes are identical.** They all produce a ConciergeIntent, and the same six engines process it the same way. Surprise/Curate/Build differ in *how intent is formed*, never in *how the night is built*.

---

## THE ENGINE LINE (each owns ONE job - never does another's)

> *"Field made the system aware of reality. Interpretation gave places meaning. Bearings kept it grounded. Waypoint built the sequence. LCE kept it aligned as conditions changed. ID.8 made it usable."* - the complete Arc engine line, Bible

- **Field** - detects reality. Real venues, identity, location, hours/status. *Never assigns meaning or sequences.*
- **Interpretation** - means. Normalizes intent into **ConciergeIntent**; gives venues meaning for THIS intent. Writes ContractEntryArtifact. *Never invents venue facts or sequences.*
- **Bearings** - admits. What reality allows: hours, distance, feasibility, required-stop survival. *Never rescues a weak plan or rewrites the night.*
- **Field (ground)** - finds the real venues that match the constrained intent. *Discovery suggests; Bearings decides what must be true.*
- **Waypoint** - sequences. Builds the arc around constraints and meaning. *Never decides what the night means.*
- **LCE** - preserves. Keeps the route aligned as reality changes after lock. Writes RuntimeRouteArtifact. *Never rebuilds from scratch or changes the plan silently.*
- **Application Layer** - renders. Shows engine truth. *Never authors truth. Never UI -> route.*

---

## WHY WE'VE BEEN STUCK (the honest diagnosis)

The pipeline is **defined** but not **enforced as one shared contract**. The documented weakest link names it:

> *"ConciergeIntent v0.1 is the current critical next step. Until it is formally defined and threaded through, the upstream layer remains the weakest point in the system. Nothing runs without it."* - App Layer doc

Because ConciergeIntent was never fully defined and threaded:
- Each mode improvises its own "what the user wants" instead of producing one shared object.
- Each engine improvises what it reads instead of consuming one shared contract.
- So the "shared pipeline" is actually **three improvised pipelines wearing a trenchcoat.**
- Every gate is hand-fit to the data we injected for ONE test path.
- **Real-world data - or another vertical's data - doesn't match the injected shape, so the gates reject it. Nothing survives but the exact path we tested.**

This is why we are "too strict and nothing survives." Not by choice - because the thing that makes intent uniform and tolerant of real-world variety (ConciergeIntent) is unfinished.

---

## THE FIX (what this unlocks)

Define ConciergeIntent as the ONE normalized intent contract every mode produces and every engine consumes. Then:

- **Intent becomes exponentially easier** - define it once, every mode and engine speaks it.
- **Passes stop being brittle** - gates evaluate a normalized contract, not a hand-fit data shape, so real-world variety flows through.
- **Discovery becomes grounded and engaging** - reality flows through a tolerant process instead of dying in rigid gates.
- **Arc becomes malleable across verticals** - a different vertical plugs a different front-end into the SAME engine stack via the SAME intent contract. The brittleness fix and the portability/extraction-readiness goal are the SAME work.

---

## THE RULE TO TATTOO

**Lock the PROCESS first. Then user intent becomes easy.**
One pipeline. One intent contract (ConciergeIntent). Modes differ only at entry.
Each engine owns one job. The app renders truth, never authors it.
If a mode improvises a pipeline step, that is the bug - thread the shared contract instead.

---
*Sticky - Arc Shared Operating Process - June 2026 - This is the map. The ConciergeIntent definition document specs the load-bearing contract next. Grounded in PRD, Bible, App Layer doc, Production Contract, Engine Ownership Reference.*
