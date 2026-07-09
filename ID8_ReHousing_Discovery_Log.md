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
| `buildDistrictOpportunityProfiles.ts` → Interpretation/District sub-engine | ☐ not started | |
| `computeTasteLite.ts` → Taste | ☐ not started | the TODO admits it |
| `computeBearingsLite.ts` → Bearings | ☐ not started | |
| `fetchPlaceEntities.ts` → Field | blocked / partial split | Whole-file move blocked by District admission, radius selection, and distance/popularity sorting. GW2-1A raw source loader extracted to Field; District orchestration/admission split still pending. |
| geo/pocket/viability → split (Field/Bearings/Interp) | ☐ not started | |
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
*(append discoveries here)*

### Bearings
*(append discoveries here)*

### Waypoint
*(append discoveries here)*

### LCE
*(append discoveries here)*

### Application
*(append discoveries here)*

### Cross-cutting (contracts, gravity wells, seams)
*(append discoveries here)*

---

## OPEN QUESTIONS SURFACED DURING RE-HOUSING
*Things the move revealed that need a decision. Move resolved ones to the PDD as decisions.*
*(append here)*

---
*Re-Housing Discovery Log · opened July 2026 · Live during re-housing execution. Decisions → PDD #108+. Formal engine docs written from this log at re-housing completion. Close this doc when the formal docs are written — it will have done its job.*
