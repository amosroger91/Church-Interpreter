// Which made-up placeholder names does each translation model copy intact?
// Translates sentences containing candidate names and reports, per style,
// how many came through unchanged. Used to pick the glossary placeholders.
//
//   node eval/probe-placeholders.mjs
import { env, AutoTokenizer, AutoModelForSeq2SeqLM } from '@huggingface/transformers';
import { SimulTranslator } from '../src/lib/simul.js';

env.allowRemoteModels = false;
env.localModelPath = new URL('../public/models/', import.meta.url).pathname;

const STYLES = {
  'x-ano': ['Zorxano', 'Kelxana', 'Brilxanos', 'Morxanas', 'Tolxeno'],
  'x-ex': ['Zorxex', 'Kelxex', 'Brilxex', 'Morxex', 'Tolxex'],
  'vex': ['Zorvex', 'Kelbrin', 'Vandrel', 'Torwick', 'Morlun'],
  'caps': ['ZORX', 'KELX', 'BRILX', 'MORX', 'TOLX'],
  'x-on': ['Zorxon', 'Kelxon', 'Brilxon', 'Morxon', 'Tolxon'],
  'q-ix': ['Qorvix', 'Qelbix', 'Qandrix', 'Qorwix', 'Qorlix'],
};
const CONTEXTS = {
  'es-en': [
    'demos gracias al {} por la alabanza de esta mañana',
    'después del {} tendremos un convivio',
    'los {} van a orar por usted',
    'la {} empieza a las siete de la noche',
    'abran sus biblias en {} capítulo ocho',
    'invite a sus amigos a la {} de esta semana',
  ],
  'en-es': [
    "let's thank the {} for leading us this morning",
    'after the {} we will have a potluck',
    'the {} will pray with you',
    'the {} starts at seven tonight',
    'open your bibles to {} chapter eight',
    'invite your friends to the {} this week',
  ],
};

for (const dir of ['en-es', 'es-en']) {
  const id = `Xenova/opus-mt-${dir}`;
  const st = new SimulTranslator({
    tokenizer: await AutoTokenizer.from_pretrained(id),
    model: await AutoModelForSeq2SeqLM.from_pretrained(id, { dtype: 'q8' }),
  });
  console.log(`\n=== ${dir}`);
  for (const [style, names] of Object.entries(STYLES)) {
    let ok = 0;
    let total = 0;
    const bad = [];
    for (const ctx of CONTEXTS[dir]) {
      for (const name of names) {
        const out = await st.translate(ctx.replace('{}', name));
        total++;
        if (out.includes(name)) ok++;
        else if (bad.length < 3) bad.push(`${name} -> ${out}`);
      }
    }
    console.log(`${style.padEnd(8)} ${ok}/${total}`);
    for (const b of bad) console.log(`    ${b}`);
  }
}
