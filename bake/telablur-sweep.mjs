// Sweeps telablur-v1 `strength` across N values and saves each result as a frame.
// Modes: --plan (default, no API calls) | --test (strength 0, 0.5, 1) | --run (full sweep)
// UNTESTED against the live API: run --test first and check the output images.
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.mothquantum.com/api/v1';
const mode = process.argv[2] ?? '--plan';
const root = path.resolve(import.meta.dirname, '..');
const cfg = JSON.parse(await fs.readFile(path.join(root, 'bake/config.json'), 'utf8'));

const strengths =
  mode === '--test'
    ? [0, 0.5, 1]
    : Array.from({ length: cfg.frames }, (_, i) =>
        +(cfg.strengthMin + (i / (cfg.frames - 1)) * (cfg.strengthMax - cfg.strengthMin)).toFixed(4));

if (mode === '--plan') {
  console.log(`Plan: ${strengths.length} runs (= ${strengths.length} credits)`);
  console.log('strengths:', strengths.join(', '));
  console.log('Use --test first (3 credits), then --run.');
  process.exit(0);
}

if (!process.env.MOTH_API_KEY) throw new Error('MOTH_API_KEY missing (set it in .env)');
const H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };
const J = { ...H, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${r.status} ${url} ${await r.text()}`);
  return r.json();
}

async function upload(file) {
  const data = await fs.readFile(path.join(root, file));
  const ext = path.extname(file).toLowerCase();
  const type = ext === '.png' ? 'image/png' : 'image/jpeg';
  const asset = await api(`${API}/assets`, {
    method: 'POST', headers: J,
    body: JSON.stringify({ filename: path.basename(file), content_type: type, size_bytes: data.byteLength }),
  });
  const put = await fetch(asset.upload.url, { method: 'PUT', headers: asset.upload.headers, body: data });
  if (!put.ok) throw new Error(`upload PUT failed: ${put.status}`);
  await api(`${API}/assets/${asset.asset_id}/complete`, { method: 'POST', headers: H });
  return asset.asset_id;
}

async function runJob(strength, image1, image2) {
  const job = await api(`${API}/engines/telablur-v1/process`, {
    method: 'POST', headers: J,
    body: JSON.stringify({ params: { ...cfg.params, strength }, input_files: { image1, image2 } }),
  });
  for (;;) {
    await sleep(3000);
    const st = await api(`${API}/jobs/${job.job_id}/status`, { headers: H });
    if (st.status === 'completed') break;
    if (st.status === 'failed' || st.status === 'cancelled')
      throw new Error(`job ${job.job_id} ${st.status}: ${JSON.stringify(st.error)}`);
  }
  const res = await api(`${API}/jobs/${job.job_id}/result`, { headers: H });
  return { job_id: job.job_id, out: res.outputs[0] };
}

const outDir = path.join(root, cfg.outDir, mode === '--test' ? 'test' : '');
await fs.mkdir(outDir, { recursive: true });
const manifestPath = path.join(outDir, 'manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8').catch(() => '[]'));

console.log('Uploading images...');
const [a1, a2] = [await upload(cfg.image1), await upload(cfg.image2)];

for (const [i, strength] of strengths.entries()) {
  if (manifest.some((m) => m.strength === strength)) { console.log(`skip ${strength} (done)`); continue; }
  console.log(`frame ${i + 1}/${strengths.length}  strength=${strength}`);
  const { job_id, out } = await runJob(strength, a1, a2);
  const ext = path.extname(out.filename || '.png') || '.png';
  const file = `fish_${String(i).padStart(3, '0')}${ext}`;
  await fs.writeFile(path.join(outDir, file), Buffer.from(await (await fetch(out.url)).arrayBuffer()));
  manifest.push({ index: i, strength, job_id, output_asset_id: out.output_asset_id, file, params: cfg.params });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2)); // resumable
}
console.log('Done. Frames in', outDir);
