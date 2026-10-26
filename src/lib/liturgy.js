// Recognizes well-known liturgical texts in the English stream and supplies
// their standard Spanish wording, line by line, instead of a machine
// translation. Matching is tolerant of small wording differences
// ("who art" / "which art", "trespasses" / "debts").

export const LITURGY = [
  {
    id: 'lords-prayer',
    title: 'Padre Nuestro',
    lines: [
      ['our father who art in heaven', 'Padre nuestro que estás en los cielos,'],
      ['hallowed be thy name', 'santificado sea tu nombre.'],
      ['thy kingdom come', 'Venga tu reino.'],
      ['thy will be done on earth as it is in heaven', 'Hágase tu voluntad, así en la tierra como en el cielo.'],
      ['give us this day our daily bread', 'Danos hoy nuestro pan de cada día.'],
      [
        'and forgive us our trespasses as we forgive those who trespass against us',
        'Perdona nuestras ofensas, como también nosotros perdonamos a los que nos ofenden.',
      ],
      ['and lead us not into temptation', 'No nos dejes caer en la tentación,'],
      ['but deliver us from evil', 'y líbranos del mal.'],
      [
        'for thine is the kingdom and the power and the glory forever and ever amen',
        'Porque tuyo es el reino, el poder y la gloria, por siempre. Amén.',
      ],
    ],
  },
  {
    id: 'gloria-patri',
    title: 'Gloria',
    lines: [
      ['glory be to the father and to the son and to the holy ghost', 'Gloria al Padre, y al Hijo, y al Espíritu Santo.'],
      [
        'as it was in the beginning is now and ever shall be world without end amen amen',
        'Como era en el principio, ahora y siempre, por los siglos de los siglos. Amén.',
      ],
    ],
  },
  {
    id: 'doxology',
    title: 'Doxología',
    lines: [
      ['praise god from whom all blessings flow', 'A Dios el Padre celestial,'],
      ['praise him all creatures here below', 'al Hijo nuestro Redentor,'],
      ['praise him above ye heavenly host', 'al eternal Consolador,'],
      ['praise father son and holy ghost amen', 'unidos todos alabad. Amén.'],
    ],
  },
  {
    id: 'apostles-creed',
    title: 'Credo de los Apóstoles',
    lines: [
      ['i believe in god the father almighty creator of heaven and earth', 'Creo en Dios Padre Todopoderoso, Creador del cielo y de la tierra.'],
      ['and in jesus christ his only son our lord', 'Creo en Jesucristo, su único Hijo, nuestro Señor,'],
      [
        'who was conceived by the holy spirit born of the virgin mary',
        'que fue concebido por obra y gracia del Espíritu Santo, nació de Santa María Virgen,',
      ],
      [
        'suffered under pontius pilate was crucified died and was buried',
        'padeció bajo el poder de Poncio Pilato, fue crucificado, muerto y sepultado,',
      ],
      ['he descended to the dead', 'descendió a los infiernos,'],
      ['on the third day he rose again', 'al tercer día resucitó de entre los muertos,'],
      [
        'he ascended into heaven and is seated at the right hand of the father',
        'subió a los cielos y está sentado a la derecha de Dios, Padre todopoderoso.',
      ],
      ['he will come again to judge the living and the dead', 'Desde allí ha de venir a juzgar a vivos y muertos.'],
      [
        'i believe in the holy spirit the holy catholic church the communion of saints',
        'Creo en el Espíritu Santo, la santa Iglesia católica, la comunión de los santos,',
      ],
      [
        'the forgiveness of sins the resurrection of the body and the life everlasting amen',
        'el perdón de los pecados, la resurrección de la carne y la vida eterna. Amén.',
      ],
    ],
  },
];

export function norm(w) {
  return w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// Word variants that should count as the same word.
const SAME = new Map(
  Object.entries({
    which: 'who',
    thou: 'you',
    debts: 'trespasses',
    debtors: 'trespass',
    spirit: 'ghost',
    maker: 'creator',
  }),
);
const canon = (w) => SAME.get(w) || w;

function prepare(text) {
  const words = [];
  const lineEnds = [];
  text.lines.forEach(([en], li) => {
    for (const w of en.split(' ')) words.push({ w: canon(norm(w)), line: li });
    lineEnds.push(words.length);
  });
  return { ...text, words, lineEnds };
}

export class LiturgyMatcher {
  /**
   * @param {object} opts
   * @param {number} [opts.minMatch] words that must match to recognize a text
   * @param {number} [opts.maxMisses] consecutive unmatched words that end it
   * @param {(e: {start: number}) => void} [opts.onStart] a text was recognized;
   *   `start` is the feed index of its first matched word
   * @param {(e: {es: string, title: string}) => void} [opts.onLine] Spanish line
   * @param {(e: {resumeAt: number}) => void} [opts.onEnd] text finished or
   *   abandoned; normal translation should resume at feed index `resumeAt`
   */
  constructor({ texts = LITURGY, minMatch = 5, maxMisses = 4, onStart, onLine, onEnd } = {}) {
    this.texts = texts.map(prepare);
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

  /** Feed the next stable English word; `index` identifies its position. */
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
        for (let k = 0; k < this.minMatch && misses <= 1; k++) {
          if (t.words[end - this.minMatch + k].w !== this.recent[k]) misses++;
        }
        // The newest word must match, and at most one other may differ.
        if (misses <= 1 && t.words[end - 1].w === w) {
          this.active = { t, pos: end, misses: 0, missStart: null, emitted: t.words[end - this.minMatch].line };
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
    this.onLine({ es: a.t.lines[li][1], title: a.t.title });
    a.emitted = li + 1;
  }

  _finish(resumeAt) {
    this.active = null;
    this.recent = [];
    this.onEnd({ resumeAt });
  }
}
