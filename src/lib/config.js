// Model locations. scripts/fetch-models.mjs downloads these into
// public/models/ at build time so the deployed site is self-contained;
// the remote URLs are only used as a fallback (e.g. in local development).
export const MODELS = {
  speech: {
    file: 'vosk-model-small-en-us-0.15.tar.gz',
    fallbackUrl:
      'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz',
  },
  translation: {
    id: 'Xenova/opus-mt-en-es',
  },
};

export function appUrl(path) {
  return new URL(import.meta.env.BASE_URL + path, location.href).href;
}
