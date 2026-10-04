# Sundial: PRD

Status: concept phase. Working title: **Sundial**.

## 1. Overview

A browser-based 3D scene in a Frutiger Aero style (glossy aqua, glass, sky, water). A fish sits at the centre. The viewer's camera is their position in the world. As they move around the fish, like the angle of a sundial, the fish's texture moves from raw to cooked and the soundtrack changes character.

The look and sound at each angle are produced ahead of time by Moth Atlas engines and shipped as static files. Nothing is generated live. Audio never drives any visual parameter. The one audio-related visual is the water: each echo version ships with a tap-map JSON measured by the engine, and the water makes a ripple for every tap. That data comes from the quantum measurement, not from analysing the sound.

## 2. Goals

- A polished single scene a visitor understands without instructions.
- The viewer's angle around the fish is the only control for both texture and audio.
- Real Atlas engine output behind both: an image morph and a measured echo.
- Simple water ripples that follow the echo's tap-map JSON.
- A repeatable bake pipeline (new images or audio in, new bundle out).

## 3. Non-goals (v1)

- Audio-driven parameters of any kind.
- Live calls to Atlas during playback.
- Quest, character or dialogue systems (see Phase 2).
- User uploads, accounts, multiplayer.

## 4. Engines used

| Engine | Role | Output used |
|---|---|---|
| Quantum Teleblur (`telablur-v1`, 1 credit per run) | Morphs image1 (raw) toward image2 (cooked) through qubit rotation gates; `strength` (0 to 1) is the morph dial | One image per run; about 24 runs give the frame set |
| Retrocausal Echo (`retrocausal-echo-v1`) | Multi-tap delay with a measured tap map | M rendered versions of the track, plus a tap-map JSON for each (used for water ripples) |

Atlas flow: upload each input as an asset (register, PUT to the presigned URL, complete), `POST /api/v1/engines/{id}/process`, poll `GET /api/v1/jobs/{id}/status` every 2 to 5 seconds, then `GET /api/v1/jobs/{id}/result` and download from the presigned URL (no auth header). Auth is a Bearer `moth_` API key. Rate limit is 300 requests per minute.

### Teleblur schema (confirmed from the engine's schema tab)

| Field | Detail |
|---|---|
| `input_files.image1` (required) | Source image, the raw fish. Sets the output size. |
| `input_files.image2` (required) | Target image, the cooked fish. Resized to image1 if dimensions differ. |
| `input_files.mask` (optional) | Same size as image1. White takes the teleblurred result, black keeps image1. If absent, image1's alpha channel is used as the mask, so export image1 fully opaque. |
| `params.strength` | 0 to 1, default 0.5. Strength of the teleportation effect. Whether 1 equals fully image2 is unverified; the test run decides the sweep range. |
| `params.direction` | `full` (default), `vertical` or `horizontal`. This is the axis of the blur, not the morph direction. |
| `params.size` | 8 to 1024, default 1024. Pixel budget per pass. |
| `params.downscale` | Default true. Oversized regions are downscaled and upscaled back, or tiled if false. |
| `params.mask_bin_size`, `params.mask_min_region` | Mask clean-up. Defaults 4 and 16. Only relevant with a mask. |
| Output | One `result` image (PNG, JPEG, WebP, TIFF or BMP). |
| Errors | `invalid_image1`, `invalid_image2`, `mask_size_mismatch`, `no_mask_region`, `invalid_params`, `processing_failed`. Job timeout is listed as 18,000 seconds. |

## 5. Experience

1. The visitor lands on a start screen (needed so the browser allows audio) and clicks to enter.
2. They see the fish in a bright lagoon-like scene, raw at the starting angle.
3. They move around the fish (drag, touch, or keys). Angle maps to progress from raw to cooked.
4. The texture steps through the baked morph frames. The audio crossfades between echo versions.
5. The water around the fish ripples in time with the echo's taps, so denser echo versions give busier water.
6. Optional: a sun element or sundial marker shows the current angle.

Open design choice: either a **half-circle** (raw at one end, cooked at the other) or a **full lap** (raw, cooked, raw). A full lap requires the morph to loop cleanly, which must be tested early.

## 6. Angle mapping

| Viewer angle | Texture | Audio |
|---|---|---|
| Start | Image A (raw) | Dry or lightest echo version |
| Mid | Mid-morph frames | Sparse-to-dense echo versions, crossfaded |
| End | Image B (cooked) | Heaviest echo version |

The angle is a position control only. Audio does not feed back into visuals.

### Ripples (kept simple)

- Each tap in the current echo version's tap-map JSON triggers one ripple at its timestamp. Only the tap time is used.
- Every ripple looks the same. No separate parameters for size, position or direction.
- During a crossfade, both versions' ripples play, faded in line with each version's volume.
- Cap active ripples (about 16 to 24) and thin very dense tap maps so the water doesn't turn to noise.

## 7. Functional requirements

| Priority | Requirement |
|---|---|
| P0 | Three.js scene, fish model (glTF/GLB) loaded and centred |
| P0 | Camera moves around the fish with smooth damping and a clamped range |
| P0 | Start gate that unlocks audio on click |
| P0 | Bake script: submit jobs, poll, download, write `manifest.json` |
| P0 | Texture frame set (16 to 32 frames) swapped by angle |
| P0 | Echo versions (4 to 6) crossfaded by angle |
| P1 | Water plane with a ripple shader, one ripple per tap, triggered by tap-map JSON timestamps |
| P1 | Frutiger Aero art direction: glass UI, aqua gradients, water and sky |
| P1 | Loading screen and graceful fallback if an asset fails |
| P1 | Preload and cache frames so scrubbing never stalls |
| P2 | Sun or sundial marker showing angle |
| P2 | Mobile touch polish |

## 8. Technical approach

- **Front end:** Vite, Three.js, Web Audio API (for playback and crossfading only), static hosting.
- **Bake pipeline:** Node or Python scripts in `bake/`, writing to `public/textures/` and `public/audio/`, plus `manifest.json` listing engine, parameters, job id and file path for every asset.
- **Secrets:** `MOTH_API_KEY` only in a local, gitignored `.env`. If live calls are ever added, use a serverless proxy.
- **Caching:** reuse finished jobs by job id; reuse a measured echo asset id to re-render without re-measuring.
- **Delivery:** static deploy (Vercel, Netlify or Cloudflare Pages).

## 9. Non-functional requirements

- 60 fps on a mid-range laptop.
- Total assets small enough to load in a few seconds (target under 40 MB; audio is the likely bulk, so compress it).
- Audio crossfades with no clicks or jumps.
- Works in current Chrome, Safari and Firefox.

## 10. Milestones

1. **Scene:** fish placeholder, camera orbit with clamped angle, start gate. No Atlas.
2. **Texture bake:** run `npm run bake:test` (strength 0, 0.5, 1; 3 credits), inspect the images and set the sweep range, then `npm run bake:sweep` (about 24 credits); swap frames by angle.
3. **Audio bake:** measure one Retrocausal Echo, render 4 to 6 versions and save each tap-map JSON; crossfade by angle.
4. **Ripples:** water plane and ripple shader driven by tap times.
5. **Look:** Frutiger Aero pass (materials, environment, UI).
6. **Polish:** preloading, mobile, performance, deploy.
7. **Phase 2 (optional):** quest layer.

## 11. Phase 2: quest layer (optional)

A small character moves through the lagoon, with the fish as the centrepiece. Objectives, dialogue and progression are all new systems and would roughly double the project. Decide after the Look milestone.

## 12. Review

| Dimension | Rating | Notes |
|---|---|---|
| Use of quantum | 7/10 | The image morph, the echo versions and the tap map all come from real engine runs, and the tap map now shapes the water. Still baked and not labelled, so a visitor could mistake it for ordinary effects. |
| Complexity of build | 5/10 (scene only), 7/10 (with quest) | Asset baking plus an angle-to-asset lookup, now with a simple ripple shader and tap timing. The quest layer is where the effort grows. |
| Effectiveness | 8/10 | One gesture drives image and sound, raw-to-cooked reads instantly, and the water makes the echo visible. Risks: morph looping, crossfade quality, visible banding between frames. |

## 13. Risks and open questions

- **Strength range:** confirm what `strength` 0 and 1 actually produce; adjust `strengthMin` and `strengthMax` in `bake/config.json` after the test run.
- **Alpha:** an image1 with transparency leaves transparent pixels unmorphed. Export it opaque.
- **Tap-map source:** the signed multi-tap delay map JSON is listed under Quantum Echo (`otoc-echo-v1`), while Retrocausal Echo is listed as audio in, audio out. Confirm which engine returns the map before building the ripples.
- **Tap-map JSON:** confirm the real field names and timestamp units from an actual engine output before writing the ripple code. Decide how to thin dense maps.
- **Looping:** does the morph return cleanly to its start for a full lap?
- **Frame count vs smoothness:** how many frames before stepping becomes visible? Consider interpolating between frames in a shader.
- **Audio render limit:** one project reports a cap of around 180 seconds including the tail; check this for your track length.
- **Cost and queue time:** check Atlas credits before large sweeps.
- **Licensing:** confirm terms for publishing Atlas outputs on a public site.
- **Assets:** fish model source and licence; raw and cooked images (or placeholders to start).

## 14. Success criteria

A visitor enters, walks around the fish, and without being told anything sees it cook, hears the sound change and watches the water ripple with the echoes, in a scene that feels distinctly Frutiger Aero.

## 15. Workspace (VS Code)

Open `quantum-3d-site.code-workspace`. Included:

- `.vscode/extensions.json`: recommends Claude Code, Prettier, glTF tools, shader highlighting, EditorConfig.
- `.vscode/tasks.json`: dev server, plus bake tasks (plan, test, full sweep).
- `.vscode/launch.json`: Chrome debug against `localhost:5173`.
- `.vscode/settings.json`, `.editorconfig`, `.prettierrc`: formatting, and search and watcher excludes for the frame folder.
- `bake/config.json` and `bake/telablur-sweep.mjs`: the bake script. Resumable, writes `manifest.json` next to the frames. It has not been run against the live API.
- `source/`: put `fish_raw.png` and `fish_cooked.png` here.

Setup: `npm install`, copy `.env.example` to `.env` and add `MOTH_API_KEY`, then `npm run bake:plan`. The bake scripts need Node 20.6 or newer (they use `--env-file`).
