export function normalizePreserveLines(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

export function getLineValue(text: string, labelVariants: string[]): string | undefined {
  const lines = text.split('\n');
  const lowered = labelVariants.map((l) => l.toLowerCase());

  for (const line of lines) {
    const idx = lowered.findIndex((lab) => line.toLowerCase().startsWith(lab.toLowerCase()));
    if (idx >= 0) {
      const raw = line.split(':').slice(1).join(':').trim();
      if (raw) return raw;
    }
  }
  return undefined;
}

export function dateFromText(text: string): string | undefined {
  const matchIso = text.match(/(20\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01]))/);
  if (matchIso?.[1]) return matchIso[1].replace(/\//g, '-');

  const matchNl = text.match(/(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})/);
  if (matchNl) {
    const day = matchNl[1].padStart(2, '0');
    const month = matchNl[2].padStart(2, '0');
    const year = matchNl[3];
    return `${year}-${month}-${day}`;
  }
  return undefined;
}
