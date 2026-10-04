# Project: quantum-3d-site

Concept phase. A website that displays 3D assets, possibly processed with Moth Atlas
engines (Tessa, Blur, Blur-Core, entanglement-shader). Audio does NOT drive any
parameters. Do not build audio-reactive features.

## Stack
Vite + Three.js, plain JavaScript, static site.

## Layout
- src/main.js        viewer (placeholder mesh, drag-and-drop .glb)
- public/models/     put asset.glb here to auto-load it
- public/textures/   images (including any Atlas outputs)
- bake/              future scripts that call Atlas offline and save results
- docs/              notes and PRD

## Commands
- npm install
- npm run dev

## Rules
- MOTH_API_KEY lives only in .env (gitignored). Never in client code.
- Atlas is async and poll-based (POST /engines/{id}/process, poll status, fetch result).
  Run it offline in bake/ and ship static outputs.
- Confirm engine parameter schemas against the Atlas docs before writing job code.

## Telablur bake (telablur-v1)
- Inputs in source/: fish_raw.png (image1) and fish_cooked.png (image2), both opaque PNGs.
- Config: bake/config.json. Scripts: npm run bake:plan | bake:test | bake:sweep.
- strength 0 to 1 is the morph dial; direction is blur axis only. 1 credit per run.
- Always run bake:test first and inspect before bake:sweep.
- Full PRD: docs/PRD.md
