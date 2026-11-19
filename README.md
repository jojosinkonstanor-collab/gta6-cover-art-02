[![make.fun](https://make.fun/badge/gta6-cover-art-02.svg)](https://make.fun/bounty/gta6-cover-art-02)
[![rank](https://make.fun/badge/gta6-cover-art-02/jojosinkonstanor-collab/gta6-cover-art-02/rank.svg)](https://make.fun/bounty/gta6-cover-art-02)
[![reward](https://make.fun/badge/gta6-cover-art-02/jojosinkonstanor-collab/gta6-cover-art-02/reward.svg)](https://make.fun/bounty/gta6-cover-art-02)

# Vice City Cover Lab

An offline web app that turns your own photos and a caption into multi-panel GTA 6-style poster cover art, exported as a PNG to share. Built for the [make.fun bounty "Make GTA 6 Cover Art and Post It on X"](https://make.fun/bounty/gta6-cover-art-02) ($250, top 50 share the prize).

## What it does

- **Any photo** — add your own photos from your machine (file picker or drag-and-drop), or load the two included sample photos. Nothing is uploaded; everything runs offline.
- **Multi-panel covers** — six layouts: Hero + two, Four grid, Nine panels, Three strip, Tilted snaps, and Full bleed. Fill several panels with one photo or several.
- **Crop and position per panel** — click a panel to select it, drag to move the photo, scroll (or the slider) to zoom.
- **Colour grades** — Vice Sunset, Neon Nights, Golden Hour, Miami Dawn, and Midnight Mono: a Vice City sunset or neon grade over every photo.
- **Lettering** — three title styles (White block, Sunset gradient, Neon outline), an editable title, subtitle in neon script, and a badge ribbon.
- **Fast export** — one click exports a PNG at 1080 × 1080, 1080 × 1350 or 1920 × 1080, or all three sizes at once.
- **Undo / redo** — every edit is on a history stack (Ctrl+Z / Ctrl+Y).

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request: `app/` is plain static files.

## The art

Everything is original: the sky, slatted sun, palm silhouettes, skyline, panels and lettering are drawn in code (`app/src/cover.js`). No Rockstar Games logo, wordmark, official artwork, character or font. The fonts are Anton and Pacifico, vendored under `app/fonts/` under the SIL Open Font License. The two sample photos under `app/samples/` were made with an image model for make.fun and are free to use.

## The post on X

`POST.json` still holds the placeholder address — the post on X about this app is waiting on the account owner (see `POST-DRAFT.md` for the ready-to-post text). Once it is posted, its address goes into `POST.json`.

## Handing it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library. Screenshots were taken with `node shots.mjs` (headless Chrome over CDP).

## License

MIT — see `LICENSE`.
