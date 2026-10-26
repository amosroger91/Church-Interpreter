// Quality / latency benchmark for the interpretation pipeline.
//
// Replays English passages word by word, the way a streaming recognizer
// delivers them (lowercase, no punctuation), through each translation
// strategy, and scores the Spanish against human reference translations.
//
//   npm run fetch-models && node eval/eval.mjs [--verbose] [--only=name,...]
//
// Metrics
//   chrF     character n-gram F-score vs. the reference (0-100, higher = better)
//   lag      average number of English words heard that are not yet
//            reflected in committed Spanish (lower = more simultaneous)
//   repeats  adjacent duplicated words in the output (a common failure)
//   ms/call  average model time per translation call
import { readFileSync } from 'node:fs';
import { env, AutoTokenizer, AutoModelForSeq2SeqLM } from '@huggingface/transformers';
import { SIMUL_PACES, SimulTranslator } from '../src/lib/simul.js';
import { StreamChunker } from '../src/lib/chunker.js';
import { SourceTracker } from '../src/lib/sourceTracker.js';
import { prepareEnglish, tidySpanish } from '../src/lib/text.js';
import { chrF } from './metrics.mjs';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');

env.allowRemoteModels = false;
env.localModelPath = new URL('../public/models/', import.meta.url).pathname;
const MODEL = 'Xenova/opus-mt-en-es';
const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
const model = await AutoModelForSeq2SeqLM.from_pretrained(MODEL, { dtype: 'q8' });

const passages = JSON.parse(readFileSync(new URL('./passages.json', import.meta.url)));

function asrWords(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

function countRepeats(text) {
  const w = text.toLowerCase().split(/\s+/);
  let n = 0;
  for (let i = 1; i < w.length; i++) if (w[i] && w[i] === w[i - 1]) n++;
  return n;
}

// Every strategy receives words one at a time and returns the Spanish it has
// committed so far after each word (for the lag metric) and at the end.

/** Upper bound: translate the whole passage at once after it ends. */
async function offline(words, translate) {
  const es = await translate(prepareEnglish(words.join(' '), { start: true }));
  return { es, committedAfterWord: words.map((_, i) => (i === words.length - 1 ? es : '')) };
}

/** The original fragment approach (chunks translated independently). */
function fragment(pace) {
  return async (words, translate) => {
    const pieces = [];
    const queue = [];
    const chunker = new StreamChunker({ ...pace, onCommit: (c) => queue.push(c) });
    const committedAfterWord = [];
    let t = 0;
    const flush = async () => {
      while (queue.length) {
        const c = queue.shift();
        if (!c.text) continue;
        pieces.push(tidySpanish(await translate(prepareEnglish(c.text, { start: c.start })), { final: c.final }));
      }
    };
    for (let i = 0; i < words.length; i++) {
      t += 400; // ~150 words per minute
      chunker.update(words.slice(0, i + 1).join(' '), t);
      chunker.tick(t);
      await flush();
      committedAfterWord.push(pieces.join(' '));
    }
    chunker.finalize(words.join(' '), t);
    await flush();
    committedAfterWord[words.length - 1] = pieces.join(' ');
    return { es: pieces.join(' '), committedAfterWord };
  };
}

/** Sentence-aware re-translation with prefix forcing and local agreement. */
function simul(opts) {
  return async (words, translate) => {
    const st = new SimulTranslator({ tokenizer, model, ...opts });
    st._generate = timedGenerate(st._generate.bind(st));
    let out = '';
    const queue = [];
    const tracker = new SourceTracker({
      maxSegmentWords: opts.maxSegmentWords ?? 30,
      onSegment: (s) => queue.push(s),
    });
    const committedAfterWord = [];
    const flush = async () => {
      while (queue.length) {
        const s = queue.shift();
        const r = await st.step(s.segId, prepareEnglish(s.text, { start: s.start }), s.final);
        if (r.committed) out = (out + ' ' + r.committed).trim();
        if (verbose) console.log(`    ${s.final ? 'F' : ' '} ${s.text.split(' ').slice(-6).join(' ').padEnd(40)} +${JSON.stringify(r.committed)} ~${JSON.stringify(r.tentative)}`);
      }
    };
    let t = 0;
    for (let i = 0; i < words.length; i++) {
      t += 400;
      // One hypothesis per word: the newest word only becomes stable when
      // the next hypothesis confirms it, as with a real recognizer.
      tracker.update(words.slice(0, i + 1).join(' '), t);
      await flush();
      committedAfterWord.push(out);
    }
    tracker.finalize(words.join(' '));
    await flush();
    committedAfterWord[words.length - 1] = out;
    return { es: out, committedAfterWord };
  };
}

const stats = { ms: 0, calls: 0 };
function timedGenerate(fn) {
  return async (...a) => {
    const t0 = performance.now();
    const r = await fn(...a);
    stats.ms += performance.now() - t0;
    stats.calls++;
    return r;
  };
}

const base = new SimulTranslator({ tokenizer, model });
base._generate = timedGenerate(base._generate.bind(base));
const translate = (text) => base.translate(text);

/** Average lag in source words: words heard minus words "covered" by output. */
function lagOf(words, committedAfterWord, finalEs) {
  const total = Math.max(1, finalEs.split(/\s+/).length);
  let sum = 0;
  committedAfterWord.forEach((es, i) => {
    const produced = es ? es.split(/\s+/).length : 0;
    const covered = (produced / total) * words.length;
    sum += Math.max(0, i + 1 - covered);
  });
  return sum / words.length;
}

const STRATEGIES = {
  offline: offline,
  'fragment-balanced': fragment({ minWords: 3, maxWords: 7, maxWaitMs: 1200 }),
  'simul-fast': simul(SIMUL_PACES.fast),
  'simul-balanced': simul(SIMUL_PACES.balanced),
  'simul-a3': simul({ agreeDepth: 3, holdBackWords: 0, minSourceWords: 0 }),
};

const rows = [];
for (const [name, run] of Object.entries(STRATEGIES)) {
  if (only && !only.includes(name)) continue;
  stats.ms = 0;
  stats.calls = 0;
  let chrfSum = 0;
  let lagSum = 0;
  let reps = 0;
  if (verbose) console.log(`\n=== ${name}`);
  for (const p of passages) {
    const words = asrWords(p.en);
    if (verbose) console.log(`  -- ${p.id}`);
    const { es, committedAfterWord } = await run(words, translate);
    const score = chrF(es, p.es);
    chrfSum += score;
    lagSum += lagOf(words, committedAfterWord, es);
    reps += countRepeats(es);
    if (verbose) console.log(`  ${p.id}: chrF ${score.toFixed(1)}\n    ${es}`);
  }
  process.stderr.write(`done: ${name}\n`);
  rows.push({
    strategy: name,
    chrF: +(chrfSum / passages.length).toFixed(1),
    lag: +(lagSum / passages.length).toFixed(2),
    repeats: reps,
    'ms/call': Math.round(stats.ms / Math.max(1, stats.calls)),
    calls: stats.calls,
  });
}
console.table(rows);
