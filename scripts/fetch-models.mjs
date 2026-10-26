// Downloads the speech-recognition and translation models into
// public/models/ so the built site serves them itself (no third-party
// hosts needed at runtime). Run automatically by the GitHub Pages workflow;
// run `npm run fetch-models` to do the same locally.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');

const VOSK_MODELS = ['vosk-model-small-en-us-0.15', 'vosk-model-small-es-0.3'];
const voskSources = (name) => [
  `https://ccoreilly.github.io/vosk-browser/models/${name}.tar.gz`,
  // Official zip; repackaged as .tar.gz, the format vosk-browser expects.
  `https://alphacephei.com/vosk/models/${name}.zip`,
];
const TRANSLATION_MODELS = ['Xenova/opus-mt-en-es', 'Xenova/opus-mt-es-en'];
const OPTIONAL = new Set(['generation_config.json']);
const TRANSLATION_FILES = [
  'config.json',
  'generation_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
];

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('  ✓', url);
}

async function fetchVosk(VOSK) {
  const dest = join(outDir, `${VOSK}.tar.gz`);
  if (existsSync(dest)) return console.log(`  • ${VOSK} already present`);
  for (const url of voskSources(VOSK)) {
    try {
      if (url.endsWith('.tar.gz')) {
        await download(url, dest);
      } else {
        const tmp = mkdtempSync(join(tmpdir(), 'vosk-'));
        await download(url, join(tmp, 'model.zip'));
        execFileSync('unzip', ['-q', 'model.zip'], { cwd: tmp });
        execFileSync('tar', ['-czf', dest, VOSK], { cwd: tmp });
        rmSync(tmp, { recursive: true, force: true });
      }
      return;
    } catch (e) {
      console.warn('  ! failed:', e.message);
    }
  }
  throw new Error('Could not download the speech model');
}

async function fetchTranslation(TRANSLATION) {
  for (const f of TRANSLATION_FILES) {
    const dest = join(outDir, TRANSLATION, f);
    if (existsSync(dest)) continue;
    try {
      await download(`https://huggingface.co/${TRANSLATION}/resolve/main/${f}`, dest);
    } catch (e) {
      if (!OPTIONAL.has(f)) throw e;
      console.warn('  ! skipped optional file:', e.message);
    }
  }
}

console.log('Speech models (Vosk):');
for (const m of VOSK_MODELS) await fetchVosk(m);
console.log('Translation models (OPUS-MT):');
for (const m of TRANSLATION_MODELS) await fetchTranslation(m);
console.log('Models saved to', outDir);
