// Vice City Cover Lab screenshot driver (my own script, Node 22 stdlib only):
// serves app/, opens each ?shot= scene in headless Chrome over CDP, waits for
// window.__shotReady, and captures a JPEG inside the gate's limits
// (<= 256 KiB, long side <= 1280, short side >= 480).
//   node shots.mjs [port]
// Chrome is the Playwright headless shell on this machine; CHROME_BIN overrides.
import { spawn } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.argv[2] ?? 8099);
const CHROME = process.env.CHROME_BIN
  ?? join(homedir(), '.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell');
const DEBUG_PORT = 9223;
const OUT = join(here, 'screenshots');

const SHOTS = [
  {
    name: '1-cover.jpg',
    url: '/?shot=cover&size=1920x1080&layout=hero&grade=sunset&lettering=sunset&title=Vice%20City&subtitle=Sunset%20heist%20nights',
    width: 1280, height: 720,
  },
  {
    name: '2-editor.jpg',
    url: '/?shot=editor&size=1920x1080&layout=hero&grade=sunset&lettering=white&title=Vice%20City&subtitle=Sunset%20heist%20nights',
    width: 1280, height: 800,
  },
  {
    name: '3-cover-portrait.jpg',
    url: '/?shot=cover&size=1080x1350&layout=nine&grade=neon&lettering=neon&title=Neon%20Nights&subtitle=Cruise%20the%20coast',
    width: 1024, height: 1280,
  },
  {
    name: '4-cover-square.jpg',
    url: '/?shot=cover&size=1080x1080&layout=fullbleed&grade=golden&lettering=sunset&title=Golden%20Hour&subtitle=Vice%20City%20nights',
    width: 1080, height: 1080,
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, tries = 50) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('Timed out waiting for ' + url);
}

/** Minimal CDP client over the built-in WebSocket. */
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
    this.open = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error('CDP websocket failed'));
    });
  }

  async call(method, params = {}) {
    await this.open;
    const id = this.nextId++;
    const done = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return done;
  }

  close() { this.ws.close(); }
}

async function captureShot(browser, shot) {
  const { targetId } = await browser.call('Target.createTarget', {
    url: 'about:blank',
    width: shot.width,
    height: shot.height,
  });
  const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const pageTarget = list.find((t) => t.id === targetId);
  if (!pageTarget) throw new Error('No CDP target for ' + shot.name);
  const page = new Cdp(pageTarget.webSocketDebuggerUrl);
  await page.call('Page.enable');
  await page.call('Emulation.setDeviceMetricsOverride', {
    width: shot.width, height: shot.height, deviceScaleFactor: 1, mobile: false,
  });
  await page.call('Page.navigate', { url: `http://127.0.0.1:${PORT}${shot.url}` });

  // Wait for the app to signal it has painted.
  let ready = false;
  for (let i = 0; i < 100; i += 1) {
    const { result } = await page.call('Runtime.evaluate', {
      expression: 'window.__shotReady === true',
      returnByValue: true,
    });
    if (result?.value) { ready = true; break; }
    await sleep(100);
  }
  if (!ready) throw new Error('Shot ' + shot.name + ' never became ready');
  await sleep(250);

  // Capture, shrinking JPEG quality until the gate's 256 KiB cap is met.
  let quality = 88;
  let bytes = null;
  for (;;) {
    const { data } = await page.call('Page.captureScreenshot', { format: 'jpeg', quality });
    bytes = Buffer.from(data, 'base64');
    if (bytes.length <= 256 * 1024 || quality <= 55) break;
    quality -= 10;
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, shot.name), bytes);
  const size = statSync(join(OUT, shot.name)).size;
  console.log(`${shot.name}: ${shot.width}x${shot.height} q${quality} ${size} bytes`);
  if (size > 256 * 1024) throw new Error(shot.name + ' still over 256 KiB at q' + quality);
  page.close();
  await browser.call('Target.closeTarget', { targetId });
}

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], {
    cwd: here, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => process.stdout.write('[serve] ' + d));
  server.stderr.on('data', (d) => process.stderr.write('[serve] ' + d));

  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--user-data-dir=/tmp/vice-city-cover-lab-chrome-profile',
    '--password-store=basic', '--use-mock-keychain',
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    await waitFor(`http://127.0.0.1:${PORT}/`);
    await waitFor(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    const version = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json();
    const browser = new Cdp(version.webSocketDebuggerUrl);
    for (const shot of SHOTS) await captureShot(browser, shot);
    browser.close();
    console.log('All screenshots written to ' + OUT);
  } finally {
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
