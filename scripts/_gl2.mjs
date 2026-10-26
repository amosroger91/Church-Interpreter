import { env, AutoTokenizer, AutoModelForSeq2SeqLM } from '@huggingface/transformers';
import { SimulTranslator } from '../src/lib/simul.js';
import { DIRECTIONS, prepareSource, finishTarget } from '../src/lib/languages.js';
env.allowRemoteModels = false;
env.localModelPath = new URL('../public/models/', import.meta.url).pathname;
const dir = 'en-es';
const id = DIRECTIONS[dir].translationModel;
const st = new SimulTranslator({
  tokenizer: await AutoTokenizer.from_pretrained(id),
  model: await AutoModelForSeq2SeqLM.from_pretrained(id, { dtype: 'q8' }),
  postprocess: (t) => finishTarget(t, dir),
  holdWords: new Set(DIRECTIONS[dir].holdWords),
});
for (const s of process.argv.slice(2)) {
  const words = s.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, '').split(/\s+/);
  let out = '';
  for (let i = 1; i <= words.length; i++) {
    const r = await st.step(s, prepareSource(words.slice(0, i).join(' '), dir, { start: true }), i === words.length);
    if (r.committed) out += ' ' + r.committed;
  }
  console.log('EN:', s, '\nES:', out.trim(), '\n');
}
