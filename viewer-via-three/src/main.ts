import "./style.css";
import * as THREE from "three";

type WsIncomingMessage =
  | { type: "pos"; x: number; y: number; z: number }
  | { type: string; [key: string]: unknown };

function isPosMessage(value: unknown): value is { type: "pos"; x: number; y: number; z: number } {
  if (typeof value !== "object" || value === null) return false;
  const msg = value as Record<string, unknown>;
  return (
    msg.type === "pos" &&
    typeof msg.x === "number" &&
    typeof msg.y === "number" &&
    typeof msg.z === "number"
  );
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app element");
}

app.innerHTML = `
  <div id="hud">
    <strong>viewer-via-three</strong>
    <span id="status">WS: connecting...</span>
    <span id="pos">pos: -</span>
  </div>
  <canvas id="scene"></canvas>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const statusEl = document.querySelector<HTMLSpanElement>("#status");
const posEl = document.querySelector<HTMLSpanElement>("#pos");

if (!canvas || !statusEl || !posEl) {
  throw new Error("Failed to initialize DOM");
}

const parentOrigin = new URLSearchParams(window.location.search).get("parentOrigin");
if (parentOrigin) {
  window.parent?.postMessage({ type: "viewer-ready" }, parentOrigin);
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111827);

const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
camera.position.set(8, 6, 8);
camera.lookAt(0, 0, 0);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 8, 2);
scene.add(dirLight);

const grid = new THREE.GridHelper(50, 50, 0x374151, 0x1f2937);
scene.add(grid);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x22d3ee }),
);
cube.position.y = 0.5;
scene.add(cube);

const marker = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 24, 24),
  new THREE.MeshStandardMaterial({ color: 0xf59e0b }),
);
marker.position.set(0, 1.2, 0);
scene.add(marker);

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();

const wsUrl =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:3000`;
const ws = new WebSocket(wsUrl);

ws.addEventListener("open", () => {
  statusEl.textContent = `WS: connected (${wsUrl})`;
});

ws.addEventListener("close", () => {
  statusEl.textContent = "WS: disconnected";
});

ws.addEventListener("error", () => {
  statusEl.textContent = "WS: error";
});

ws.addEventListener("message", (event) => {
  try {
    const msg = JSON.parse(String(event.data)) as WsIncomingMessage;
    if (!isPosMessage(msg)) return;
    const { x, y, z } = msg;
    marker.position.set(x, y, z);
    posEl.textContent = `pos: ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`;
  } catch {
    // ignore invalid messages
  }
});
