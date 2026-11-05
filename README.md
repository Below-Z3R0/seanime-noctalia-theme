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

which is where the Noctalia template writes it. The value is kept in the plugin's storage on the
server, because the file is read server-side: every client shares the same path.

> **Permissions.** The manifest declares `readPaths` for the two default locations
> (`$HOME/.local/state/noctalia/seanime/*` and `$HOME/.config/noctalia/seanime/*`). Pointing the
> field somewhere else needs a manifest with that path added — the server refuses reads outside
> the declared paths.
>
> The read happens **on the server**, so a containerised Seanime needs the Noctalia state
> directory mounted inside it, mapped to the server user's home:
>
> ```yaml
> volumes:
>   - ${XDG_STATE_HOME:-$HOME/.local/state}/noctalia:/home/seanime/.local/state/noctalia:ro
> ```
>
> No network access and no unsafe flags are requested: the plugin only injects a `<style>`
> element (never a `<script>` or a `<link>`), which is why `dom-script-manipulation` and
> `dom-link-manipulation` stay out of the manifest.

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

The plugin polls the palette file every two seconds and compares a hash of its contents: cheap,
stateless, and it survives the client being closed and reopened. The read happens **on the
server** — the manifest declares the paths it is allowed to touch — so the palette is the same for
every client, which is what a desktop-wide theme should be.

When the contents change the plugin rebuilds the stylesheet, removes the previous element, creates
a fresh one and reads the text back to confirm the write landed. Each client owns its own DOM, so
the stylesheet is re-created when a client reconnects; a `data-noctalia="1"` marker lets the plugin
find and remove leftovers from an earlier session instead of piling up duplicates.

A presence probe runs every five seconds, which catches the case where a client reloaded but never
fired the ready hooks (Seanime only sends them once per load).

## Troubleshooting

The plugin reports its state in the tray; the same text is stored under
`noctaliaTheme.status`.

| Status | Meaning |
|---|---|
| `Applied · <path>` | The palette was read and the stylesheet is in the client's DOM |
| `Not found: <path>` | The file is not there, or the server is not allowed to read it |
| `Waiting for the palette…` | No poll has finished yet (usually right after loading) |
| `Apply failed: …` | The client did not accept the stylesheet; the message says why |
| `No palette roles in the file` | The file exists but has no `--nt-*` properties |

If it says `Not found` for a path that exists on your machine, the plugin is running somewhere
else — a container, most likely. See the container note under *Permissions*.

## Development

```
plugins/noctalia-theme/
├── code.ts                  the plugin
├── noctalia-theme.json      manifest: id, permissions, payload location
├── icon.png
├── tsconfig.json
└── test/
    └── simulate-runtime.ts  runs the plugin the way Seanime does
```

The plugin does not run in Node: Seanime evaluates it with Goja and runs the `$ui.register`
callback in a **separate runtime**, so nothing declared outside that callback is visible inside
it. That is why the whole implementation lives in one callback.

This is exactly what the simulator reproduces, with two isolated `vm` contexts:

```bash
bun test/simulate-runtime.ts          # compiles the source, calls init(), runs the callback
```

It fails when a constant is declared outside the callback, when a global timer is used, or when
the payload stops parsing — the three mistakes that cost the most time while building this.

## License

MIT
