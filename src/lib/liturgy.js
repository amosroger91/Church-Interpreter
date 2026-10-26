// Recognizes well-known liturgical texts in the English stream and supplies
// their standard Spanish wording, line by line, instead of a machine
// translation. Matching is tolerant of small wording differences
// ("who art" / "which art", "trespasses" / "debts").

export const LITURGY = [
  {
    id: 'lords-prayer',
    title: { en: "The Lord's Prayer", es: 'Padre Nuestro' },
    lines: [
      ['Our Father, which art in heaven,', 'Padre nuestro que estás en los cielos,'],
      ['hallowed be thy name.', 'santificado sea tu nombre.'],
      ['Thy kingdom come.', 'Venga tu reino.'],
      ['Thy will be done in earth, as it is in heaven.', 'Hágase tu voluntad, como en el cielo, así también en la tierra.'],
      ['Give us this day our daily bread.', 'El pan nuestro de cada día, dánoslo hoy.'],
      ['And forgive us our debts, as we forgive our debtors.', 'Y perdónanos nuestras deudas, como también nosotros perdonamos a nuestros deudores.'],
      ['And lead us not into temptation,', 'Y no nos metas en tentación,'],
      ['but deliver us from evil:', 'mas líbranos del mal;'],
      [
        'For thine is the kingdom, and the power, and the glory, for ever. Amen.',
        'porque tuyo es el reino, y el poder, y la gloria, por todos los siglos. Amén.',
      ],
    ],
  },
  {
    id: 'gloria-patri',
    title: { en: 'Gloria Patri', es: 'Gloria' },
    lines: [
      ['Glory be to the Father, and to the Son, and to the Holy Ghost;', 'Gloria al Padre, y al Hijo, y al Espíritu Santo.'],
      [
        'as it was in the beginning, is now, and ever shall be, world without end. Amen, amen.',
        'Como era en el principio, ahora y siempre, por los siglos de los siglos. Amén.',
      ],
    ],
  },
  {
    id: 'doxology',
    title: { en: 'Doxology', es: 'Doxología' },
    lines: [
      ['Praise God, from whom all blessings flow;', 'A Dios el Padre celestial,'],
      ['Praise Him, all creatures here below;', 'al Hijo nuestro Redentor,'],
      ['Praise Him above, ye heavenly host;', 'al eternal Consolador,'],
      ['Praise Father, Son, and Holy Ghost. Amen.', 'unidos todos alabad. Amén.'],
    ],
  },
  {
    id: 'apostles-creed',
    title: { en: "Apostles' Creed", es: 'Credo de los Apóstoles' },
    lines: [
      ['I believe in God the Father Almighty, creator of heaven and earth.', 'Creo en Dios Padre Todopoderoso, Creador del cielo y de la tierra.'],
      ['And in Jesus Christ, his only Son, our Lord,', 'Creo en Jesucristo, su único Hijo, nuestro Señor,'],
      [
        'who was conceived by the Holy Spirit, born of the Virgin Mary,',
        'que fue concebido por obra y gracia del Espíritu Santo, nació de Santa María Virgen,',
      ],
      [
        'suffered under Pontius Pilate, was crucified, died, and was buried;',
        'padeció bajo el poder de Poncio Pilato, fue crucificado, muerto y sepultado,',
      ],
      ['he descended to the dead.', 'descendió a los infiernos,'],
      ['On the third day he rose again;', 'al tercer día resucitó de entre los muertos,'],
      [
        'he ascended into heaven, and is seated at the right hand of the Father;',
        'subió a los cielos y está sentado a la derecha de Dios, Padre todopoderoso.',
      ],
      ['he will come again to judge the living and the dead.', 'Desde allí ha de venir a juzgar a vivos y muertos.'],
      [
        'I believe in the Holy Spirit, the holy catholic church, the communion of saints,',
        'Creo en el Espíritu Santo, la santa Iglesia católica, la comunión de los santos,',
      ],
      [
        'the forgiveness of sins, the resurrection of the body, and the life everlasting. Amen.',
        'el perdón de los pecados, la resurrección de la carne y la vida eterna. Amén.',
      ],
    ],
  },
];

export function norm(w) {
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

// Word variants that should count as the same word.
const SAME = new Map(
  Object.entries({
    which: 'who',
    thou: 'you',
    on: 'in',
    debts: 'trespasses',
    debtors: 'trespass',
    spirit: 'ghost',
    maker: 'creator',
    forever: 'for',
    // Spanish variants (Catholic and evangelical wordings)
    cielo: 'cielos',
    ofensas: 'deudas',
    ofenden: 'deudores',
    danos: 'danoslo',
  }),
);
const canon = (w) => SAME.get(w) || w;

// Common words that don't make a match distinctive on their own.
const FILLER = new Set(
  ('the to in of and a an is it be as for us our we he his who that this ' +
    'el la los las de del al a y en que es su tu nos por con se un una').split(' '),
);

const COLUMN = { en: 0, es: 1 };

function prepare(text, from) {
  const words = [];
  const lineEnds = [];
  const to = from === 'en' ? 'es' : 'en';
  text.lines.forEach((line, li) => {
    for (const w of line[COLUMN[from]].split(/\s+/)) {
      const n = canon(norm(w));
      if (n) words.push({ w: n, line: li });
    }
    lineEnds.push(words.length);
  });
  return { ...text, title: text.title[to], out: text.lines.map((l) => l[COLUMN[to]]), words, lineEnds };
}

export class LiturgyMatcher {
  /**
   * @param {object} opts
   * @param {'en'|'es'} [opts.from] language being spoken
   * @param {number} [opts.minMatch] words that must match to recognize a text
   * @param {number} [opts.maxMisses] consecutive unmatched words that end it
   * @param {(e: {start: number}) => void} [opts.onStart] a text was recognized;
   *   `start` is the feed index of its first matched word
   * @param {(e: {text: string, title: string}) => void} [opts.onLine] line in
   *   the other language
   * @param {(e: {resumeAt: number}) => void} [opts.onEnd] text finished or
   *   abandoned; normal translation should resume at feed index `resumeAt`
   */
  constructor({ texts = LITURGY, from = 'en', minMatch = 5, maxMisses = 4, onStart, onLine, onEnd } = {}) {
    this.texts = texts.map((t) => prepare(t, from));
    this.minMatch = minMatch;
    this.maxMisses = maxMisses;
    this.onStart = onStart || (() => {});
    this.onLine = onLine || (() => {});
    this.onEnd = onEnd || (() => {});
    this.recent = [];
    this.active = null;
  }

  get isActive() {
    return Boolean(this.active);
  }

  /** Feed the next stable spoken word; `index` identifies its position. */
  feed(word, index) {
    const w = canon(norm(word));
    if (!w) return;
    if (this.active) this._advance(w, index);
    else this._detect(w, index);
  }

  _detect(w, index) {
    this.recent.push(w);
    if (this.recent.length > this.minMatch) this.recent.shift();
    if (this.recent.length < this.minMatch) return;
    for (const t of this.texts) {
      for (let end = this.minMatch; end <= t.words.length; end++) {
        let misses = 0;
        let meaningful = 0;
        for (let k = 0; k < this.minMatch && misses <= 1; k++) {
          const tw = t.words[end - this.minMatch + k].w;
          if (tw !== this.recent[k]) misses++;
          else if (!FILLER.has(tw)) meaningful++;
        }
        // The newest word must match, at most one other may differ, and the
        // match can't rest on filler words alone ("to the ... in the").
        if (misses <= 1 && meaningful >= 2 && t.words[end - 1].w === w) {
          const startWord = end - this.minMatch;
          const line = t.words[startWord].line;
          const lineStart = line === 0 ? 0 : t.lineEnds[line - 1];
          // Only show lines the speaker said from the beginning.
          const emitted = startWord === lineStart ? line : line + 1;
          this.active = { t, pos: end, misses: 0, missStart: null, emitted };
          this.recent = [];
          this.onStart({ start: index - this.minMatch + 1, title: t.title });
          this._emitCompleted();
          return;
        }
      }
    }
  }

  _advance(w, index) {
    const a = this.active;
    const words = a.t.words;
    // Allow the speaker to skip up to two words of the text.
    for (let skip = 0; skip <= 2 && a.pos + skip < words.length; skip++) {
      if (words[a.pos + skip].w === w) {
        a.pos += skip + 1;
        a.misses = 0;
        a.missStart = null;
        this._emitCompleted();
        if (a.pos >= words.length) this._finish(index + 1);
        return;
      }
    }
    if (a.misses === 0) a.missStart = index;
    a.misses++;
    if (a.misses >= this.maxMisses) {
      // Not following the text anymore: flush a mostly-said line, then hand
      // the unmatched words back to normal translation.
      const line = a.t.words[Math.min(a.pos, words.length - 1)].line;
      const lineStart = line === 0 ? 0 : a.t.lineEnds[line - 1];
      const said = a.pos - lineStart;
      if (line >= a.emitted && said >= (a.t.lineEnds[line] - lineStart) / 2) this._emitLine(line);
      this._finish(a.missStart);
    }
  }

  _emitCompleted() {
    const a = this.active;
    while (a.emitted < a.t.lines.length && a.t.lineEnds[a.emitted] <= a.pos) this._emitLine(a.emitted);
  }

  _emitLine(li) {
    const a = this.active;
    this.onLine({ text: a.t.out[li], title: a.t.title });
    a.emitted = li + 1;
  }

  _finish(resumeAt) {
    this.active = null;
    this.recent = [];
    this.onEnd({ resumeAt });
  }
}
