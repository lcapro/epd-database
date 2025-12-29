import type { EpdSetType } from '../types';

export function detectStandardSet(text: string): EpdSetType {
  const t = text.toLowerCase();
  const has1 = t.includes('sbk set 1') || t.includes('en 15804+a1') || t.includes('en15804+a1');
  const has2 = t.includes('sbk set 2') || t.includes('en 15804+a2') || t.includes('en15804+a2');
  if (has1 && has2) return 'SBK_BOTH';
  if (has1) return 'SBK_SET_1';
  if (has2) return 'SBK_SET_2';
  return 'UNKNOWN';
}
