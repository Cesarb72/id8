# ID.8 Architecture Note

- ID.8 is a separate product host application.
- Waypoint is consumed only through `src/integrations/waypoint/core.ts`.
- No other file in ID.8 should import Waypoint internals directly.
- Integration migration path:
  - Today: relative import (`../../../../waypoint/lib/core/index`)
  - Later: package import (`@waypoint/core`)
- This repository is intentionally stopped at a host skeleton stage before full product build.
