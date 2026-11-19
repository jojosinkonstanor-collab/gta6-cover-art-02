// Vice City Cover Lab — the entry program for gta6-cover-art-02 (Node 22,
// standard library only). It hands in the app this repository holds: app/ is
// plain static files a desktop browser loads offline (app/index.html plus its
// ES modules, its fonts and its two sample photos — no library, no network
// request), and screenshots/ holds the four JPEGs the maker took of it. The
// program copies both trees to the output directory and writes
// dossier.json there with the vendored make.fun library (vendor/makefun-app.ts,
// the kit's copy, unchanged), which is the summary the judge reads.
//
// What the app does: it turns a person's own photos and a caption into a
// multi-panel GTA-style poster cover — six panel layouts, five Vice City
// colour grades, three title lettering styles, per-panel crop/position/zoom,
// undo/redo, and PNG export at 1080x1080, 1080x1350 and 1920x1080.
//
// Run it locally to check the hand-in:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader's container MAKEFUN_OUTPUT_DIR is unset and /output is used.
// POST.json is deliberately NOT copied: the house reads it from the
// repository at the submitted commit, and it still holds the placeholder
// address until the post on X is up (see POST-DRAFT.md).

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own caps (reference/gate.json): only text_max_bytes shapes the
// dossier's bytes; the rest refuse an entry the scorer would refuse — more
// than 4 screenshots, one over 256 KiB, more than 993 files/directories in
// app/ or 48 MiB of app files in all, or a path under app/ over 1000 bytes.
// app/ counts beside /output's own 1000-entry cap, with screenshots/ and
// dossier.json, so 993 app entries plus those make exactly 1000.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function handIn() {
  mkdirSync(outputDir, { recursive: true });
  // Start clean, so a stale file from an earlier run can never leak in and
  // make the two runs differ.
  for (const name of ['app', 'screenshots', 'dossier.json']) {
    const target = join(outputDir, name);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }
  cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  if (existsSync(join(repoRoot, 'screenshots'))) {
    cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
  }
  writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, GATE_CAPS));
}

handIn();
