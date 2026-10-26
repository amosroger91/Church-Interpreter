import { env, AutoTokenizer, AutoModelForSeq2SeqLM } from '@huggingface/transformers';
import { SimulTranslator } from '../src/lib/simul.js';
env.allowRemoteModels = false;
env.localModelPath = new URL('../public/models/', import.meta.url).pathname;
const id = 'Xenova/opus-mt-en-es';
const st = new SimulTranslator({ tokenizer: await AutoTokenizer.from_pretrained(id), model: await AutoModelForSeq2SeqLM.from_pretrained(id, { dtype: 'q8' }) });
const tests = process.argv.slice(2);
for (const s of tests) console.log(s.padEnd(80), '=>', await st.translate(s));
