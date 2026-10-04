import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const AZ_MIN = -Math.PI / 2;
const AZ_MAX = Math.PI / 2;
const REVERSE = false;
const FRAMES_DIR = './textures/fishver4';
const MAX_RIPPLES = 64;
const MAX_RIPPLES_PER_SPLASH = 64;
const SPLASH_INTERVAL_S = 4;
const PAN_FOR_X = true;
const RIPPLE_SPEED = 8.0;
const RIPPLE_DAMPING = 1.25;
const RIPPLE_WAVELENGTH = 12.0;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe9ff);
scene.fog = new THREE.Fog(0xcfe9ff, 7, 18);
const clock = new THREE.Clock();

document.body.style.margin = '0';
document.body.style.background = 'radial-gradient(circle at 50% 20%, #edf8ff 0%, #d4ecff 26%, #b8d9f3 48%, #96bfe7 100%)';
document.body.style.overflow = 'hidden';
canvas.style.display = 'block';
canvas.style.width = '100vw';
canvas.style.height = '100vh';
canvas.style.filter = 'saturate(1.08) contrast(1.04)';

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.08, 0.45, 0.7);
bloomPass.threshold = 0.18;
bloomPass.strength = 0.10;
bloomPass.radius = 0.35;
composer.addPass(bloomPass);

const cameraDistance = 2.8;
const cameraHeight = 0.6;
camera.position.set(Math.sin(AZ_MIN) * cameraDistance, cameraHeight, Math.cos(AZ_MIN) * cameraDistance);

scene.add(new THREE.HemisphereLight(0xf7fcff, 0x7aa8cc, 1.7));
const key = new THREE.DirectionalLight(0xffffff, 2.6);
key.position.set(2.5, 3, 2.5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);

const fill = new THREE.DirectionalLight(0xdff7ff, 1.2);
fill.position.set(-3, 1.5, -2.5);
scene.add(fill);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minAzimuthAngle = AZ_MIN;
controls.maxAzimuthAngle = AZ_MAX;
controls.minPolarAngle = 0.75;
controls.maxPolarAngle = 2.4;
controls.minDistance = 1.4;
controls.maxDistance = 5.5;
controls.target.set(0, 0.1, 0);
controls.update();

const state = {
  current: null,
  frameTextures: [],
  fishMaterial: null,
  checkerTexture: null,
  checkerEnabled: false,
  debugVisible: false,
  previewVisible: false,
  manualMode: false,
  manualT: 0,
  azimuth: 0,
  t: 0,
  frameA: 0,
  frameB: 0,
  uMix: 0,
  audioContext: null,
  audioStarted: false,
  audioVersions: [],
  audioSources: [],
  audioGainNodes: [],
  audioGainValues: [],
  audioUnlocked: false,
  lastSplashAt: -Infinity,
  water: null,
  waterMaterial: null,
  rippleData: [],
  waterSize: 12,
  waterY: 0,
  audioMuted: false,
};

const loadingEl = document.createElement('div');
loadingEl.style.position = 'fixed';
loadingEl.style.left = '16px';
loadingEl.style.top = '16px';
loadingEl.style.padding = '8px 12px';
loadingEl.style.borderRadius = '999px';
loadingEl.style.background = 'rgba(9, 14, 20, 0.7)';
loadingEl.style.color = '#dfe9ff';
loadingEl.style.font = '12px/1.2 sans-serif';
loadingEl.style.border = '1px solid rgba(255,255,255,0.14)';
loadingEl.style.zIndex = '20';
loadingEl.textContent = 'Loading fish frames…';
document.body.appendChild(loadingEl);

const debugPanel = document.createElement('div');
debugPanel.style.position = 'fixed';
debugPanel.style.right = '16px';
debugPanel.style.top = '16px';
debugPanel.style.padding = '8px 10px';
debugPanel.style.minWidth = '180px';
debugPanel.style.borderRadius = '8px';
debugPanel.style.background = 'rgba(10, 18, 25, 0.75)';
debugPanel.style.color = '#ecf3ff';
debugPanel.style.font = '11px monospace';
debugPanel.style.border = '1px solid rgba(255,255,255,0.12)';
debugPanel.style.zIndex = '21';
debugPanel.style.display = 'none';
document.body.appendChild(debugPanel);

const startScreen = document.createElement('div');
startScreen.style.position = 'fixed';
startScreen.style.inset = '0';
startScreen.style.display = 'flex';
startScreen.style.alignItems = 'center';
startScreen.style.justifyContent = 'center';
startScreen.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(128,171,214,0.20))';
startScreen.style.backdropFilter = 'blur(12px)';
startScreen.style.webkitBackdropFilter = 'blur(12px)';
startScreen.style.zIndex = '30';
startScreen.style.color = '#edf5ff';
startScreen.style.fontFamily = 'sans-serif';

document.body.appendChild(startScreen);

const startButton = document.createElement('button');
startButton.type = 'button';
startButton.textContent = 'Click to enter';
startButton.style.padding = '14px 22px';
startButton.style.border = '1px solid rgba(255,255,255,0.45)';
startButton.style.borderRadius = '999px';
startButton.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.42), rgba(175,212,246,0.12))';
startButton.style.color = '#f4fbff';
startButton.style.cursor = 'pointer';
startButton.style.fontSize = '15px';
startButton.style.letterSpacing = '0.02em';
startButton.style.boxShadow = '0 12px 24px rgba(56, 118, 168, 0.22), inset 0 1px 0 rgba(255,255,255,0.45)';
startButton.style.backdropFilter = 'blur(8px)';
startButton.style.webkitBackdropFilter = 'blur(8px)';
startScreen.appendChild(startButton);

const muteButton = document.createElement('button');
muteButton.type = 'button';
muteButton.textContent = 'Mute';
muteButton.style.position = 'fixed';
muteButton.style.right = '16px';
muteButton.style.bottom = '16px';
muteButton.style.padding = '8px 12px';
muteButton.style.borderRadius = '999px';
muteButton.style.border = '1px solid rgba(255,255,255,0.45)';
muteButton.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.34), rgba(136,190,236,0.12))';
muteButton.style.color = '#edf5ff';
muteButton.style.cursor = 'pointer';
muteButton.style.zIndex = '23';
muteButton.style.fontSize = '12px';
muteButton.style.boxShadow = '0 8px 18px rgba(63,103,145,0.18), inset 0 1px 0 rgba(255,255,255,0.38)';
muteButton.style.backdropFilter = 'blur(8px)';
muteButton.style.webkitBackdropFilter = 'blur(8px)';
document.body.appendChild(muteButton);

const framePreview = document.createElement('img');
framePreview.alt = 'Current fish frame preview';
framePreview.style.position = 'fixed';
framePreview.style.right = '16px';
framePreview.style.bottom = '16px';
framePreview.style.width = '256px';
framePreview.style.height = '256px';
framePreview.style.objectFit = 'contain';
framePreview.style.borderRadius = '8px';
framePreview.style.border = '1px solid rgba(255,255,255,0.14)';
framePreview.style.background = 'rgba(10,18,25,0.8)';
framePreview.style.padding = '4px';
framePreview.style.boxShadow = '0 10px 30px rgba(0,0,0,0.28)';
framePreview.style.display = 'none';
framePreview.style.zIndex = '22';
document.body.appendChild(framePreview);

function setLoadingState(isLoading, text = 'Loading fish frames…') {
  loadingEl.style.display = isLoading ? 'block' : 'none';
  loadingEl.textContent = text;
}

function updateDebugPanel() {
  if (!state.debugVisible) {
    debugPanel.style.display = 'none';
    return;
  }

  const audioSummary = state.audioVersions.length
    ? state.audioVersions.map((version) => `${version.name}:${(state.audioGainValues[version.index] ?? 0).toFixed(2)}`).join(' | ')
    : 'audio: none';

  debugPanel.innerText = [
    `azimuth: ${THREE.MathUtils.radToDeg(state.azimuth).toFixed(1)}°`,
    `t: ${state.t.toFixed(3)}`,
    `frameA: ${state.frameA}`,
    `frameB: ${state.frameB}`,
    `uMix: ${state.uMix.toFixed(3)}`,
    `manual: ${state.manualMode ? 'on' : 'off'}`,
    `audio: ${audioSummary}`,
    `ripples: ${state.rippleData.length}`,
  ].join('\n');
  debugPanel.style.display = 'block';
}

function getCurrentAngleT() {
  let t = state.manualMode ? state.manualT : ((controls.getAzimuthalAngle() - AZ_MIN) / (AZ_MAX - AZ_MIN || 1));
  t = THREE.MathUtils.clamp(t, 0, 1);
  if (REVERSE && !state.manualMode) t = 1 - t;
  return t;
}

function createCheckerTexture() {
  const size = 64;
  const checker = document.createElement('canvas');
  checker.width = size;
  checker.height = size;
  const ctx = checker.getContext('2d');

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#dfe7ee' : '#6a7d8d';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const texture = new THREE.CanvasTexture(checker);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function normaliseFrameTexture(texture) {
  if (!texture) return texture;

  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  texture.rotation = 0;
  texture.center.set(0, 0);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

function textureAuditRow(index, texture) {
  const image = texture && texture.image ? texture.image : {};

  return {
    index,
    width: image.width ?? null,
    height: image.height ?? null,
    wrapS: texture?.wrapS ?? null,
    wrapT: texture?.wrapT ?? null,
    repeat: texture?.repeat ? { x: texture.repeat.x, y: texture.repeat.y } : null,
    offset: texture?.offset ? { x: texture.offset.x, y: texture.offset.y } : null,
    rotation: texture?.rotation ?? null,
    center: texture?.center ? { x: texture.center.x, y: texture.center.y } : null,
    flipY: texture?.flipY ?? null,
    colorSpace: texture?.colorSpace ?? null,
    channel: texture?.channel ?? null,
    minFilter: texture?.minFilter ?? null,
    magFilter: texture?.magFilter ?? null,
    generateMipmaps: texture?.generateMipmaps ?? null,
  };
}

function updateFramePreview() {
  if (!state.previewVisible || !state.frameTextures.length) {
    framePreview.style.display = 'none';
    return;
  }

  const currentTexture = state.frameTextures[state.frameA] || state.frameTextures[0];
  if (!currentTexture || !currentTexture.image) {
    framePreview.style.display = 'none';
    return;
  }

  const image = currentTexture.image;
  const source = image.currentSrc || image.src || '';
  framePreview.src = source;
  framePreview.style.display = 'block';
}

function parseTapData(versionName, payload) {
  const tapList = payload?.extras?.tap_map?.taps ?? payload?.tap_map?.taps ?? payload?.taps ?? null;
  const masterMs = payload?.extras?.tap_map?.master_ms ?? payload?.tap_map?.master_ms ?? payload?.master_ms ?? null;

  if (!Array.isArray(tapList)) {
    console.warn(`[audio] No tap list found for ${versionName}. Tried json.extras.tap_map.taps, json.tap_map.taps, and json.taps.`);
    return { taps: [], masterMs: null };
  }

  return {
    taps: tapList
      .filter((tap) => tap && typeof tap.time_ms === 'number')
      .map((tap) => ({
        ...tap,
        time_ms: Number(tap.time_ms),
        level: Number(tap.level ?? 0),
        pan: Number(tap.pan ?? 0),
      }))
      .sort((a, b) => a.time_ms - b.time_ms),
    masterMs: masterMs == null ? null : Number(masterMs),
  };
}

function formatTapSummary(taps) {
  return (taps || []).slice(0, 3).map((tap) => `(${Number(tap.time_ms ?? 0)}, ${Number(tap.level ?? 0).toFixed(3)}, ${Number(tap.pan ?? 0).toFixed(3)})`).join(' | ');
}

async function loadAudioVersions() {
  try {
    const response = await fetch('/audio/manifest.json');
    if (!response.ok) {
      throw new Error(`Audio manifest fetch failed: ${response.status}`);
    }

    const manifest = await response.json();
    if (!Array.isArray(manifest)) {
      throw new Error('Audio manifest is malformed.');
    }

    const versionLoads = manifest.map(async (entry) => {
      const audioPath = `./audio/${entry.files.audio}`;
      const tapsPath = `./audio/${entry.files.taps}`;

      try {
        const [audioResponse, tapResponse] = await Promise.all([
          fetch(audioPath),
          fetch(tapsPath),
        ]);

        if (!audioResponse.ok) {
          throw new Error(`Audio file not found: ${audioPath}`);
        }

        if (!tapResponse.ok) {
          throw new Error(`Tap file not found: ${tapsPath}`);
        }

        const [audioBuffer, tapData] = await Promise.all([
          audioResponse.arrayBuffer().then((arrayBuffer) => new Promise((resolve, reject) => {
            const ctx = state.audioContext || new (window.AudioContext || window.webkitAudioContext)();
            ctx.decodeAudioData(arrayBuffer.slice(0), (decoded) => resolve(decoded), (error) => reject(error));
          })),
          tapResponse.json(),
        ]);

        const parsedTapData = parseTapData(entry.name, tapData);
        return {
          ...entry,
          buffer: audioBuffer,
          taps: parsedTapData.taps,
          masterMs: parsedTapData.masterMs,
        };
      } catch (error) {
        console.warn(`[audio] Failed to load ${entry.name}.`, error);
        return null;
      }
    });

    const loaded = (await Promise.all(versionLoads)).filter(Boolean);
    state.audioVersions = loaded.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    state.audioVersions.forEach((version) => {
      console.log(`[audio] ${version.name}: duration=${version.buffer.duration.toFixed(2)}s, taps=${version.taps.length}`);
    });

    console.table(state.audioVersions.map((version) => {
      const taps = Array.isArray(version.taps) ? version.taps : [];
      const maxTimeMs = taps.length ? Math.max(...taps.map((tap) => Number(tap.time_ms ?? 0))) : 0;
      const meanLevel = taps.length ? taps.reduce((sum, tap) => sum + Number(tap.level ?? 0), 0) / taps.length : 0;
      return {
        name: version.name,
        taps_in_file: taps.length,
        max_time_ms: maxTimeMs,
        mean_level: Number(meanLevel).toFixed(3),
        first_3_taps: formatTapSummary(taps),
      };
    }));

    if (!state.audioVersions.length) {
      console.warn('[audio] No audio versions loaded; the scene will continue without sound.');
    }
  } catch (error) {
    console.warn('[audio] Audio manifest unavailable. Continuing silently.', error);
  }
}

function createAudioContext() {
  if (state.audioContext) {
    return state.audioContext;
  }

  const AudioCtxCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtxCtor) {
    console.warn('[audio] Web Audio API is not available in this browser.');
    return null;
  }

  state.audioContext = new AudioCtxCtor();
  return state.audioContext;
}

async function unlockAudio() {
  const ctx = createAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  if (!state.audioVersions.length) {
    await loadAudioVersions();
  }

  if (!state.audioStarted && state.audioVersions.length) {
    startAudioCrossfade();
  }

  state.audioUnlocked = true;
  startScreen.remove();
}

function setMuteState(isMuted) {
  state.audioMuted = isMuted;
  muteButton.textContent = isMuted ? 'Unmute' : 'Mute';

  if (state.audioContext && state.audioGainNodes.length) {
    const gainValue = isMuted ? 0 : 1;
    state.audioGainNodes.forEach((gainNode) => {
      gainNode.gain.setTargetAtTime(gainValue, state.audioContext.currentTime, 0.05);
    });
  }
}

function startAudioCrossfade() {
  const ctx = state.audioContext;
  if (!ctx || !state.audioVersions.length) {
    return;
  }

  if (state.audioStarted) {
    return;
  }

  const loopEnd = Math.min(...state.audioVersions.map((version) => version.buffer.duration));
  const startAt = ctx.currentTime + 0.05;

  state.audioSources = [];
  state.audioGainNodes = [];
  state.audioGainValues = new Array(state.audioVersions.length).fill(0);

  state.audioVersions.forEach((version) => {
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = version.buffer;
    source.loop = true;
    source.loopEnd = loopEnd;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    gainNode.gain.setValueAtTime(0, startAt);
    source.start(startAt);

    state.audioSources.push(source);
    state.audioGainNodes.push(gainNode);
    version.gainNode = gainNode;
    version.source = source;
  });

  state.audioStarted = true;
  updateAudioMix();
}

function updateAudioMix() {
  const ctx = state.audioContext;
  if (!ctx || !state.audioVersions.length || !state.audioGainNodes.length) {
    return;
  }

  const t = getCurrentAngleT();
  const versionCount = state.audioVersions.length;
  const p = t * (versionCount - 1);
  const a = Math.floor(p);
  const b = Math.min(a + 1, versionCount - 1);
  const f = p - a;
  const gainA = Math.cos(f * (Math.PI / 2));
  const gainB = Math.sin(f * (Math.PI / 2));

  state.audioVersions.forEach((version) => {
    const index = version.index ?? 0;
    const target = index === a ? gainA : index === b ? gainB : 0;
    const activeGain = state.audioMuted ? 0 : target;
    state.audioGainValues[index] = activeGain;
    version.gainNode.gain.setTargetAtTime(activeGain, ctx.currentTime, 0.05);
  });

  updateDebugPanel();
}

function getCurrentVersionAtT(t = getCurrentAngleT()) {
  if (!state.audioVersions.length) {
    return { name: 'fallback', taps: [], gain: 1 };
  }

  const versionCount = state.audioVersions.length;
  const p = t * (versionCount - 1);
  const a = Math.floor(p);
  const b = Math.min(a + 1, versionCount - 1);
  const f = p - a;
  const aWeight = 1 - f;
  const bWeight = f;

  return aWeight >= bWeight
    ? state.audioVersions[a]
    : state.audioVersions[b];
}

function triggerSplashNow() {
  if (!state.water) {
    return;
  }

  const baseVersion = getCurrentVersionAtT();

  const fallbackTaps = Array.from({ length: 8 }, (_, index) => ({
    time_ms: index * 240,
    level: 0.7 + index * 0.08,
    pan: ((index % 5) - 2) * 0.2,
  }));

  const fileTaps = Array.isArray(baseVersion?.taps) && baseVersion.taps.length ? baseVersion.taps : fallbackTaps;
  const energy = getCurrentAngleT();
  const amplitudeScale = THREE.MathUtils.lerp(0.6, 1.6, energy);
  const wavelengthScale = THREE.MathUtils.lerp(1.0, 0.5, energy);

  const splashStart = clock.getElapsedTime();
  const rankedTaps = [...fileTaps]
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0));

  const selectedTaps = rankedTaps.length > MAX_RIPPLES_PER_SPLASH
    ? rankedTaps.slice(0, MAX_RIPPLES_PER_SPLASH)
    : rankedTaps;

  const orderedTaps = [...selectedTaps].sort((a, b) => (a.time_ms ?? 0) - (b.time_ms ?? 0));
  const tapsDropped = Math.max(0, fileTaps.length - orderedTaps.length);
  const timeSpanMs = orderedTaps.length ? Math.max(...orderedTaps.map((tap) => Number(tap.time_ms ?? 0))) - Math.min(...orderedTaps.map((tap) => Number(tap.time_ms ?? 0))) : 0;

  for (const [index, tap] of orderedTaps.entries()) {
    const x = PAN_FOR_X ? (tap.pan ?? 0) * (state.waterSize * 0.62) : (((index % 5) - 2) / 4) * state.waterSize;
    const z = (((index * 13.17) % 1) - 0.5) * state.waterSize;
    const amplitude = Math.max(0.7, amplitudeScale * (1.0 + ((tap.level ?? 0.7) * 0.8)));

    state.rippleData.push({
      x,
      z,
      startTime: splashStart + (tap.time_ms ?? index * 0.24) / 1000,
      amplitude,
      wavelengthScale,
    });

    if (state.rippleData.length > MAX_RIPPLES) {
      state.rippleData.shift();
    }
  }

  console.log(
    '[water splash]',
    baseVersion.name,
    fileTaps.length,
    orderedTaps.length,
    tapsDropped,
    timeSpanMs,
    Number(amplitudeScale).toFixed(3),
    Number(wavelengthScale).toFixed(3)
  );
}

const loader = new GLTFLoader();

function findFishMaterial(root) {
  let fishMaterial = null;
  root.traverse((obj) => {
    if (obj.isMesh && obj.material && obj.material.map && obj.material instanceof THREE.MeshStandardMaterial && !fishMaterial) {
      fishMaterial = obj.material;
    }
  });
  return fishMaterial;
}

function setMaterialBlend(material) {
  if (!(material instanceof THREE.MeshStandardMaterial)) {
    console.warn('Expected fish material to be MeshStandardMaterial, received:', material && material.type);
    return;
  }

  material.envMapIntensity = 0.8;
  material.emissive = new THREE.Color(0xa9ddff);
  material.emissiveIntensity = 0.06;
  material.needsUpdate = true;
  state.fishMaterial = material;

  const originalMap = material.map;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMapA = { value: originalMap || null };
    shader.uniforms.uMapB = { value: originalMap || null };
    shader.uniforms.uMix = { value: 0.0 };

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
uniform sampler2D uMapA;
uniform sampler2D uMapB;
uniform float uMix;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
        vec4 texelA = texture2D(uMapA, vMapUv);
        vec4 texelB = texture2D(uMapB, vMapUv);
        vec4 blendedMap = mix(texelA, texelB, uMix);
        diffuseColor *= blendedMap;
      `
    );

    material.userData.shader = shader;
  };
};

function updateFrameBlend() {
  if (!state.fishMaterial) return;

  const shader = state.fishMaterial.userData.shader;
  if (!shader) return;

  if (state.checkerEnabled && state.checkerTexture) {
    shader.uniforms.uMapA.value = state.checkerTexture;
    shader.uniforms.uMapB.value = state.checkerTexture;
    shader.uniforms.uMix.value = 0;
    return;
  }

  if (!state.frameTextures.length) {
    shader.uniforms.uMapA.value = state.fishMaterial.map || null;
    shader.uniforms.uMapB.value = state.fishMaterial.map || null;
    shader.uniforms.uMix.value = 0;
    return;
  }

  const t = getCurrentAngleT();

  const framePosition = t * (state.frameTextures.length - 1);
  const frameA = Math.floor(framePosition);
  const frameB = Math.min(frameA + 1, state.frameTextures.length - 1);
  let uMix = framePosition - frameA;
  if (Math.abs(uMix) < 1e-8) uMix = 0;

  const texA = state.frameTextures[frameA] || state.frameTextures[0];
  const texB = state.frameTextures[frameB] || state.frameTextures[state.frameTextures.length - 1];

  shader.uniforms.uMapA.value = texA;
  shader.uniforms.uMapB.value = texB;
  shader.uniforms.uMix.value = uMix;

  state.azimuth = controls.getAzimuthalAngle();
  state.t = t;
  state.frameA = frameA;
  state.frameB = frameB;
  state.uMix = uMix;
  updateFramePreview();
  updateDebugPanel();
}

function logMeshReport(root) {
  const entries = [];
  root.traverse((obj) => {
    if (obj.isMesh) {
      entries.push({
        name: obj.name || '(unnamed)',
        material: obj.material && obj.material.name ? obj.material.name : 'none',
        hasUV: !!(obj.geometry && obj.geometry.attributes && obj.geometry.attributes.uv),
      });
    }
  });

  console.log('Mesh report:\n' + entries.map((entry) => `${entry.name} | material: ${entry.material} | uv: ${entry.hasUV}`).join('\n'));
}

function createWaterSurface() {
  const geometry = new THREE.PlaneGeometry(state.waterSize, state.waterSize, 160, 160);
  const rippleUniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uAmplitudeScale: { value: 1.0 },
    uWavelengthScale: { value: 1.0 },
    uRippleData: {
      value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, 0, 0)),
    },
  };

  const material = new THREE.ShaderMaterial({
    uniforms: rippleUniforms,
    transparent: true,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform vec4 uRippleData[${MAX_RIPPLES}];
      uniform float uTime;
      uniform float uEnergy;
      uniform float uAmplitudeScale;
      uniform float uWavelengthScale;
      varying vec2 vUv;
      varying float vWave;

      void main() {
        vec3 pos = position;
        vec2 uv = pos.xz;
        float wave = 0.0;

        float globalWave = sin((uv.x + uTime * 0.7) * 2.0) * 0.08 + sin((uv.y - uTime * 0.9) * 2.6) * 0.08;
        wave += globalWave;

        for (int i = 0; i < ${MAX_RIPPLES}; i++) {
          vec4 ripple = uRippleData[i];
          if (ripple.w <= 0.0) continue;

          float age = uTime - ripple.z;
          if (age < 0.0) continue;

          vec2 delta = uv - ripple.xz;
          float dist = length(delta);
          float ring = sin(dist * (11.0 * uWavelengthScale) - age * 14.0) * exp(-dist * 1.1) * ripple.w;
          wave += ring * (0.52 + uEnergy * 0.35) * uAmplitudeScale;
        }

        pos.y += wave;
        vUv = uv;
        vWave = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vWave;

      void main() {
        vec3 base = vec3(0.08, 0.34, 0.60);
        vec3 highlight = vec3(0.56, 0.85, 1.0);
        float crest = smoothstep(0.0, 0.22, vWave);
        float shimmer = 0.18 + sin(vUv.x * 18.0 + vUv.y * 16.0 + vWave * 24.0) * 0.14;
        vec3 color = mix(base, highlight, clamp(crest + shimmer, 0.0, 1.0));
        gl_FragColor = vec4(color, 0.96);
      }
    `,
  });

  const water = new THREE.Mesh(geometry, material);
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  state.waterMaterial = material;
  state.water = water;
  scene.add(water);
}

function updateWaterRipples() {
  if (!state.waterMaterial) {
    return;
  }

  const now = clock.getElapsedTime();
  state.rippleData = state.rippleData.filter((ripple) => now - ripple.startTime < 5.5);

  const energy = getCurrentAngleT();
  const amplitudeScale = THREE.MathUtils.lerp(0.6, 1.6, energy);
  const wavelengthScale = THREE.MathUtils.lerp(1.0, 0.5, energy);

  const values = Array.from({ length: MAX_RIPPLES }, (_, index) => {
    const ripple = state.rippleData[index];
    if (!ripple) {
      return new THREE.Vector4(0, 0, 0, 0);
    }

    const age = now - ripple.startTime;
    const amplitude = Math.max(0, ripple.amplitude * (1.0 - age / 5.5));
    return new THREE.Vector4(ripple.x, ripple.z, ripple.startTime, amplitude);
  });

  state.waterMaterial.uniforms.uTime.value = now;
  state.waterMaterial.uniforms.uEnergy.value = energy;
  state.waterMaterial.uniforms.uAmplitudeScale.value = amplitudeScale;
  state.waterMaterial.uniforms.uWavelengthScale.value = wavelengthScale;
  state.waterMaterial.uniforms.uRippleData.value = values;
}

function show(obj) {
  if (state.current) scene.remove(state.current);
  state.current = obj;

  const meshMaterial = findFishMaterial(obj);
  if (meshMaterial) setMaterialBlend(meshMaterial);

  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3()).length() || 1;
  obj.scale.multiplyScalar(2 / size);
  box.setFromObject(obj);
  obj.position.sub(box.getCenter(new THREE.Vector3()));

  const waterY = (box.min && box.min.y !== undefined ? box.min.y : 0) - 0.18;
  state.waterY = waterY;
  if (!state.water) {
    createWaterSurface();
  }
  if (state.water) {
    state.water.position.set(0, waterY, 0);
  }

  scene.add(obj);
  updateFrameBlend();
}

function placeholder() {
  show(new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 3),
    new THREE.MeshStandardMaterial({ color: 0x9aa7b8, roughness: 0.6, metalness: 0.2 })
  ));
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    const texture = new THREE.TextureLoader().load(
      url,
      (loadedTexture) => {
        loadedTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        normaliseFrameTexture(loadedTexture);
        resolve(loadedTexture);
      },
      undefined,
      (error) => reject(error)
    );
    return texture;
  });
}

async function loadFrameTextures() {
  setLoadingState(true, 'Loading fish frames…');

  try {
    const response = await fetch(`${FRAMES_DIR}/manifest.json`);
    if (!response.ok) {
      throw new Error(`Manifest fetch failed: ${response.status}`);
    }

    const manifest = await response.json();
    if (!Array.isArray(manifest) || manifest.length === 0) {
      throw new Error('Manifest is empty or malformed.');
    }

    const sorted = [...manifest].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const textures = [];

    for (const entry of sorted) {
      const url = `${FRAMES_DIR}/${entry.file}`;
      try {
        const texture = await loadTexture(url);
        textures.push(texture);
      } catch (error) {
        console.warn(`Failed to load fish frame ${url}. Keeping the model's original texture.`, error);
      }
    }

    if (textures.length === 0) {
      throw new Error('No textures were loaded from the frame folder.');
    }

    state.frameTextures = textures.map((texture) => normaliseFrameTexture(texture));
    setLoadingState(false, 'Fish frames ready');
    console.table(state.frameTextures.map((texture, index) => textureAuditRow(index, texture)));
    console.log(`Loaded ${textures.length} fish frames from ${FRAMES_DIR}. First frame: ${textures[0].image.width}x${textures[0].image.height}. Last frame: ${textures[textures.length - 1].image.width}x${textures[textures.length - 1].image.height}.`);
  } catch (error) {
    console.warn('Missing fish frame set. Keeping the original material map instead of the baked frame blend.', error);
    state.frameTextures = [];
    setLoadingState(false, 'Fish frames unavailable');
  }

  updateFrameBlend();
}

function loadUrl(url) {
  loader.load(url, (gltf) => show(gltf.scene), undefined, () => placeholder());
}

fetch('./models/asset.glb')
  .then((response) => {
    if (response.ok && !response.headers.get('content-type')?.includes('html')) {
      loadUrl('./models/asset.glb');
      return;
    }
    placeholder();
  })
  .catch(() => placeholder());

loadFrameTextures();
loadAudioVersions();

startButton.addEventListener('click', async () => {
  await unlockAudio();
});

muteButton.addEventListener('click', () => {
  setMuteState(!state.audioMuted);
});

const drop = document.getElementById('drop');
addEventListener('dragover', (event) => {
  event.preventDefault();
  drop.classList.add('on');
});
addEventListener('dragleave', () => drop.classList.remove('on'));
addEventListener('drop', (event) => {
  event.preventDefault();
  drop.classList.remove('on');
  const file = event.dataTransfer.files[0];
  if (file && /\.(glb|gltf)$/i.test(file.name)) {
    loadUrl(URL.createObjectURL(file));
  }
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();

  if (key === 'd') {
    state.debugVisible = !state.debugVisible;
    updateDebugPanel();
  }

  if (key === 'f') {
    state.previewVisible = !state.previewVisible;
    updateFramePreview();
  }

  if (key === 'p') {
    triggerSplashNow();
  }

  if (key === 'c') {
    state.checkerEnabled = !state.checkerEnabled;
    if (!state.checkerTexture) state.checkerTexture = createCheckerTexture();
    updateFrameBlend();
  }

  if (key === 'l' && state.current) {
    logMeshReport(state.current);
  }

  if (key === 'm') {
    state.manualMode = !state.manualMode;
    controls.enabled = !state.manualMode;
    updateDebugPanel();
    return;
  }

  if (state.manualMode) {
    if (event.key === 'ArrowLeft') {
      const step = event.shiftKey ? 1 / Math.max(state.frameTextures.length - 1, 1) : 0.01;
      state.manualT = THREE.MathUtils.clamp(state.manualT - step, 0, 1);
      updateFrameBlend();
    }
    if (event.key === 'ArrowRight') {
      const step = event.shiftKey ? 1 / Math.max(state.frameTextures.length - 1, 1) : 0.01;
      state.manualT = THREE.MathUtils.clamp(state.manualT + step, 0, 1);
      updateFrameBlend();
    }
  }
});

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  composer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(() => {
  controls.update();
  updateFrameBlend();
  updateAudioMix();
  const now = clock.getElapsedTime();
  if (now - state.lastSplashAt >= SPLASH_INTERVAL_S) {
    triggerSplashNow();
    state.lastSplashAt = now;
  }
  updateWaterRipples();
  composer.render();
});
