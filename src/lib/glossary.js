// Church vocabulary for both directions, tuned for Southern US churches and
// Latin American / US Hispanic evangelical congregations.
//
// How it works: the general-purpose translation model doesn't know church
// usage ("praise team" -> "equipo de alabanza" instead of "el conjunto",
// "culto" -> "cult"). Before translating, each glossary term in the source is
// replaced by a made-up placeholder name (e.g. "Zorvex"), which the model
// copies unchanged, in the right place in the sentence. Afterwards the
// placeholder is replaced by the preferred term, fixing the article in front
// of it for gender and number ("un Vandrel" -> "una campaña de avivamiento").
// Southern turns of phrase are first rewritten into plain English the model
// understands ("fixin' to" -> "about to"), and a few predictable model slips
// are corrected afterwards.

// Each term: `en` / `es` are the phrases recognized in that language; the
// first one is also the preferred rendering when translating into it, unless
// `enOut` / `esOut` say otherwise.
// `g`/`n` give the Spanish gender and number. A phrase may be an object
// { re, keep } where `keep` is a capture group kept before the placeholder.
// Directional entries set `only: 'en-es'` or `only: 'es-en'`.
export const TERMS = [
  // Music and worship
  { en: ['praise team', 'praise and worship team', 'worship team', 'praise band', 'worship band', 'music team'], esOut: 'conjunto', es: [{ re: '(el|al|del|nuestro|este|ese)\\s+conjunto(?!\\s+de\\s+(?!alabanza))', keep: 1 }, 'grupo de alabanza', 'equipo de alabanza', 'ministerio de alabanza'], g: 'm', n: 's' },
  { en: ['worship leader', 'song leader', 'praise leader'], es: ['director de alabanza', 'líder de alabanza', 'ministro de alabanza'], g: 'm', n: 's' },
  { en: ['hymnal', 'hymn book', 'hymnbook', 'songbook'], es: ['himnario'], g: 'm', n: 's' },
  { en: ['special music', 'special song'], es: ['número especial'], g: 'm', n: 's' },
  { en: ['choruses'], es: ['coritos'], g: 'm', n: 'p' },
  { en: ['benediction'], es: ['bendición final'], g: 'f', n: 's' },
  { en: ['responsive reading'], es: ['lectura alternada'], g: 'f', n: 's' },

  // Services and meetings
  { en: ['sunday morning service', 'sunday morning worship'], es: ['culto del domingo por la mañana'], g: 'm', n: 's' },
  { en: ['sunday night service', 'sunday evening service'], es: ['culto del domingo por la noche'], g: 'm', n: 's' },
  { en: ['wednesday night service', 'wednesday night church', 'wednesday evening service'], es: ['culto del miércoles por la noche'], g: 'm', n: 's' },
  { en: ['morning service'], es: ['culto de la mañana'], g: 'm', n: 's' },
  { en: ['evening service', 'night service'], es: ['culto de la noche'], g: 'm', n: 's' },
  { en: ['youth service'], es: ['culto de jóvenes'], g: 'm', n: 's' },
  { en: ['prayer meeting', 'prayer service'], es: ['culto de oración', 'reunión de oración'], g: 'm', n: 's' },
  { en: ['all night prayer', 'all-night prayer', 'prayer vigil'], es: ['vigilia'], g: 'f', n: 's' },
  { en: ['worship service', 'church service', 'sunday service', { re: '(the|this|our|today\'?s|tonight\'?s|next|every)\\s+service', keep: 1 }], es: ['culto'], g: 'm', n: 's' },
  { en: ['worship services', 'church services', { re: '(the|our|these)\\s+services', keep: 1 }], es: ['cultos'], g: 'm', n: 'p' },
  { en: ['altar call'], es: ['llamado al altar', 'llamamiento'], g: 'm', n: 's' },
  { en: ['revival services', 'revival meetings', 'revival meeting', 'tent revival', 'revival week'], es: ['campaña de avivamiento', 'campaña evangelística'], g: 'f', n: 's' },
  { en: ['revival'], es: ['avivamiento'], g: 'm', n: 's' },
  { en: ['business meeting'], es: ['sesión de negocios'], g: 'f', n: 's' },
  { en: ['homecoming', 'church anniversary'], es: ['aniversario de la iglesia'], g: 'm', n: 's', only: 'en-es' },

  // Fellowship and food
  { en: ['potluck', 'potluck dinner', 'potluck lunch', 'covered dish dinner', 'dinner on the grounds', 'fellowship meal', 'fellowship dinner', 'church dinner'], es: ['convivio', 'comida compartida'], g: 'm', n: 's' },
  { en: ['fellowship hall'], es: ['salón de compañerismo', 'salón social'], g: 'm', n: 's' },

  // Ministries and groups
  { en: ['Sunday school'], es: ['escuela dominical'], g: 'f', n: 's' },
  { en: ['children\'s church', 'kids church', 'kids\' church', 'childrens church'], es: ['iglesia infantil', 'escuelita'], g: 'f', n: 's' },
  { en: ['Vacation Bible School', 'v b s'], es: ['escuela bíblica de vacaciones'], g: 'f', n: 's' },
  { en: ['youth group', 'youth ministry'], es: ['grupo de jóvenes', 'ministerio de jóvenes'], g: 'm', n: 's' },
  { en: ['women\'s ministry', 'ladies\' ministry', 'ladies ministry', 'womens ministry'], es: ['ministerio de damas', 'sociedad de damas'], g: 'm', n: 's' },
  { en: ['men\'s ministry', 'men\'s fellowship', 'mens ministry'], es: ['ministerio de caballeros', 'ministerio de varones'], g: 'm', n: 's' },
  { en: ['small groups', 'life groups', 'cell groups', 'home groups', 'connect groups'], es: ['células', 'grupos familiares'], g: 'f', n: 'p' },
  { en: ['small group', 'life group', 'cell group', 'home group', 'connect group'], es: ['célula', 'grupo familiar'], g: 'f', n: 's' },
  { en: ['nursery'], es: ['guardería'], g: 'f', n: 's', only: 'en-es' },
  { en: ['greeters', 'welcome team'], es: ['equipo de bienvenida'], g: 'm', n: 's' },
  { en: ['ushers'], es: ['ujieres'], g: 'm', n: 'p' },
  { en: ['usher'], es: ['ujier'], g: 'm', n: 's' },
  { en: ['prayer warriors', 'intercessors'], es: ['intercesores'], g: 'm', n: 'p' },
  { en: ['prayer requests'], es: ['peticiones de oración'], g: 'f', n: 'p' },
  { en: ['prayer request'], es: ['petición de oración'], g: 'f', n: 's' },
  { en: ['deacon board', 'board of deacons'], es: ['junta de diáconos'], g: 'f', n: 's' },
  { en: ['men'], es: ['varones', 'caballeros'], g: 'm', n: 'p', only: 'es-en' },

  // Sacraments, places and events
  { esOut: 'Santa Cena', en: ['Lord\'s Supper', 'holy communion', { re: '(take|taking|took|serve|serving|have|having)\\s+communion', keep: 1 }], es: ['santa cena'], g: 'f', n: 's' },
  { en: ['baby dedication', 'baby dedications', 'child dedication'], es: ['presentación de niños'], g: 'f', n: 's' },
  { en: ['baptistry', 'baptistery', 'baptismal'], es: ['bautisterio'], g: 'm', n: 's' },
  { en: ['Easter Sunday', 'resurrection sunday', 'easter'], esOut: 'Domingo de Resurrección', es: ['domingo de resurrección'], g: 'm', n: 's' },
  { en: ['sanctuary'], es: ['templo'], g: 'm', n: 's', only: 'en-es' },
  { en: ['sermon'], es: ['prédica'], g: 'f', n: 's', only: 'en-es' },
  { en: ['sinner\'s prayer', 'sinners prayer'], es: ['oración de fe'], g: 'f', n: 's', only: 'en-es' },
  { en: ['love offering'], es: ['ofrenda de amor'], g: 'f', n: 's' },
  { en: ['Rapture'], es: ['rapto', 'arrebatamiento'], g: 'm', n: 's' },
  { en: ['backsliders'], es: ['descarriados'], g: 'm', n: 'p' },

  // Bible books (named the way Spanish-speaking churches say them).
  { en: ['genesis'], es: ['génesis'], enOut: 'Genesis', esOut: 'Génesis', name: true },
  { en: ['exodus'], es: ['éxodo'], enOut: 'Exodus', esOut: 'Éxodo', name: true },
  { en: ['leviticus'], es: ['levítico'], enOut: 'Leviticus', esOut: 'Levítico', name: true },
  { en: ['deuteronomy'], es: ['deuteronomio'], enOut: 'Deuteronomy', esOut: 'Deuteronomio', name: true },
  { en: ['joshua'], es: ['josué'], enOut: 'Joshua', esOut: 'Josué', name: true },
  { en: ['ruth'], es: ['rut'], enOut: 'Ruth', esOut: 'Rut', name: true },
  { en: ['first samuel'], es: ['primera de samuel', 'primero de samuel'], enOut: 'First Samuel', esOut: 'Primera de Samuel', name: true },
  { en: ['second samuel'], es: ['segunda de samuel', 'segundo de samuel'], enOut: 'Second Samuel', esOut: 'Segunda de Samuel', name: true },
  { en: ['first kings'], es: ['primera de reyes', 'primero de reyes'], enOut: 'First Kings', esOut: 'Primera de Reyes', name: true },
  { en: ['second kings'], es: ['segunda de reyes', 'segundo de reyes'], enOut: 'Second Kings', esOut: 'Segunda de Reyes', name: true },
  { en: ['first chronicles'], es: ['primera de crónicas', 'primero de crónicas'], enOut: 'First Chronicles', esOut: 'Primera de Crónicas', name: true },
  { en: ['second chronicles'], es: ['segunda de crónicas', 'segundo de crónicas'], enOut: 'Second Chronicles', esOut: 'Segunda de Crónicas', name: true },
  { en: ['ezra'], es: ['esdras'], enOut: 'Ezra', esOut: 'Esdras', name: true },
  { en: ['nehemiah'], es: ['nehemías'], enOut: 'Nehemiah', esOut: 'Nehemías', name: true },
  { en: ['esther'], es: ['ester'], enOut: 'Esther', esOut: 'Ester', name: true },
  { en: ['psalms'], es: ['salmos'], enOut: 'Psalms', esOut: 'Salmos', name: true },
  { en: ['psalm'], es: ['salmo'], enOut: 'Psalm', esOut: 'Salmo', name: true },
  { en: ['proverbs'], es: ['proverbios'], enOut: 'Proverbs', esOut: 'Proverbios', name: true },
  { en: ['ecclesiastes'], es: ['eclesiastés'], enOut: 'Ecclesiastes', esOut: 'Eclesiastés', name: true },
  { en: ['song of solomon', 'song of songs'], es: ['cantares', 'cantar de los cantares'], enOut: 'Song of Solomon', esOut: 'Cantares', name: true },
  { en: ['isaiah'], es: ['isaías'], enOut: 'Isaiah', esOut: 'Isaías', name: true },
  { en: ['jeremiah'], es: ['jeremías'], enOut: 'Jeremiah', esOut: 'Jeremías', name: true },
  { en: ['lamentations'], es: ['lamentaciones'], enOut: 'Lamentations', esOut: 'Lamentaciones', name: true },
  { en: ['ezekiel'], es: ['ezequiel'], enOut: 'Ezekiel', esOut: 'Ezequiel', name: true },
  { en: ['hosea'], es: ['oseas'], enOut: 'Hosea', esOut: 'Oseas', name: true },
  { en: ['obadiah'], es: ['abdías'], enOut: 'Obadiah', esOut: 'Abdías', name: true },
  { en: ['jonah'], es: ['jonás'], enOut: 'Jonah', esOut: 'Jonás', name: true },
  { en: ['micah'], es: ['miqueas'], enOut: 'Micah', esOut: 'Miqueas', name: true },
  { en: ['nahum'], es: ['nahúm'], enOut: 'Nahum', esOut: 'Nahúm', name: true },
  { en: ['habakkuk'], es: ['habacuc'], enOut: 'Habakkuk', esOut: 'Habacuc', name: true },
  { en: ['zephaniah'], es: ['sofonías'], enOut: 'Zephaniah', esOut: 'Sofonías', name: true },
  { en: ['haggai'], es: ['hageo'], enOut: 'Haggai', esOut: 'Hageo', name: true },
  { en: ['zechariah'], es: ['zacarías'], enOut: 'Zechariah', esOut: 'Zacarías', name: true },
  { en: ['malachi'], es: ['malaquías'], enOut: 'Malachi', esOut: 'Malaquías', name: true },
  { en: ['matthew'], es: ['mateo'], enOut: 'Matthew', esOut: 'Mateo', name: true },
  { en: ['luke'], es: ['lucas'], enOut: 'Luke', esOut: 'Lucas', name: true },
  { en: ['romans'], es: ['romanos'], enOut: 'Romans', esOut: 'Romanos', name: true },
  { en: ['first corinthians'], es: ['primera de corintios', 'primera corintios', 'primero de corintios'], enOut: 'First Corinthians', esOut: 'Primera de Corintios', name: true },
  { en: ['second corinthians'], es: ['segunda de corintios', 'segunda corintios', 'segundo de corintios'], enOut: 'Second Corinthians', esOut: 'Segunda de Corintios', name: true },
  { en: ['corinthians'], es: ['corintios'], enOut: 'Corinthians', esOut: 'Corintios', name: true },
  { en: ['galatians'], es: ['gálatas'], enOut: 'Galatians', esOut: 'Gálatas', name: true },
  { en: ['ephesians'], es: ['efesios'], enOut: 'Ephesians', esOut: 'Efesios', name: true },
  { en: ['philippians'], es: ['filipenses'], enOut: 'Philippians', esOut: 'Filipenses', name: true },
  { en: ['colossians'], es: ['colosenses'], enOut: 'Colossians', esOut: 'Colosenses', name: true },
  { en: ['first thessalonians'], es: ['primera de tesalonicenses'], enOut: 'First Thessalonians', esOut: 'Primera de Tesalonicenses', name: true },
  { en: ['second thessalonians'], es: ['segunda de tesalonicenses'], enOut: 'Second Thessalonians', esOut: 'Segunda de Tesalonicenses', name: true },
  { en: ['first timothy'], es: ['primera de timoteo'], enOut: 'First Timothy', esOut: 'Primera de Timoteo', name: true },
  { en: ['second timothy'], es: ['segunda de timoteo'], enOut: 'Second Timothy', esOut: 'Segunda de Timoteo', name: true },
  { en: ['titus'], es: ['tito'], enOut: 'Titus', esOut: 'Tito', name: true },
  { en: ['philemon'], es: ['filemón'], enOut: 'Philemon', esOut: 'Filemón', name: true },
  { en: ['hebrews'], es: ['hebreos'], enOut: 'Hebrews', esOut: 'Hebreos', name: true },
  { en: ['first peter'], es: ['primera de pedro'], enOut: 'First Peter', esOut: 'Primera de Pedro', name: true },
  { en: ['second peter'], es: ['segunda de pedro'], enOut: 'Second Peter', esOut: 'Segunda de Pedro', name: true },
  { en: ['first john'], es: ['primera de juan'], enOut: 'First John', esOut: 'Primera de Juan', name: true },
  { en: ['second john'], es: ['segunda de juan'], enOut: 'Second John', esOut: 'Segunda de Juan', name: true },
  { en: ['third john'], es: ['tercera de juan'], enOut: 'Third John', esOut: 'Tercera de Juan', name: true },
  { en: ['jude'], es: ['judas'], enOut: 'Jude', esOut: 'Judas', name: true },
  { en: ['revelation', 'revelations', 'the book of revelation'], es: ['apocalipsis'], enOut: 'Revelation', esOut: 'Apocalipsis', name: true },
  { en: [{ re: 'mark(?=\\s+(chapter|\\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty))' }], es: [{ re: 'marcos(?=\\s+(cap[ií]tulo|\\d|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|treinta|cuarenta|cincuenta))' }], enOut: 'Mark', esOut: 'Marcos', name: true },
  { en: [{ re: 'acts(?=\\s+(chapter|\\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty))' }], es: [{ re: 'hechos(?=\\s+(cap[ií]tulo|\\d|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|treinta|cuarenta|cincuenta))' }], enOut: 'Acts', esOut: 'Hechos', name: true },
  { en: [{ re: 'john(?=\\s+(chapter|\\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty))' }], es: [{ re: 'juan(?=\\s+(cap[ií]tulo|\\d|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|treinta|cuarenta|cincuenta))' }], enOut: 'John', esOut: 'Juan', name: true },
  { en: [{ re: 'james(?=\\s+(chapter|\\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty))' }], es: [{ re: 'santiago(?=\\s+(cap[ií]tulo|\\d|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|treinta|cuarenta|cincuenta))' }], enOut: 'James', esOut: 'Santiago', name: true },
  { en: [{ re: 'job(?=\\s+(chapter|\\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty))' }], es: [{ re: 'job(?=\\s+(cap[ií]tulo|\\d|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|treinta|cuarenta|cincuenta))' }], enOut: 'Job', esOut: 'Job', name: true },
  { en: [{ re: 'numbers(?=\\s+(chapter|\\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty))' }], es: [{ re: 'números(?=\\s+(cap[ií]tulo|\\d|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|treinta|cuarenta|cincuenta))' }], enOut: 'Numbers', esOut: 'Números', name: true },
  { en: [{ re: 'judges(?=\\s+(chapter|\\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty))' }], es: [{ re: 'jueces(?=\\s+(cap[ií]tulo|\\d|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|treinta|cuarenta|cincuenta))' }], enOut: 'Judges', esOut: 'Jueces', name: true },
  { en: [{ re: 'daniel(?=\\s+(chapter|\\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty))' }], es: [{ re: 'daniel(?=\\s+(cap[ií]tulo|\\d|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|treinta|cuarenta|cincuenta))' }], enOut: 'Daniel', esOut: 'Daniel', name: true },
  { en: [{ re: 'joel(?=\\s+(chapter|\\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty))' }], es: [{ re: 'joel(?=\\s+(cap[ií]tulo|\\d|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|treinta|cuarenta|cincuenta))' }], enOut: 'Joel', esOut: 'Joel', name: true },
  { en: [{ re: 'amos(?=\\s+(chapter|\\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty))' }], es: [{ re: 'amós(?=\\s+(cap[ií]tulo|\\d|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|treinta|cuarenta|cincuenta))' }], enOut: 'Amos', esOut: 'Amós', name: true },
];

// Rewrites applied to the source text before translation: Southern
// expressions into plain English, and a few idioms the model mishandles.
const EN_REWRITES = [
  [/\by'?all\b/gi, 'you all'],
  [/\ball you all\b/gi, 'all of you'],
  [/\bfixin'?g?\s+to\b/gi, 'about to'],
  [/\bfixing\s+to\b/gi, 'about to'],
  [/\b(can|could|may)\s+i\s+(get|have)\s+(an?\s+)?(amen|witness)\b/gi, 'somebody say amen'],
  [/\b(lord|god)\s+willin'?g?(\s+and\s+the\s+creek\s+don'?t\s+rise)?\b/gi, 'God willing'],
  [/\bthe\s+good\s+lord\b/gi, 'the Lord'],
  [/\b(get|gets|getting|got|gotten)\s+saved\b/gi, (m, v) => ({ get: 'accept Christ', gets: 'accepts Christ', getting: 'accepting Christ', got: 'accepted Christ', gotten: 'accepted Christ' })[v.toLowerCase()]],
  [/\b(come|coming|came)\s+(forward|down\s+front|down\s+to\s+the\s+front|up\s+front)\b/gi, (m, v) => `${v} to the front`],
  [/\bwalk(ed|ing)?\s+the\s+aisle\b/gi, 'come to the front'],
  [/\bgo(ing)?\s+witnessing\b/gi, 'go evangelizing'],
  [/\bamen\s+corner\b/gi, 'front row'],
  // "Turn to/in" means "open your Bible to"; matched without waiting for
  // the "to", since live translation starts before it is heard.
  [/\bturn\s+with\s+me(\s+in\s+your\s+bibles?)?\b/gi, 'open your Bible with me'],
  [/\bturn\s+(in\s+|to\s+)?(your\s+)(bibles?|hymnals?|hymn\s*books?|songbooks?)\b/gi, (m, i, y, b) => `open your ${b}`],
  // The model garbles a lowercase "bibles"; capitalize it.
  [/\bbible(s?)\b/gi, (m, pl) => `Bible${pl}`],
  [/\b(take|taking|took)\s+communion\b/gi, (m, v) => `${v} the Lord's Supper`],
];

const ES_REWRITES = [
  [/\bpasen\s+adelante\b/gi, 'pasen al frente'],
];

// Fixes applied to the translated output.
const ES_POST = [
  [/¿?\s*(Puedo|Podría)\s+(conseguir|obtener|tener|recibir)\s+un\s+amén\s*\??/gi, '¿Quién dice amén?'],
  [/\b(Que\s+)?[Aa]lguien\s+(dice|diga)\s+amén\b[.!]?/g, '¿Quién dice amén?'],
  [/\b(ven|venga|acércate|acérquese)\s+al\s+frente\b/gi, 'pasa al frente'],
  [/\b(vengan|acérquense)\s+al\s+frente\b/gi, 'pasen al frente'],
  [/\bvinieron\s+al\s+frente\b/gi, 'pasaron al frente'],
  [/\bvino\s+al\s+frente\b/gi, 'pasó al frente'],
  [/\bllamada al altar\b/gi, 'llamado al altar'],
  [/\bacomodador(es)?\b/gi, (m, p) => (p ? 'ujieres' : 'ujier')],
  [/^¡?Alabado sea el Señor\b/, '¡Gloria a Dios'],
  [/\bfila delantera\b/gi, 'primera fila'],
  // Evangelical churches pray with "orar"; "rezar" sounds Catholic.
  // (Not "rezo", which is also the noun "prayer".)
  [/(^|[^\p{L}])(rez)(ar|as|a|amos|an|ó|aste|aron|aba|aban|ando|aré|arás|ará|aremos|arán|aría|arían)(?![\p{L}])/giu, (m, pre, r, e) => pre + matchCase(`or${e}`, r)],
  [/(^|[^\p{L}])(rec)(e|es|emos|en)(?![\p{L}])/giu, (m, pre, r, e) => pre + matchCase(`or${e}`, r)],
  // Latin American Spanish: "ustedes", not "vosotros".
  [/\bvosotr[oa]s\b/gi, (m) => matchCase('ustedes', m)],
];

const EN_POST = [
  [/\bwho says amen\b\??/gi, 'Can I get an amen?'],
  [/\bcults?\b/gi, (m) => (m.toLowerCase().endsWith('s') ? 'services' : 'service')],
  [/\b(go|pass|come|move)\s+(to\s+the\s+front|forward|ahead)\b/gi, 'come forward'],
  [/\b(brother|sister)\s+([A-Z])/g, (m, w, c) => `${w[0].toUpperCase()}${w.slice(1)} ${c}`],
];

// Made-up names the translation models copy unchanged ("Zorxano"). The
// stem ("Zorxa") is unique to each term and contains an "x" that no real
// word has there, so it can be found even if the model changes the ending.
// Endings follow the term's Spanish gender and number (-no/-na/-nos/-nas),
// so the model makes adjectives and verbs agree; Bible books end in "-x".
const PH_A = ['Zor', 'Kel', 'Dor', 'Mor', 'Tol', 'Quen', 'Lar', 'Bril', 'Fen', 'Gal', 'Hor', 'Jal', 'Nor', 'Pem', 'Ral', 'Sor', 'Tam', 'Vel', 'Yal', 'Zan'];
const PH_C = ['a', 'e', 'i', 'o', 'u', 'al', 'el', 'il'];
const PH_END = { ms: 'no', fs: 'na', mp: 'nos', fp: 'nas', name: 'x' };
function placeholderStem(i) {
  return `${PH_A[i % PH_A.length]}x${PH_C[Math.floor(i / PH_A.length) % PH_C.length]}`;
}
export function placeholderName(i, term = TERMS[i]) {
  return placeholderStem(i) + PH_END[term?.name ? 'name' : `${term?.g || 'm'}${term?.n || 's'}`];
}

function accentInsensitive(s) {
  const map = { a: '[aá]', e: '[eé]', i: '[ií]', o: '[oó]', u: '[uúü]', n: '[nñ]' };
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[aeioun]/g, (c) => map[c]);
}

function phraseRegex(p, lang) {
  if (typeof p === 'object') return { re: new RegExp(`\\b${p.re}\\b`, 'gi'), keep: p.keep };
  let src = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+').replace(/'/g, "'?");
  if (lang === 'es') src = accentInsensitive(src);
  return { re: new RegExp(`(^|[^\\p{L}\\p{N}])(${src})(?![\\p{L}\\p{N}])`, 'giu'), keep: 1 };
}

function compile(direction) {
  const [from] = direction.split('-');
  const rules = [];
  TERMS.forEach((term, i) => {
    if (term.only && term.only !== direction) return;
    for (const p of term[from]) {
      const { re, keep } = phraseRegex(p, from);
      const len = typeof p === 'object' ? p.re.length : p.length;
      rules.push({ re, keep, custom: typeof p === 'object', term, ph: placeholderName(i), len });
    }
  });
  // Longest phrases first ("praise and worship team" before "worship team").
  rules.sort((a, b) => b.len - a.len);
  return rules;
}

const COMPILED = { 'en-es': compile('en-es'), 'es-en': compile('es-en') };
const STEMS = TERMS.map((t, i) => [placeholderStem(i).toLowerCase(), t]).sort((a, b) => b[0].length - a[0].length);

/** The glossary term a (possibly altered) placeholder word stands for. */
function termFor(word) {
  const w = word.toLowerCase();
  if (!w.includes('x')) return undefined;
  return STEMS.find(([stem]) => w.startsWith(stem))?.[1];
}

/** Rewrite the source text and swap glossary terms for placeholders. */
export function applyGlossary(text, direction) {
  let t = text;
  for (const [re, rep] of direction === 'en-es' ? EN_REWRITES : ES_REWRITES) t = t.replace(re, rep);
  for (const { re, keep, custom, ph } of COMPILED[direction]) {
    // Custom patterns keep a leading word ("the service" -> "the Zorvex");
    // plain phrases keep the character before them.
    t = t.replace(re, (...m) => (custom ? `${m[keep]} ${ph}` : `${m[keep]}${ph}`));
  }
  return t;
}

const ES_DET = {
  def: { ms: 'el', mp: 'los', fs: 'la', fp: 'las' },
  indef: { ms: 'un', mp: 'unos', fs: 'una', fp: 'unas' },
};
const DET_KIND = {
  el: ['def'], la: ['def'], los: ['def'], las: ['def'],
  un: ['indef'], una: ['indef'], unos: ['indef'], unas: ['indef'],
  al: ['def', 'a'], del: ['def', 'de'],
};

function matchCase(word, like) {
  return like && like[0] === like[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
}

const outputOf = (term, lang) => term[`${lang}Out`] ?? term[lang].find((p) => typeof p === 'string');

function spanishWithArticle(det, term) {
  const out = outputOf(term, 'es');
  if (!det) return out;
  const [kind, prep] = DET_KIND[det.toLowerCase()];
  const article = ES_DET[kind][term.g + term.n];
  let phrase;
  if (prep === 'a') phrase = article === 'el' ? 'al' : `a ${article}`;
  else if (prep === 'de') phrase = article === 'el' ? 'del' : `de ${article}`;
  else phrase = article;
  return `${matchCase(phrase, det)} ${out}`;
}

function capitalizeAfterSentenceStart(text, index, word) {
  const before = text.slice(0, index).trimEnd();
  return before === '' || /[.!?¿¡]$/.test(before) ? word[0].toUpperCase() + word.slice(1) : word;
}

// Verbs after which the model's "a Zorxano" stands for "a/an" ("tendremos un
// convivio"), not "to the".
const HAVE_VERB = /(?:^|[^\p{L}])(ten(?:er|emos|dremos|drá|drán|drás|go|ía|íamos)|tiene|tienen|habrá|hay|haremos|hacemos|hará|harán|celebr\p{L}*|organiz\p{L}*|prepar\p{L}*)$/iu;

/** Replace placeholders with the preferred terms and apply output fixes. */
export function restoreGlossary(text, direction) {
  let t = text;
  if (direction === 'en-es') {
    t = t.replace(
      /(^|[^\p{L}])(?:(a|de)\s+)?(?:(el|la|los|las|al|del|un|una|unos|unas)\s+)?([A-Z][a-z]+)(?![\p{L}])/giu,
      (m, pre, prep, det, w, idx, all) => {
        const term = termFor(w);
        if (!term) return m;
        const start = idx + pre.length;
        let phrase;
        if (term.name) {
          // Bible books take no article: "a los Romanos" -> "a Romanos".
          const p = prep || (det && /^(al)$/i.test(det) ? 'a' : det && /^del$/i.test(det) ? 'de' : '');
          phrase = `${p ? `${matchCase(p, prep || det)} ` : ''}${outputOf(term, 'es')}`;
        } else if (det) {
          phrase = `${prep ? `${prep} ` : ''}${spanishWithArticle(det, term)}`;
        } else if (prep === 'a' && HAVE_VERB.test(all.slice(0, start).trimEnd())) {
          // "tendremos a Zorxano": the model took the made-up name for a
          // person; with "have/hold" verbs it means "a/an".
          phrase = spanishWithArticle('un', term);
        } else if (prep || /[.!?¿¡]\s*$|^\s*$/.test(all.slice(0, start))) {
          // Otherwise "a Zorxano" means "to the" ("vengan al convivio"), and
          // at the start of a sentence Spanish needs the article.
          phrase = spanishWithArticle(prep === 'a' ? 'al' : prep === 'de' ? 'del' : 'el', term);
        } else {
          phrase = outputOf(term, 'es');
        }
        return pre + capitalizeAfterSentenceStart(all, start, phrase);
      },
    );
    for (const [re, rep] of ES_POST) t = t.replace(re, rep);
  } else {
    t = t.replace(/(^|[^\p{L}])(?:(a|an|the)\s+)?([A-Z][a-z]+)(?![\p{L}])/giu, (m, pre, det, w, idx, all) => {
      const term = termFor(w);
      if (!term) return m;
      const out = outputOf(term, 'en');
      let phrase;
      if (term.name || !det) phrase = term.name && det && /^the$/i.test(det) ? out : det && !term.name ? `${det} ${out}` : out;
      else if (/^the$/i.test(det)) phrase = `${det} ${out}`;
      else phrase = `${matchCase(/^[aeiou]/i.test(out) ? 'an' : 'a', det)} ${out}`;
      return pre + capitalizeAfterSentenceStart(all, idx + pre.length, phrase);
    });
    for (const [re, rep] of EN_POST) t = t.replace(re, rep);
  }
  return t;
}

/** Placeholder names, so callers can tell them apart from real words. */
export function isPlaceholder(word) {
  return Boolean(termFor(word));
}
