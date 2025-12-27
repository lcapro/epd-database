import { ParsedEpd, ParsedImpact, EpdImpactStage, EpdSetType } from './types';

const impactStages: EpdImpactStage[] = ['A1', 'A2', 'A3', 'A1_A3', 'D'];

// -------------- helpers: text normalisatie --------------
/**
 * Belangrijk: behoud newlines, anders kun je geen "key: value" en tabellen betrouwbaar parsen.
 * - normaliseert line endings
 * - trimt elke regel
 * - behoudt lege regels (handig als “sectie” scheiding)
 */
function normalizePreserveLines(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

function parseNumberLoose(value?: string | null): number | undefined {
  if (!value) return undefined;

  // Ondersteun: 3,655E+0  |  2,840E+1  |  16,419E+0  |  0,123  |  1.234
  // 1) verwijder spaties
  const v = value.replace(/\s+/g, '');

  // 2) als het scientific is met komma als decimaal
  //    vervang eerst komma door punt, maar alleen als er geen punt-decimaal al “logisch” is
  //    (hier is het veilig: in NL pdfs zie je vaak komma-decimaal)
  const normalized = v.replace(',', '.');

  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

function dateFromText(text: string): string | undefined {
  // 2024-11-28 of 2024/11/28
  const matchIso = text.match(/(20\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01]))/);
  if (matchIso?.[1]) return matchIso[1].replace(/\//g, '-');

  // 28-11-2024 of 28/11/2024
  const matchNl = text.match(/(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})/);
  if (matchNl) {
    const day = matchNl[1].padStart(2, '0');
    const month = matchNl[2].padStart(2, '0');
    const year = matchNl[3];
    return `${year}-${month}-${day}`;
  }
  return undefined;
}

// -------------- helpers: “key: value” parsing --------------
function getLineValue(text: string, labelVariants: string[]): string | undefined {
  // zoekt regels als:
  // "Datum van publicatie: 28-11-2024"
  // "PCR: NL-PCR Asfalt 2.0"
  const lines = text.split('\n');
  const lowered = labelVariants.map((l) => l.toLowerCase());

  for (const line of lines) {
    const idx = lowered.findIndex((lab) => line.toLowerCase().startsWith(lab));
    if (idx >= 0) {
      const raw = line.split(':').slice(1).join(':').trim();
      if (raw) return raw;
    }
  }
  return undefined;
}

function detectStandardSet(text: string): EpdSetType {
  const t = text.toLowerCase();
  // in jouw PDF staat letterlijk “Resultaten Milieu-impact SBK set 1” 
  if (t.includes('sbk set 1') || t.includes('en 15804+a1') || t.includes('en15804+a1') || t.includes('+a1')) {
    return 'SBK_SET_1';
  }
  if (t.includes('sbk set 2') || t.includes('en 15804+a2') || t.includes('en15804+a2') || t.includes('+a2')) {
    return 'SBK_SET_2';
  }
  return 'UNKNOWN';
}

// -------------- PCR normalisatie --------------
function normalizePcr(pcrRaw: string | undefined): { pcrName?: string; version?: string; canonical?: string } {
  if (!pcrRaw) return {};

  const raw = pcrRaw.replace(/\s+/g, ' ').trim();

  // Voorbeelden die we in jouw tekst zien:
  // - "PCR-asfalt versie 2.0"
  // - "PCR:NL-PCR Asfalt 2.0"
  // - "PCR Asfalt 2.0"
  const lowered = raw.toLowerCase();

  // probeer versie te vinden (2.0, 1.1, etc)
  const v = raw.match(/(\d+(?:\.\d+){0,2})/)?.[1];

  // probeer naam te normaliseren
  let name: string | undefined;

  if (lowered.includes('nl-pcr') && lowered.includes('asfalt')) name = 'NL-PCR Asfalt';
  else if (lowered.includes('pcr') && lowered.includes('asfalt')) name = 'PCR Asfalt';
  else if (lowered.includes('asfalt')) name = 'Asfalt';
  else {
    // fallback: strip "PCR" en "versie"
    name = raw
      .replace(/pcr[:\s]*/i, '')
      .replace(/versie/gi, '')
      .replace(/\d+(?:\.\d+){0,2}/g, '')
      .trim();
    if (!name) name = undefined;
  }

  const canonical = name && v ? `${name} ${v}` : name || (v ? `PCR ${v}` : undefined);
  return { pcrName: name, version: v, canonical };
}

// -------------- impact tabellen parsing --------------
type ParsedTableRow = {
  indicator: string;
  unit: string;
  values: Record<EpdImpactStage, number>;
};

function parseImpactTableForSet(text: string, setType: EpdSetType): ParsedTableRow[] {
  // We zoeken een blok dat start met:
  // "Resultaten Milieu-impact SBK set 1"
  // In jouw PDF staat dat letterlijk met daarna "Eenheid A1 A2 A3 A1-A3 D Totaal" 
  const setLabel = setType === 'SBK_SET_2' ? 'SBK set 2' : 'SBK set 1';
  const lines = text.split('\n');

  const startIdx = lines.findIndex((l) => l.toLowerCase().includes('resultaten') && l.toLowerCase().includes(setLabel.toLowerCase()));
  if (startIdx < 0) return [];

  // neem een “venster” na start; stop als we een nieuwe grote sectie zien
  const window = lines.slice(startIdx, startIdx + 220);

  // We willen rows herkennen als:
  // "MKI Euro 3,655E+0 7,058E-1 1,520E+0 5,881E+0 -2,198E+0 3,683E+0"
  // of
  // "GWP kg CO2-eq 2,840E+1 6,419E+0 2,131E+1 5,612E+1 -1,664E+1 3,948E+1"
  //
  // Omdat pdf-parse soms dingen aan elkaar plakt, doen we:
  // - collapse dubbele spaties in elke regel (hebben we al)
  // - als een regel “te kort” is maar lijkt op een indicator, probeer samen te voegen met volgende regel
  const merged: string[] = [];
  for (let i = 0; i < window.length; i++) {
    const cur = window[i].trim();
    if (!cur) continue;

    // stopcondities: volgende secties die niet meer “impact” zijn
    const low = cur.toLowerCase();
    if (
      i > 10 &&
      (low.startsWith('gebruik van grondstoffen') ||
        low.startsWith('output stromen') ||
        low.startsWith('verklaring van vertrouwelijkheid') ||
        low.includes('ecochain technologies'))
    ) {
      break;
    }

    // merge heuristiek: als regel geen cijfers heeft maar volgende wel
    const hasNumber = /[\d]/.test(cur);
    if (!hasNumber && window[i + 1] && /[\d]/.test(window[i + 1])) {
      merged.push(`${cur} ${window[i + 1].trim()}`);
      i++;
      continue;
    }
    merged.push(cur);
  }

  const rows: ParsedTableRow[] = [];

  // indicator tokens (deze lijst kun je uitbreiden; maar werkt al voor jouw “core + NMD set”)
  const knownIndicators = [
    'MKI',
    'ADPE',
    'ADPF',
    'GWP',
    'ODP',
    'POCP',
    'AP',
    'EP',
    'HTP',
    'FAETP',
    'MAETP',
    'TETP',
    'PERE',
    'PERM',
    'PERT',
    'PENRE',
    'PENRM',
    'PENRT',
    'PET',
    'SM',
    'RSF',
    'NRSF',
    'FW',
    'HWD',
    'NHWD',
    'RWD',
    'CRU',
    'MFR',
    'MER',
    'EE',
    'EET',
    'EEE',
  ];

  for (const line of merged) {
    // zoek of de regel begint met een indicator (exact)
    const firstToken = line.split(' ')[0]?.trim();
    if (!firstToken || !knownIndicators.includes(firstToken)) continue;

    // Na indicator volgt unit, daarna 5 waarden (A1 A2 A3 A1-A3 D) en vaak ook “Totaal”
    // We nemen de eerste 5 numerieke waarden na unit.
    // Unit kan bestaan uit meerdere tokens: bv "kg CO2 -eq" in jouw tekst 
    const tokens = line.split(' ').filter(Boolean);

    // Vind index van eerste token dat op een getal lijkt
    const firstNumIdx = tokens.findIndex((t) => /[\d]/.test(t) && /[0-9]/.test(t));
    if (firstNumIdx < 0) continue;

    const indicator = tokens[0];
    const unit = tokens.slice(1, firstNumIdx).join(' ').replace(/\s+/g, ' ').trim();

    const numberTokens = tokens.slice(firstNumIdx);

    // pak 5 waarden (A1, A2, A3, A1-A3, D) in volgorde.
    const nums: number[] = [];
    for (const t of numberTokens) {
      const n = parseNumberLoose(t);
      if (n !== undefined) nums.push(n);
      if (nums.length >= 5) break;
    }
    if (nums.length < 3) continue; // te weinig betrouwbare cijfers

    const values: Record<EpdImpactStage, number> = {} as any;
    if (nums[0] !== undefined) values.A1 = nums[0];
    if (nums[1] !== undefined) values.A2 = nums[1];
    if (nums[2] !== undefined) values.A3 = nums[2];
    if (nums[3] !== undefined) values.A1_A3 = nums[3];
    if (nums[4] !== undefined) values.D = nums[4];

    rows.push({ indicator, unit: unit || '', values });
  }

  return rows;
}

// -------------- main parse --------------
export function parseEpd(raw: string): ParsedEpd {
  const text = normalizePreserveLines(raw);

  const parsed: ParsedEpd = {
    productName: undefined,
    functionalUnit: undefined,
    producerName: undefined,
    lcaMethod: undefined,
    pcrVersion: undefined,
    databaseName: undefined,
    publicationDate: undefined,
    expirationDate: undefined,
    verifierName: undefined,
    standardSet: detectStandardSet(text),
    impacts: [],
  };

  // 1) basisvelden (line-based voorkeur, omdat PDF vaak zo is opgebouwd)
  // In jouw PDF zien we o.a. “Datum van publicatie: 28-11-2024” en “Einde geldigheid: 28-11-2029”. 
  const publicationRaw =
    getLineValue(text, ['Datum van publicatie', 'Publicatie datum', 'Publicatie']) ||
    firstMatch(text, [/publicatie[:\s]*datum[:\s]*([^\n]+)/i]);

  const expirationRaw =
    getLineValue(text, ['Einde geldigheid', 'Geldig tot', 'Expiration', 'Einde']) ||
    firstMatch(text, [/einde\s*geldigheid[:\s]*([^\n]+)/i]);

  parsed.publicationDate = dateFromText(publicationRaw || '') || dateFromText(text);
  parsed.expirationDate = dateFromText(expirationRaw || '');

  // Verificateur / toetser
  parsed.verifierName =
    getLineValue(text, ['Verificateur', 'Toetser', 'Verifier']) ||
    firstMatch(text, [/(verificateur|toetser|verifier)[:\s]*([^\n]+)/i].map((r) => new RegExp(r.source, r.flags))) ||
    undefined;

  // LCA standaard / methode
  parsed.lcaMethod =
    getLineValue(text, ['LCA standaard', 'LCA standaard:', 'LCA-methode', 'Bepalingsmethode']) ||
    firstMatch(text, [/lca\s*standaard[:\s]*([^\n]+)/i, /bepalingsmethode[:\s]*([^\n]+)/i]);

  // Database
  parsed.databaseName =
    getLineValue(text, ['Standaard database', 'Database']) ||
    firstMatch(text, [/standaard\s*database[:\s]*([^\n]+)/i, /database[:\s]*([^\n]+)/i]);

  // Producent / producentnaam
  // In jouw output pakt hij nu te veel; daarom: alleen de “kortere” vorm uit een echte labelregel, of anders een nette fallback.
  parsed.producerName =
    getLineValue(text, ['Producent', 'Producer']) ||
    firstMatch(text, [/^producent[:\s]*([^\n]{2,120})/im, /^producer[:\s]*([^\n]{2,120})/im]);

  // Productnaam & functionele eenheid
  parsed.productName =
    getLineValue(text, ['Productnaam', 'Product naam', 'Product name', 'Product']) ||
    firstMatch(text, [/^product\s*naam[:\s]*([^\n]{2,160})/im, /^product\s*name[:\s]*([^\n]{2,160})/im]);

  parsed.functionalUnit =
    getLineValue(text, ['Functionele eenheid', 'Functional unit', 'Eenheid']) ||
    firstMatch(text, [/^functionele\s*eenheid[:\s]*([^\n]{2,160})/im, /^functional\s*unit[:\s]*([^\n]{2,160})/im]);

  // PCR (naam + versie normaliseren)
  const pcrLine =
    getLineValue(text, ['PCR', 'PCR:', 'PCR-asfalt versie', 'PCR-asfalt']) ||
    firstMatch(text, [/pcr[:\s]*([^\n]+)/i, /pcr[-\s]*asfalt\s*versie[:\s]*([^\n]+)/i]);

  const pcrNorm = normalizePcr(pcrLine);
  // Jij wilt “standaard” waarden (niet hele zinnen). Dus: canonical in pcrVersion opslaan.
  parsed.pcrVersion = pcrNorm.canonical;

  // 2) standaard set
  parsed.standardSet = detectStandardSet(text);

  // 3) impacts uit tabellen
  const impacts: ParsedImpact[] = [];

  const setsToTry: EpdSetType[] = ['SBK_SET_1', 'SBK_SET_2'];
  for (const setType of setsToTry) {
    const rows = parseImpactTableForSet(text, setType);
    for (const row of rows) {
      for (const stage of impactStages) {
        const v = row.values[stage];
        if (v === undefined) continue;
        impacts.push({
          indicator: row.indicator, // string (MKI, GWP, ADPE, ...)
          setType,
          stage,
          value: v,
          unit: row.unit || '',
        } as any);
      }
    }
  }

  parsed.impacts = impacts;

  // 4) geldigheid fallback: +5 jaar
  if ((!parsed.expirationDate || parsed.expirationDate === '') && parsed.publicationDate) {
    const pubDate = new Date(parsed.publicationDate);
    if (!Number.isNaN(pubDate.getTime())) {
      const exp = new Date(pubDate);
      exp.setFullYear(exp.getFullYear() + 5);
      parsed.expirationDate = exp.toISOString().slice(0, 10);
    }
  }

  // 5) extra slimme fallback voor jouw type EPD:
  // Als productName leeg blijft maar producent wél exact dat “ANA I - 2023 - ...” label is,
  // dan is dat waarschijnlijk de project/EPD titel i.p.v. producent. In jouw output zie je dat hij nu daar belandt. 
  // We laten producent staan, maar zetten productName dan ook op die titel (zodat je niet leeg blijft).
  if (!parsed.productName && parsed.producerName && parsed.producerName.length <= 120 && /pcr/i.test(parsed.producerName)) {
    parsed.productName = parsed.producerName;
  }

  return parsed;
}
