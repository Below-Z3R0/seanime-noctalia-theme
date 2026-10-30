# Noctalia Theme — a Seanime plugin

Applies the active [Noctalia](https://noctalia.dev) palette to Seanime, converting it into
Seanime's own colour variables — including the two Tailwind scales the app's UI is built from.

## Why a plugin is needed

Seanime's theme is a set of CSS custom properties, and it already ships a way to override them:
the **Custom CSS** field in Settings → Appearance. That field is not enough for a palette that
should follow the desktop:

1. **The custom CSS lives on the server.** Every client has to apply it by hand — *Apply to this
   client* — and a browser or a phone that connects later never picks it up.
2. **The scales stay on Seanime's defaults.** Seanime derives its greys and accents from
   `--color-gray-*` and `--color-brand-*`. Repainting the flat variables (`--background`,
   `--paper`, `--muted`…) leaves those two scales on the stock purple and grey, so half the UI
   keeps the old look no matter how careful the flat mapping is.

The plugin closes both gaps: it reads the palette file on the client, converts the roles into
**both** the flat variables and the two scales, and injects the result into the client's DOM as
soon as the palette changes.

## Requirements

- Seanime 3.10+ (desktop app, browser or mobile client)
- Noctalia 5+ and the companion template
  [`noctalia-seanime-template`](https://github.com/Below-Z3R0/noctalia-seanime-template), which
  writes the palette file this plugin reads

## Installation

From the Seanime marketplace, once the extension is published:

> Settings → Extensions → Marketplace → *Noctalia Theme* → Install

Seanime asks for the file-system permission the plugin declares; granting it is what lets the
plugin read the palette file.

To install it manually while it is not in the marketplace yet, drop the manifest into the
extensions folder of your Seanime data directory and restart the server:

```
<data-dir>/extensions/noctalia-theme.json
```

## Configuration

The plugin's tray icon holds one field: the path to the palette file. It defaults to

```
~/.local/state/noctalia/seanime/palette.css
```

which is where the Noctalia template writes it. The path is stored per client, so a browser and
the desktop app can point at different palettes.

> **Permissions.** The manifest declares `readPaths` for the two default locations
> (`$HOME/.local/state/noctalia/seanime/*` and `$HOME/.config/noctalia/seanime/*`). Pointing the
> field somewhere else needs a manifest with that path added — the server refuses reads outside
> the declared paths.

## The palette file

The template writes a flat list of CSS custom properties holding Noctalia's Material roles:

```css
--nt-mode: light;
--nt-primary: #d7827e;
--nt-surface: #fffaf3;
--nt-on-surface: #575279;
--nt-surface-container: #f2e9e1;
```

Only roles are exported. Noctalia exposes roles, not ramps, so the plugin derives the scales
itself.

## How the conversion works

**Flat variables** — each Noctalia role maps to the Seanime variable that carries the same
meaning, with the alpha baked in where Seanime expects a translucent surface:

| Seanime | Noctalia |
|---|---|
| `--background` | `surface` |
| `--foreground` | `on_surface` |
| `--paper`, `--paper-lighter` | `surface_container`, `surface_container_high` |
| `--subtle`, `--subtle-highlight`, `--border` | `on_surface` at 6 %, 8 %, 10 % |
| `--muted`, `--muted-highlight` | `on_surface_variant`, `on_surface` |
| `--media-accent-color`, `--ring` | `primary` |
| `--brand` | `primary_container` |

**Brand scale** — `--color-brand-50…950` is computed in OKLCH. The base colour keeps its exact
identity at step 500; every other step borrows the shape of Tailwind's own ramp, so the scale
keeps the palette's hue and saturation without going out of gamut (the chroma is pulled down
until the colour fits sRGB).

**Grey scale** — `--color-gray-50…950` stays absolute, on Tailwind's neutral ramp. Seanime's own
defaults read from it (`--paper` is grey-950, `--border` is grey-200), so rescaling it to the
theme would move every surface away from what the app expects. Only the hue is borrowed from
the palette, at a chroma low enough to stay neutral.

The plugin also keeps the document's colour scheme in step with the Noctalia theme, so Seanime's
own `dark:` variants follow the palette instead of fighting it.

## How it stays up to date

The plugin polls the palette file every two seconds and compares a hash of its contents, the same
way Hermes watches its skin files: cheap, stateless, and it survives the client being closed and
reopened. The stylesheet is updated in place — it is only created once — and the document's
colour scheme is only touched when the mode actually changes.

The file is read from the client first, so a browser on another machine uses the palette of the
machine it runs on. When the client cannot reach its own filesystem, the plugin falls back to the
server-side read; the tray reports which one is in use.

## Development

```
plugins/noctalia-theme/
├── noctalia-theme.json   manifest: id, permissions, payload location
├── code.ts               the plugin
└── icon.png
```

The colour maths in `code.ts` is pure and side-effect free, so it can be exercised on its own:

```bash
node --experimental-strip-types -e "
import { buildCss, parseTokens } from './code.ts'
"
```

## License

MIT
