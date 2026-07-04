# shared/

App-wide, feature-agnostic building blocks: generic hooks, formatting utils,
layout helpers. Rules:

- A feature may import from `shared/`; `shared/` never imports from `features/`.
- If something is reusable across apps (not just this SPA), it belongs in
  `packages/ui` (visual primitive) or `packages/domain` (business rule) instead.
- Keep this directory flat until there is a real need for structure.
