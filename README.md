# Intérprete en Vivo — Live English → Spanish Church Interpreter

A web app that listens to a preacher or speaker in English and interprets into
Spanish **continuously, while they talk**. It doesn't wait for a sentence to
end: as soon as a few words are recognized with confidence they are
translated, shown as large captions, and spoken aloud in Spanish.

It's a static site for **GitHub Pages**. There's no backend. Speech
recognition, translation and speech output all run in the browser. After the
first visit it **works offline**.

## How it works

```
microphone ─▶ speech recognition ─▶ stream chunker ─▶ translation ─▶ captions + Spanish voice
              (Vosk, WebAssembly)   (stable words,     (OPUS-MT en→es,
               partial results       3–7 at a time)     ONNX Runtime Web)
               every ~100 ms)
```

| Stage | Technology | Runs offline |
|---|---|---|
| English speech recognition | [Vosk](https://alphacephei.com/vosk/) small English model (~40 MB) compiled to WebAssembly via [`vosk-browser`](https://github.com/ccoreilly/vosk-browser) | ✅ |
| English speech recognition (optional) | Browser Web Speech API. More accurate, but usually sends audio to the browser vendor. | ❌ |
| English → Spanish translation | [Helsinki-NLP OPUS-MT en-es](https://huggingface.co/Helsinki-NLP/opus-mt-en-es) (quantized ONNX, ~80 MB) via [Transformers.js](https://github.com/huggingface/transformers.js) in a Web Worker | ✅ |
| Spanish voice | The device's built-in text-to-speech (`speechSynthesis`). Voices marked "offline" in settings are local. | ✅ (with a local Spanish voice) |

**Streaming without waiting for the sentence to end.** The recognizer
revises its guess as more audio arrives. A word counts as stable once two
consecutive guesses agree on it (`src/lib/sourceTracker.js`).

The default **sentence-aware** mode (`src/lib/simul.js`) re-translates the
whole sentence so far every time a stable word arrives. The Spanish already
shown and spoken is forced as the start of each new translation, so the model
continues the sentence coherently instead of translating disconnected pieces.
New Spanish words are committed (shown in full and spoken) only once
consecutive translations agree on them. The not-yet-certain tail is shown
dimmed. This is the *local agreement* approach from simultaneous-translation
research.

The **classic fragments** mode (`src/lib/chunker.js`) translates each 3–7
word chunk independently. It has the least delay but loses context.

**Prayers and creeds.** When the speaker leads the Lord's Prayer, the
Gloria Patri, the Doxology or the Apostles' Creed, the app recognizes it
after about five words (`src/lib/liturgy.js`). It then shows and speaks the
standard Spanish wording line by line, instead of a machine translation of
a text people know by heart. Small wording differences ("debts" /
"trespasses") are tolerated. If the speaker leaves the text, normal
translation resumes.

**Church vocabulary.** Before translation, words like *God, Jesus, Lord, Holy
Spirit*, biblical names and book names are capitalized
(`src/lib/text.js`). That way the translator renders them as *Dios, Jesús,
Señor, Espíritu Santo* rather than as common nouns.

## Using it on Sunday

1. Open the site once **with internet** and press **Prepare for offline**. This
   downloads and caches about 120 MB of models.
2. Point a microphone at the speaker, or plug in the sound board feed. Press
   **Start interpreting**.
3. To deliver the Spanish:
   - **Screen:** press **Display mode** and put it on a projector or TV.
   - **Audio:** send the device's audio to headphones, an FM/IR assistive
     listening transmitter, or a separate speaker. Keep the Spanish audio away
     from the microphone so it isn't picked up again.
4. In **Settings**, choose a Spanish voice, a voice speed, a text size and a
   **Pace**: *Fast* has the least delay, *Accurate* gives the translator more
   context.

To test without a microphone, type English into the box under the captions.

## Development

```bash
npm install
npm run fetch-models   # optional: download models into public/models/
npm run dev            # http://localhost:5173
npm test
npm run eval           # quality/latency benchmark (needs fetch-models)
npm run build          # static site in dist/
```

If you skip `fetch-models`, the app downloads the models from Hugging Face and
the vosk-browser demo site the first time instead.

## Measuring quality

`eval/eval.mjs` replays the sermon-style passages in `eval/passages.json`
word by word, as a streaming recognizer would deliver them, through each
translation strategy. It scores the result against human Spanish references
(chrF), and reports lag (English words heard but not yet reflected in
committed Spanish), repeated words, and model time per call. Add your own
church's passages to the JSON file to tune it for your services. The
*Translation quality benchmark* workflow runs it in CI.

## Deploying to GitHub Pages

The `.github/workflows/deploy.yml` workflow tests, downloads the models,
builds, and publishes the site to the `gh-pages` branch on every push to
`main`. One-time setup: **Settings → Pages → Build and deployment → Deploy
from a branch → `gh-pages` / root**.

## Limitations

- The small offline English model is fast but less accurate than cloud
  recognition, especially with heavy accents, music or room echo. A direct feed
  from the sound board helps a lot.
- Translating short fragments loses some context. Spanish word order or gender
  agreement can occasionally be off. That's the trade-off for not waiting for
  sentences to end.
- Speech recognition needs microphone permission and a secure origin. GitHub
  Pages is HTTPS, so this works there.
