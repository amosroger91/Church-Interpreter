// Speech-recognition model locations, per spoken language.
// scripts/fetch-models.mjs can download these into public/models/ so the
// app serves them itself; otherwise they come from the vosk-browser site.
// (Translation models are listed in languages.js.)
export const MODELS = {
  speech: {
    en: {
      file: 'vosk-model-small-en-us-0.15.tar.gz',
      fallbackUrl: 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz',
    },
    es: {
      file: 'vosk-model-small-es-0.3.tar.gz',
      fallbackUrl: 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-es-0.3.tar.gz',
    },
  },
};

export function appUrl(path) {
  return new URL(import.meta.env.BASE_URL + path, location.href).href;
}
