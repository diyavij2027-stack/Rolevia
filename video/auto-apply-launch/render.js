// Renders scene.html frame by frame and encodes it with the soundtrack.
// Usage: node render.js portrait|landscape [--stills t1,t2,...] [--fps 30]
// Output: out/auto-apply-<format>.mp4, or out/stills/<format>-<t>.png with --stills.
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), {spawn} = require('child_process');

const args = process.argv.slice(2);
const format = args[0] || 'portrait';
const [W, H] = format === 'landscape' ? [1920, 1080] : [1080, 1920];
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const fps = +(opt('--fps') || 30);
const stills = opt('--stills');
const root = __dirname, out = path.join(root, 'out');
fs.mkdirSync(path.join(out, 'stills'), {recursive: true});

const types = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2'};
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f));
}).listen(0);

(async () => {
  const port = srv.address().port;
  const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport: {width: W, height: H}});
  page.on('pageerror', e => console.error('page error:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://localhost:${port}/scene.html?w=${W}&h=${H}`);
  await page.waitForFunction('window.ready === true', null, {timeout: 60000});
  const {duration} = JSON.parse(fs.readFileSync(path.join(root, 'timeline.json'), 'utf8'));

  if (stills) {
    for (const t of stills.split(',').map(Number)) {
      await page.evaluate(t => window.renderAt(t), t);
      const f = path.join(out, 'stills', `${format}-${t.toFixed(2)}.png`);
      await page.screenshot({path: f}); console.log(f);
    }
  } else {
    const frames = Math.ceil(duration * fps), dest = path.join(out, `auto-apply-${format}.mp4`);
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
      '-i', path.join(out, 'audio.wav'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', dest], {stdio: ['pipe', 'inherit', 'inherit']});
    const t0 = Date.now();
    for (let f = 0; f < frames; f++) {
      await page.evaluate(t => window.renderAt(t), f / fps);
      const buf = await page.screenshot({type: 'png'});
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 60 === 0) console.log(`${format}: frame ${f}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end();
    await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exited ' + c))));
    console.log('wrote', dest);
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
