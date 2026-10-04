# Quantum Fish

Quantum Fish is a cinematic 3D viewer that treats the fish as a quantum object in a shaded lagoon. The project uses Moth Atlas engines to generate static texture and audio outputs ahead of time, then presents them as a single browser experience where camera angle drives the visual and sonic state.

## The engines

The project is built around two Moth Atlas processes:

### Telablur

Telablur is the image engine used to morph one fish image into another through quantum rotation, not a simple colour blend. It places two images inside a single quantum state and rotates between them, producing a transformation that peaks around the midpoint rather than behaving like a normal crossfade. The effect can be read as a still frame at any chosen point in the rotation, and a mask can be used to localise the blur precisely to the fish rather than the whole image.

This is the engine that generates the baked fish frames used in the viewer. The first frame matches the raw image, and the final frame matches the cooked image. The frames are saved as numbered texture files and mapped to camera angle so the fish changes smoothly as the visitor moves around it.

### Retrocausal Echo

Retrocausal Echo is the audio engine used to generate a measured multi-tap delay response. A line of qubits acts like a delay line, with an impulse placed at one location, a scrambling circuit run forward and then backward, and the residual signal returned as a measured echo. Each tap contains information about level, pan, time slot, and phase behaviour. Some taps come back inverted, some never return, and the engine gives different ways to spend those negative taps: flip polarity, reverse grains, or rotate phase.

The engine returns either:

- a rendered WAV with the effect applied, or
- the measured response as an impulse response file for use in a convolver

It also gives a measured tap map that can be used as non-audio-driven data. In this project, that tap map drives the water ripples, so the water responds to the echo's measured timing without any live audio analysis or analyser node.

## The concept

The viewer is built around a raw-to-cooked fish transformation. Two source images are aligned into the same layout and dimensions. Their baked frame sequence is then loaded as textures on the fish model. As the camera moves around the fish, the viewer's angle is mapped to a position along that sequence, with the nearest two frames blended to hide stepping while preserving the engine's characteristic morphing behaviour.

The fish remains stable in form while the texture shifts between states, creating an object that feels alive without becoming a conventional animated character.

## How the viewer works

- the raw and cooked fish inputs are prepared as aligned texture maps
- Telablur generates the cooked frame set across the full rotation range
- the frames are named in sequence and saved as static files
- the camera angle is translated into a frame index and blend factor
- the fish material swaps between two neighbouring frames at each step
- the first frame reads as fully raw, and the final frame reads as fully cooked
- the audio version and tap-map data are baked ahead of time and crossfaded by angle
- the water ripples follow the measured tap timing rather than the live sound waveform

## Audio and water

Audio changes by angle, but it never drives the visual state. Instead, the engine produces several static echo versions, each with its own measured tap map. Those versions are loaded as baked files and crossfaded according to viewer angle.

The water plane is then driven by those tap maps. Each tap triggers a ripple; the timing, density, and amplitude of those ripples change with the selected version. This makes the water visibly echo the measured quantum response without using audio analysis in the browser.

## Visual direction

The presentation is minimal, bright, and immersive. The scene uses:

- a pale lagoon sky and glassy blue atmosphere
- glossy water with depth and reflection
- soft lighting and subtle bloom
- a clean Frutiger Aero interface
- a restrained, object-focused presentation

The fish remains the center of attention while the surrounding environment feels atmospheric and aquatic.

## Technical approach

The project is built as a static experience using Vite and Three.js. All engine outputs are shipped as local static assets rather than generated live in the browser. This keeps the site fast, lightweight, and predictable while preserving the character of the Moth Atlas outputs.

Key principles:

- static baked frame sets for the fish morph
- static audio renders and measured tap maps
- no analyser node or audio-reactive visuals
- angle-driven frame progression
- precomputed effects shipped directly to the client

## Open the site

GitHub Pages URL:

https://julesbutgreener.github.io/Quantum-Fish-Cook/

Local development:

```bash
npm install
npm run dev
```

Then open the URL shown in the terminal, usually:

http://localhost:5173/

If port 5173 is busy, Vite will choose the next available port.

## Production build

```bash
npm run build
```

## Notes

This project treats the fish as a cinematic quantum object: a form that changes with angle, is shaped by baked Atlas outputs, and is framed as a calm, immersive study in transformation. The use of Moth Atlas is not incidental — it is the basis of the image morphs, the audio versions, and the measured ripple data that define the final experience.

