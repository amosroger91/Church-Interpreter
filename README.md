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
revises its guess as more audio arrives. The chunker (`src/lib/chunker.js`)
treats a word as stable once two consecutive guesses agree on it. Stable
words are sent in short chunks, cut before natural phrase boundaries ("and",
"because", "that", …) where possible. If translations fall behind, the chunks
waiting in line are merged into one request, and the Spanish voice speeds up a
little to catch up.

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
npm run build          # static site in dist/
```

If you skip `fetch-models`, the app downloads the models from Hugging Face and
the vosk-browser demo site the first time instead.

## Deploying to GitHub Pages

The `.github/workflows/deploy.yml` workflow tests, downloads the models,
builds and deploys on every push to `main`. One-time setup: **Settings → Pages
→ Build and deployment → Source: GitHub Actions**.

## Limitations

- The small offline English model is fast but less accurate than cloud
  recognition, especially with heavy accents, music or room echo. A direct feed
  from the sound board helps a lot.
- Translating short fragments loses some context. Spanish word order or gender
  agreement can occasionally be off. That's the trade-off for not waiting for
  sentences to end.
- Speech recognition needs microphone permission and a secure origin. GitHub
  Pages is HTTPS, so this works there.
