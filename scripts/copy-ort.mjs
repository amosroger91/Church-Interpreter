// Copies the ONNX Runtime WebAssembly files into public/ort/ so the app
// loads them from its own origin (and can cache them) instead of a CDN.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const root = new URL('../node_modules/', import.meta.url);
const candidates = [
  '@huggingface/transformers/node_modules/onnxruntime-web/dist/',
  'onnxruntime-web/dist/',
].map((p) => new URL(p, root));
const ortDir = candidates.find((d) => existsSync(d));
if (!ortDir) throw new Error('onnxruntime-web not found; run npm install');

const out = new URL('../public/ort/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const f of [
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
]) {
  copyFileSync(new URL(f, ortDir), new URL(f, out));
}
console.log('copied ONNX Runtime WASM to public/ort/');
