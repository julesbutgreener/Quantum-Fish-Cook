// Bakes Retrocausal Echo versions of one track (retrocausal-echo-v1, 2 credits per run).
// Usage (from the project root, Node 20.6+):
//   node --env-file=.env bake/retrocausal-sweep.mjs --plan          no API calls, shows what would run
//   node --env-file=.env bake/retrocausal-sweep.mjs --test          one run (config "testVersion"), or --only=N
//   node --env-file=.env bake/retrocausal-sweep.mjs --run           all versions (resumable)
// UNTESTED against the live API: run --test first and listen to the result.
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.mothquantum.com/api/v1';
const root = path.resolve(import.meta.dirname, '..');
const mode = process.argv[2] ?? '--plan';
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? Number(onlyArg.split('=')[1]) : null;

const cfg = JSON.parse(await fs.readFile(path.join(root, 'bake/audio-config.json'), 'utf8'));
let versions = cfg.versions.map((v, i) => ({ ...v, index: i }));
if (mode === '--test') versions = versions.filter((v) => v.index === (only ?? cfg.testVersion ?? 2));
else if (only !== null) versions = versions.filter((v) => v.index === only);

const base = (v) => `v${String(v.index).padStart(2, '0')}_${v.name}`;
const paramsFor = (v) => ({ ...cfg.baseParams, ...v.params });

if (mode === '--plan') {
  console.log(`Plan: ${versions.length} runs (= ${versions.length * 2} credits)`);
  for (const v of versions) console.log(`  ${base(v)}  ${JSON.stringify(paramsFor(v))}`);
  console.log('Use --test first (2 credits), listen, then --run.');
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

const TYPES = { '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.flac': 'audio/flac' };

async function upload(file) {
  const data = await fs.readFile(path.join(root, file));
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) throw new Error(`Unsupported audio type: ${file}`);
  const asset = await api(`${API}/assets`, {
    method: 'POST', headers: J,
    body: JSON.stringify({ filename: path.basename(file), content_type: type, size_bytes: data.byteLength }),
  });
  const put = await fetch(asset.upload.url, { method: 'PUT', headers: asset.upload.headers, body: data });
  if (!put.ok) throw new Error(`upload PUT failed: ${put.status}`);
  await api(`${API}/assets/${asset.asset_id}/complete`, { method: 'POST', headers: H });
  return asset.asset_id;
}

async function runJob(params, audioId) {
  const job = await api(`${API}/engines/retrocausal-echo-v1/process`, {
    method: 'POST', headers: J,
    body: JSON.stringify({ params, input_files: { audio: audioId } }),
  });
  for (;;) {
    await sleep(3000);
    const st = await api(`${API}/jobs/${job.job_id}/status`, { headers: H });
    if (st.status === 'completed') break;
    if (st.status === 'failed' || st.status === 'cancelled')
      throw new Error(`job ${job.job_id} ${st.status}: ${JSON.stringify(st.error)}`);
  }
  return { job_id: job.job_id, res: await api(`${API}/jobs/${job.job_id}/result`, { headers: H }) };
}

const outDir = path.join(root, cfg.outDir);
const tapsDir = path.join(outDir, 'taps');
const irDir = path.join(root, cfg.irDir);
await Promise.all([outDir, tapsDir, irDir].map((d) => fs.mkdir(d, { recursive: true })));

const manifestPath = path.join(outDir, 'manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8').catch(() => '[]'));

console.log('Uploading audio...');
const audioId = await upload(cfg.audio);

for (const v of versions) {
  const params = paramsFor(v);
  // Skip only if this exact version (same name AND same params) is already baked.
  if (manifest.some((m) => m.index === v.index && m.name === v.name && JSON.stringify(m.params) === JSON.stringify(params))) {
    console.log(`skip ${base(v)} (done, same params)`);
    continue;
  }
  console.log(`running ${base(v)}`, JSON.stringify(params));
  const { job_id, res } = await runJob(params, audioId);

  const files = {};
  const assets = {};
  for (const out of res.outputs ?? []) {
    const bytes = Buffer.from(await (await fetch(out.url)).arrayBuffer());
    assets[out.slot] = out.output_asset_id;
    if (out.slot === 'result') {
      const ext = (out.content_type || '').includes('json') ? '.json' : '.wav';
      files.audio = `${base(v)}${ext}`;
      await fs.writeFile(path.join(outDir, files.audio), bytes);
    } else if (out.slot === 'taps') {
      files.taps = `taps/${base(v)}.taps.json`;
      await fs.writeFile(path.join(outDir, files.taps), bytes);
    } else if (out.slot === 'ir') {
      files.ir = `${cfg.irDir}/${base(v)}.ir.json`; // kept out of public/, not shipped
      await fs.writeFile(path.join(irDir, `${base(v)}.ir.json`), bytes);
    }
  }
  // Replace any older entry for this index (e.g. after changing the params), keep sorted.
  for (let i = manifest.length - 1; i >= 0; i--) if (manifest[i].index === v.index) manifest.splice(i, 1);
  manifest.push({
    index: v.index, name: v.name, ripples: v.ripples !== false,
    params, job_id, files, assets,
  });
  manifest.sort((a, b) => a.index - b.index);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2)); // resumable
}
console.log('Done. Files in', outDir);
