/**
 * Photograph the real page: `npm run shot`.
 *
 * The other checks run the rules in Node and cannot see. This one loads the game in
 * headless Chrome over the DevTools protocol and saves what is drawn, so that a claim
 * about how something looks can be looked at. docs/CONVENTIONS.md section 7.
 *
 *   npm run shot                      one picture of the view at rest
 *   npm run shot fight                cast, strike at the first bite that has the hook in, photograph the fight
 *   npm run shot fight rests 60       ...winding only while the fish rests, 60 pictures
 *   npm run shot cast 16              cast, and photograph the lure landing and what the water does after, 16 pictures
 *
 * How the finger behaves in a fight: `able` (wind whenever line is not running out, the
 * default), `rests` (only while it rests), `always`, `never`.
 * Pictures and a log of what the settings panel read at each go to SHOT_DIR, or
 * /tmp/fishing-shots. They are at three device pixels to a design pixel, as on a phone.
 *
 * It starts its own dev server on a spare port and stops it. It needs Google Chrome
 * with WebGPU (macOS path below). Frames come slowly headless, and the game slows with
 * them: what is seen is right, how fast it went is not.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 5196;
const DEBUG_PORT = 9336;
const mode = ['fight', 'cast'].includes(process.argv[2]) ? process.argv[2] : 'still';
const policy = process.argv[3] || 'able';
const most = mode === 'cast' ? Number(process.argv[3] || 16) : Number(process.argv[4] || 40);
const dir = process.env.SHOT_DIR || '/tmp/fishing-shots';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(dir, { recursive: true });
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, '--enable-unsafe-webgpu', '--enable-features=WebGPU', '--use-angle=metal', '--window-size=390,844', '--hide-scrollbars', `--user-data-dir=${dir}/.chrome`, 'about:blank'], { stdio: 'ignore' });
try {
  let targets = null;
  for (let i = 0; i < 60 && !targets; i += 1) { await sleep(250); try { targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json(); } catch { /* not up yet */ } }
  if (!targets) throw new Error('Chrome did not start');
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const waiting = new Map(); const errors = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((r) => { id += 1; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
  const key = (type) => send('Input.dispatchKeyEvent', { type, code: 'Space', key: ' ', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
  // The desktop stand-in for snapping the rod up.
  const strike = async () => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, code: 'ArrowUp', key: 'ArrowUp', windowsVirtualKeyCode: 38, nativeVirtualKeyCode: 38 }); };
  const shoot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${dir}/${name}.png`, Buffer.from(s.result.data, 'base64')); };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) break; } catch { /* not up yet */ } await sleep(250); }
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
  await sleep(12000);
  if (!(await evaluate(`!!document.querySelector('#shore-view')`))) throw new Error('the page did not come up: ' + (await evaluate('document.body.innerText.slice(0, 200)')));
  // The page's own text out of the picture. The settings panel is opened and made
  // invisible: its line of numbers only runs while it is open.
  await evaluate(`(() => { const s = document.createElement('style'); s.textContent = '.tune-panel{opacity:0!important;pointer-events:none!important} .tune-toggle{opacity:0!important} #ui-root > *:not(.tune-panel):not(.tune-toggle){display:none!important}'; document.head.appendChild(s); document.querySelector('.tune-toggle').click(); })()`);
  const log = [];
  if (mode === 'still') {
    await shoot('still');
    log.push('still');
  } else if (mode === 'cast') {
    // The finger is never put down again: the lure lies where it landed, and the water is left to itself.
    const read = () => evaluate(`document.querySelector('.tune-cast')?.textContent || ''`);
    const t0 = Date.now();
    await key('keyDown'); await sleep(900); await key('keyUp');
    let n = 0, wet = false;
    for (let i = 0; i < 1200 && n < most; i += 1) {
      await sleep(60);
      const text = await read(); if (!text) continue;
      if (!wet && text.split(' ')[0] !== 'water') { if ((Date.now() - t0) / 1000 > 60) break; continue; }
      wet = true;
      const name = String(n).padStart(3, '0'); await shoot(name); n += 1;
      log.push(`${name} ${((Date.now() - t0) / 1000).toFixed(1)} s  ${text}`);
    }
    if (!wet) log.push('the lure never reached the water');
  } else {
    const read = () => evaluate(`document.querySelector('.tune-cast')?.textContent || ''`);
    const t0 = Date.now();
    await key('keyDown'); await sleep(900); await key('keyUp');
    let on = false, down = false, n = 0;
    for (let i = 0; i < 2400 && n < most; i += 1) {
      await sleep(120);
      const text = await read(); if (!text) continue;
      const stage = text.split(' ')[0];
      const mood = /鱼 \S+ (run|rest)/.exec(text)?.[1] || '';
      const running = Number(/出线 ([\d.]+)/.exec(text)?.[1] || 0);
      if (!on && stage === 'fight') on = true;
      if (on && stage !== 'fight' && stage !== 'landed') break;
      if (!on && (Date.now() - t0) / 1000 > 180) break;
      // A bite with the hook in its mouth: strike. The pictures start once it is on.
      if (!on && text.includes('钩在嘴里')) await strike();
      if (!on) continue;
      const want = stage === 'landed' || policy === 'always' ? true : policy === 'never' ? false : policy === 'rests' ? mood === 'rest' : !(running > 0.05);
      if (want !== down) { await key(want ? 'keyDown' : 'keyUp'); down = want; }
      const name = String(n).padStart(3, '0'); await shoot(name); n += 1;
      log.push(`${name} ${((Date.now() - t0) / 1000).toFixed(1)} s  ${text}`);
    }
    if (down) await key('keyUp');
    if (!on) log.push('no fish took the lure');
  }
  fs.writeFileSync(`${dir}/log.txt`, [...log, ...errors.map((e) => `ERROR ${e}`)].join('\n') + '\n');
  console.log(`${log.length} pictures in ${dir}${errors.length ? `, ${errors.length} page errors (see log.txt)` : ', no page errors'}`);
  ws.close();
  if (errors.length) process.exitCode = 1;
} finally {
  chrome.kill();
  vite.kill();
}
