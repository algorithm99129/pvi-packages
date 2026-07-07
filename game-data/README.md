# Game data (source of truth)

JSON files here are authored and edited via **Garden Siege Editor** (`apps/editor`).

## Layout

| Folder | Content |
|--------|---------|
| `plants/` | Full plant definitions (stats + client assets + server rules) |
| `insects/` | Full insect definitions |
| `missions/` | Story missions, waves, star criteria, rewards |
| `maps/` | Village / story map templates |

## Export

On export, the pipeline splits each entity:

- **Client** (`apps/client` or configured path) — sprites, audio refs, display strings
- **Server** (`apps/api/data/game` or configured path) — ids, stats, unlock rules, loot

See `@garden-siege/export-pipeline`.
